// This file brings the several javascripts together

var requestHandlers = require("./request-handlers");
var server = require("./server");
var router = require("./router")


var handle = {}
handle["/"] = requestHandlers.home;

server.start(router.route, handle)