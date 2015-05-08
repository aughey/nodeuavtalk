var uavtalk_packet = require("./uavtalk_packet");
var uavtalk_decode = require("./uavtalk_decode");
var net = require('net');

var cc3d_tcp = new net.Socket();
cc3d_tcp.connect(12345,"localhost", function() {
  console.log("cc3d connected to tcp gateway");
});

var uavtalk_decoder = uavtalk_decode.decoder("../../OpenPilot/shared/uavobjectdefinition");

var heard = {};

cc3d_tcp.on("data", uavtalk_packet.parser(function(packet) {
  var t = new Date();
  var data = uavtalk_decoder(packet);
  if(!data) {
    return;
  }
  var info = heard[data.name];
  if(!info) {
    info = {
      last: t,
      count: 0
    }
    heard[data.name] = info;
  }
  info.count++;
  var diff = t - info.last;
  if(diff > 1000) {
    var hz = info.count / (diff / 1000.0);
    console.log(data.name + ": " + hz + "Hz");
    info.count = 0;
    info.last = t;
  }
}));
