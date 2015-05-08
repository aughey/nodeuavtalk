var EventEmitter = require('events').EventEmitter;
var uavtalk_packet = require("./uavtalk_packet");
var uavtalk_decode = require("./uavtalk_decode");
var SerialPort = require("serialport").SerialPort;
var _ = require('underscore');
var net = require('net');

var cc3d_tcp = new net.Socket();
cc3d_tcp.connect(12345,"localhost", function() {
  console.log("cc3d connected to tcp gateway");
});

var dataemitter = new EventEmitter();
function printhandler(data) {
  console.log(data);
}

function do_emit(data) {
  dataemitter.emit(data.name,data);
}

var handlers = {
  "ManualControlCommand": printhandler,
  "AttitudeState": do_emit,
};

var uavtalk_decoder = uavtalk_decode.decoder("../../OpenPilot/shared/uavobjectdefinition");
var cc3d_parser = uavtalk_packet.parser(function(packet) {
  var data = uavtalk_decoder(packet);
  if(!data) {
    return;
  }
  if(handlers[data.name]) {
    handlers[data.name](data);
  }
});
cc3d_tcp.on("data", function(data) {
  cc3d_parser(data);
});


var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

io.on('connection', function(socket){
  console.log('a user connected');
  var forward = function(data) {
    socket.emit(data.name,data);
  }
  dataemitter.on('AttitudeState', forward);
  socket.on('disconnect', function() {
    console.log("a user disconnected");
    dataemitter.removeListener('AttitudeState', forward);
  });
});

app.use(express.static('public'));

http.listen(3000, function(){
  console.log('listening on *:3000');
});

