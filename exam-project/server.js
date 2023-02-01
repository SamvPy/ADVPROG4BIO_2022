const http = require("http");
const fs = require("fs");
const express = require('express');
const app = express();
const url = require("url");
const socketio = require("socket.io")(http);
const mailer = require("./mailer")

var sendData = ""
var serialPort
var flag = true

// Initialize the express server and load charts.html on going to homepage
function startServer(route, handle) {

    function onRequest(request, response) {
        var pathname = url.parse(request.url).pathname; 
        console.log("Received request for " + pathname);

        // route the request to router.js, which points it to the right handler in request-handler.js
        // if there is no handler, a 404 page is generated
        var content = route(handle, pathname, response, request)
    }

    // setup the server and link it to the port
    var httpServer = http.createServer(onRequest).listen(8000, function() {
        console.log("Listening on port 8000");
    })
    
    serialEmitter();
    socketHandler(httpServer);
}

// Arduino accepts bytes. So to send 255, you need the character that corresponds to 255 byte code.
function intToChar(integer) {
    return String.fromCharCode(integer);
  }

function socketHandler(httpServer) {
    socketServer = socketio.listen(httpServer);

    socketServer.on("connection", (socket) => {
        console.log("user connected.");
        // socket.emit("connection", {pollOneValue:sendData});

        socket.emit('onconnection', {pollOneValue:sendData});

        socket.on("buttonPress", function(value) { 
            if (value == "ledon") {
                
                console.log(intToChar(255));
                serialPort.write(intToChar(255));
                socket.emit("setSlider", 255);
                console.log("Turned led on.");

            } else if (value == "ledoff") {
                serialPort.write(" ");
                socket.emit("setSlider", 0);
                console.log("Turned led off.");

            } else {
                console.log("Invalid button press...")
            }
        })

        socket.on("sliderval", function(value) {
            serialPort.write(intToChar(value));
            console.log("Led set value: " + value)
        })

        // Sends signal to draw bandplots on highchart if button 'Add' is pressed
        socket.on("setCritical", function(values) {
            
            if ('upper' in values) {
                console.log('Pressed "set upper": ' + values['upper'])
                socket.emit('upperPlotBand'+values['id'], values['upper'])
            }
            if ('lower' in values) {
                console.log('Pressed "set lower": ' + values['lower'])
                socket.emit('lowerPlotBand'+values['id'], values['lower'])
            }
        })
        socket.on('resetCritical', function(key) {
            console.log('Deleting band plots')
            socket.emit(key, "")
        })

        // Listens to subscription/unsubscription events
        socket.on('subscribe', (submission, ack) => {
            console.log(`Subscription event received for ${submission.email}`)
            fs.readFile('email_adresses.json', 'utf8', (err, data) => {
                if (err) throw err;
                let jsonData = JSON.parse(data);
                var valid = true;
                for (let key in jsonData) {
                    if (key == submission.email) {
                        console.log("email already exists in the file.");
                        valid = false
                        ack(valid); 
                        break 
                    }
                }
                if (valid) {

                    var email = submission.email;
                    delete submission.email;

                    jsonData[email] = submission;
                    jsonData = JSON.stringify(jsonData)
                    fs.writeFile('email_adresses.json', jsonData, (err) => {
                        if (err) throw err;
                        console.log(jsonData + " was written to file.")
                    });
                    ack(valid);
                }
            })
        })

        socket.on('unsubscribe', (email, ack) => {
            console.log(`Unsubscription event received for ${email}`)
            fs.readFile('email_adresses.json', 'utf8', (err, data) => {
                if (err) throw err;
                let jsonData = JSON.parse(data);
                let valid = false
                // find and remove entry
                for (let key in jsonData) {
                    if (key == email) {
                        delete jsonData[key];
                        // write updated data to file
                        fs.writeFile('email_adresses.json', JSON.stringify(jsonData), (err) => {
                            if (err) throw err;
                        });
                        console.log('The file has been updated!');
                        valid = true;
                        ack(valid);
                        break
                    }
                }
                if (!valid){
                    console.log("Email was not found in file.");
                    ack(valid);
                }
            });
        })

    })
}

// -------------------------------------- //
function getSubscribers() {
    try {
        var subscribers = JSON.parse(fs.readFileSync("email_adresses.json"));
        //console.log("Get subscribers: " + subscribers)
    } catch (err) {
        console.log(err)
    }
    return subscribers
}

// Subscriber object: {email: {key: [true or false], data: [['temp',low,high],['humid',low,high]]}}
function hasReachedCritical(comparison) {
    // Gets the subscribers from the JSON format
    var subscribers;
    subscribers = getSubscribers();
    //console.log(JSON.stringify(subscribers))
    
    let responses = {};
    for (let email in subscribers) {
        let values = subscribers[email];
        let response = [];
        for (let key in values) {
            if (key == 'sent' && values[key]) {
                //console.log('Already sent a mail.')
                break;
            }
            if (key == 'data') {
                
                let label = "temp"
                for (let i = 0; i < 2; i++) {
                    
                    if (values[key][i][1] != null && values[key][i][1] > comparison[label]) {
                        response.push(`${values[key][i]} has dipped below threshold!`);
                        
                    }
                    if (values[key][i][2] != null && values[key][i][2] < comparison[label]) {
                        response.push(`${values[key][i]} has jumped above threshold!`);
                    }
                    label = 'humid'
                }
            }
        }
        if (response.length !== 0) {
            console.log(JSON.stringify(subscribers));
            response.push("Please check your greenhouse.");
            responses[email] = response.join('\n');
            
        }
    }

    if (Object.keys(responses).length == 0) {
        return false
    }

    return responses;
}


function sendEmail(critical) {
    // Loop over the emailadresses that are in the critical dictionary and sendn a mail with the contents and date.
    for (let email in critical) {
        var content = critical[email];
        console.log("Sending email to " + email)

        mailer.mailer(email, content)

        fs.readFile('email_adresses.json', 'utf8', (err, data) => {
            if (err) throw err;
            let jsonData = JSON.parse(data);

            // find and remove entry
            for (let key in jsonData) {
                if (key == email) {
                    jsonData[key]["sent"] = true;
                }
            }
            fs.writeFile('email_adresses.json', JSON.stringify(jsonData), (err) => {
                if (err) throw err;
            });
            console.log(email+' status: sent.');
        })
    }
}

function parseData(cleanData) { 
    // cleanData has following format:
    // T...H...L...
    var tempVal = cleanData.substring(2, cleanData.indexOf("H"));
    if ( flag &&tempVal.slice(0,1) == 'T' ) {
        tempVal = tempVal.slice(1)
        flag = false
    }
    var humidVal = cleanData.substring(cleanData.indexOf("H")+1, cleanData.indexOf("L"));
    var lightVal = cleanData.substring(cleanData.indexOf("L")+1, cleanData.length -2);

    var dataEmit = {'temp': tempVal, "humid": humidVal, "light": lightVal};

    return dataEmit
}

function serialEmitter() {

    var portName = "COM4"

    // Set up the serial parser to read data, and serialport to receive from Arduino
    const { SerialPort } = require('serialport')
    const { ReadlineParser } = require('@serialport/parser-readline')
    const parser = new ReadlineParser({delimiter: '\n'})
    
    serialPort = new SerialPort({
        path:portName,
        baudRate: 9600,
        // defaults for Arduino serial communication
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        flowControl: false
    });
    
    serialPort.pipe(parser)

    serialPort.on("open", function() {
        
        var cleanData = "";
        var readData = "";

        parser.on('data', function(data){ // Parses the incoming arduino data
        
            readData += data.toString();

            cleanData = parseData(readData);
            readData = "";
            
            var x = (new Date()).getTime();
  
            // Continuusly look at whether the email adress json file is changed (due to new subscriptions)
            // Perform a check here if values of some subscriber are reached. If so, send an email immediately to the subscribers.
            // Only do this ones for each subscriber so the mailboxes do not get flooded.
            /*fs.watch('email_adresses.json', (event, filename) => {
                console.log("A modification was made to the subscription data object.")

                subscribers = JSON.parse(fs.readFileSync("email_adresses.json"));
            })*/

            critical = hasReachedCritical(cleanData)
            if (critical) {
                sendEmail(critical)
            }

            // Send captured data to client
            socketServer.emit("updateData", {
                x: x,
                y: cleanData
            });         
        })
    })
    
}

exports.start = startServer