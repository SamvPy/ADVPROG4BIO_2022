// This file handles which html file should be read on a certain http request

var fs = require('fs');

function loadHome(response) {
    console.log("Request handler for home page.");
    var htmlHome = fs.readFileSync(__dirname + '/page/charts.html');
    response.end(htmlHome);
}

exports.home = loadHome;