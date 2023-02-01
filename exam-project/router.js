function route(handle, pathname,response,request,debug) {
    
    // handle -> dict initialized in index.js
    // handle contains possible pathname routes
    // This file 'router.js' forwards the route to its handler
    // The actual request is handled in request handler according to the provided route

    if (typeof handle[pathname] === 'function') {
        console.log("Routing request for " + pathname);
        return handle[pathname](response,request); // function in request-handlers.js
        } 
    
    else { // if a http request is made that is not handled, generate 404 html page
        console.log("No handler for this path: " + pathname)
        response.writeHead(404, {"Content-Type": "text/plain"});
        response.write("404 Not found");
        response.end();
    }
}

exports.route = route;