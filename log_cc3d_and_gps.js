var uavtalk_packet = require("./uavtalk_packet");
var uavtalk_decode = require("./uavtalk_decodejson");
var net = require('net');

var cc3d_tcp = new net.Socket();
cc3d_tcp.connect(12345,"localhost", function() {
  //console.log("cc3d connected to tcp gateway");
});

var uavtalk_decoder = uavtalk_decode.decoder("../uavtalk_json");

cc3d_tcp.on("data", uavtalk_packet.parser(function(packet) {
  if(!uavtalk_decoder.ready()) {
    return;
  }
  var t = new Date();
  var data = uavtalk_decoder.decode(packet);
  if(!data) {
    return;
  }
  data.timestamp = t;
  console.log(JSON.stringify(data));
}));


var gpsd = require("node-gpsd");
var listener = new gpsd.Listener();
listener.connect(function() {
//console.log("connected");
    listener.watch();
    listener.on('raw', function(tpv) {
      try {
        var parsed = JSON.parse(tpv);
        var t = new Date();
        parsed.timestamp = t;
        console.log(JSON.stringify(parsed));
      } catch(e) {
      }
    });
});
