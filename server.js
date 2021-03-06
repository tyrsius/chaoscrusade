var fs = require('fs'),
    dir = __dirname + '/client/',
    port = process.env.PORT || 3000,
    socketPort = process.env.SOCKET_PORT || port;

require('sugar');

var express = require("express"),
    app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server);

server.listen(port);

app.sockets = require('./app_modules/sockets')(io.sockets);
app.fs = fs;


//Configure
app.configure(function() {
    app.use(require("./app_modules/security/allowCors"));

    app.set('views', __dirname + '/views/');
    app.engine('.html', require("./app_modules/htmlEngine.js")({ port: socketPort}));
    app.set('view engine', 'html');

    app.use(app.sockets.middleware);

    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express['static'](dir));
    app.use(app.router); 
});

//Security
app.hasher = require("./app_modules/security/hasher");
app.tokenAuth = require("./app_modules/security/authToken");
app.rolesAuth = require("./app_modules/security/authRoles");
app.errors = require("./app_modules/errors");

//Database
app.db = require('./app_modules/db');

//Socket Handler
app.socketService = require('./app_modules/socketService')(app);
//console.log(app.socketService.insert);

// Routes
require('./routes')(app);

//Start Listening
//app.listen(port);