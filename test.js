var SerialPort = require("serialport").SerialPort;
var _ = require('underscore');
var net = require('net');

console.log("Reading object defs...");
var fs = require('fs');
var bufferpack = require('bufferpack');
var parser = require('libxml-to-js');
var path = require('path');
var dir = "../../OpenPilot/shared/uavobjectdefinition";

var uavobjects = {}

fs.readdir(dir, function(err, files){
	if (err) throw err;

	for (var i in files){
		var filename = path.join(dir,files[i]);
		fs.readFile(filename, function(err, data){
			if (err) throw err;

			// Some objects don't parse, screwem
			try {
  			  parser(data, parse_object_def);
			} catch(e) {
			  console.log("Couldn't parse " + filename);
			}
		});
	}

	console.log("Object def read complete");
});

function uavtalk_parser() {
  var state = 0;
  var message = {
    type: null,
        length: null,
        object_id: null,
  instance_id: null,
  timestamp: null,
  data: null,
  crc: null
  };
  var types = {
    0x0: "OBJ",
    0x1: "OBJ_REQ",
    0x2: "OBJ_ACK",
    0x3: "OBJ_ACK",
    0x4: "OBJ_NAK",
  };
  return function(emitter,data) {
    var index = 0;
    var len = data.length;
    while(index < len) {
      var byte = data[index] & 0xff;
      if(state === 0) {
        // waiting for sync.
        if(byte !== 0x3c) {
          ++index;
          continue;
          console.log("Missed sync");
        }
      } else if(state === 1) {
        // Getting message type
        message.type = types[byte & 0x0f];
        if(!message.type) {
          console.log("Unknown message type " + byte.toString(16));
	  ++index;
	  state = 0;
	  continue;
        }
	if(byte & 0x80) {
	  throw("Didn't expect a timestamped object");
	}
      } else if(state === 2) {
        // len byte 1
        message.length = byte;
      } else if(state === 3) {
        // len byte 2
        message.length += lshift(byte,8);
        if(message.length < 10) {
            message.data_length = 0;
        } else {
            message.data_length = message.length - 10;
        }
      } else if(state === 4) {
        // object id 0
        message.object_id = byte;
      } else if(state === 5) {
        // object id 1
        message.object_id += lshift(byte,8);
      } else if(state === 6) {
        // object id 2
        message.object_id += lshift(byte,16);
      } else if(state === 7) {
        // object id 3
        message.object_id += lshift(byte,24);
      } else if(state === 8) {
        // object id 3
        message.instance_id = byte;
      } else if(state === 9) {
        // object id 3
        message.instance_id += lshift(byte,8);
        message.data = new Buffer(message.data_length);
	message.data_index = 0;
      } else if(state === 10) {
        // Data
	// Copy as much as we can in one fell swoop
	var tocopy = min(len-index,message.data_length);
	data.copy(message.data,message.data_index,index,index + tocopy);
	message.data_length -= tocopy;
	message.data_index += tocopy;
	index += tocopy;
	if(message.data_length === 0) {
          emitter.emit("data",message);
          state = 0;
	  ++index;
	}
	continue;
      }
      ++state;
      ++index;
    }
  }
}

//var cc3d_serial = new SerialPort("/dev/ttyAMA0", {
//  baudrate: 57600,
 // parser: uavtalk_parser()
//});
var cc3d_tcp = new net.Socket();
cc3d_tcp.connect(12345,"localhost", function() {
  console.log("cc3d connected to tcp gateway");
});
var EventEmitter = require('events').EventEmitter;
var cc3d_serial = new EventEmitter;
var cc3d_parser = uavtalk_parser()
cc3d_tcp.on("data", function(data) {
  cc3d_parser(cc3d_serial,data);
});

function unpack_obj(obj,data) {
  var out = {};
  var unpacked = bufferpack.unpack(obj.unpackstr,data);
  if(!unpacked) {
    console.log("Couldn't unpack " + obj.name);
    return null;
  }
  _.each(obj.fields, function(f,index) {
    out[f.name] = unpacked[index];
  });
  return out;
}

function printhandler(data) {
  //console.log(data);
}

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

io.on('connection', function(socket){
  console.log('a user connected');
  var forward = function(data,name) {
    socket.emit(name,data,name);
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

var dataemitter = new EventEmitter();

function do_emit(data,name) {
  dataemitter.emit(name,data,name);
}

var handlers = {
  "ManualControlCommand": printhandler,
  "AttitudeState": do_emit,
};

  cc3d_serial.on("data", function(packet) {
    
    var obj = uavobjects[packet.object_id];
    if(!obj) {
      //console.log("Failed to find object");
      //console.log(packet);
    }
    if(obj && handlers[obj.name]) {
      var objdata = unpack_obj(obj,packet.data);
      handlers[obj.name](objdata,obj.name);
    }
  });

function lshift(num, bits) {
  //return num << bits;
  return num * Math.pow(2,bits);
}

function min(a,b) {
  if(a < b) {
    return a;
  } else {
    return b;
  }
}

/**
 * Calculate the unique object ID based on the object information.
 * The ID will change if the object definition changes, this is intentional
 * and is used to avoid connecting objects with incompatible configurations.
 * The LSB is set to zero and is reserved for metadata
 */
function calculateID(info){
	// Hash object name
	var hash = updateHash(info.name, 0);

	// Hash object attributes
	hash = updateHash(info.isSettings, hash);
	hash = updateHash(info.isSingleInst, hash);

	// Hash field information
	for (var n = 0; n < info.fields.length; n++){
		hash = updateHash(info.fields[n].name, hash);
		hash = updateHash(info.fields[n].numElements, hash);
		hash = updateHash(info.fields[n].type, hash);

		if (info.fields[n].type == 7){ // enum
			var options = info.fields[n].options;
			for (var m = 0; m < options.length; m++){
				hash = updateHash(options[m], hash);
			}
		}
	}

	// Done
	return hash & 0xFFFFFFFE;
}

function parse_object_def(err, result){
	if (err) throw err;
	//console.log(result.object);

	//if (result.object['@'].name != 'GCSTelemetryStats') return;
	var info = {
		name: result.object['@'].name,
		isSettings: result.object['@'].settings == 'true' ? 1 : 0,
		isSingleInst: result.object['@'].singleinstance == 'true' ? 1 : 0,
		description: result.object.description,
		fields: []
	};

	var unpackstr = "<";

	for (var i in result.object.field){
		var field = result.object.field[i];
		if (field['@']) field = field['@']; // wtf?

 		if(!field.name) {
		  continue;
		}

		var hash = {
			name: field.name,
			numElements: field.elements ? parseInt(field.elements, 10) : 0,
			type: field.type,
			options: field.options ? field.options.split(',') : []
		}

		switch (hash.type){
			case "int8":
				hash.numBytes = 1;
				hash.type = 0;
				unpackstr += "b";
				break;
			case "int16":
				hash.numBytes = 2;
				hash.type = 1;
				unpackstr += "h";
				break;
			case "int32":
				hash.numBytes = 4;
				hash.type = 2;
				unpackstr += "i";
				break;
			case "uint8":
				hash.numBytes = 1;
				hash.type = 3;
				unpackstr += "B";
				break;
			case "uint16":
				hash.numBytes = 2;
				hash.type = 4;
				unpackstr += "H";
				break;
			case "uint32":
				hash.numBytes = 4;
				hash.type = 5;
				unpackstr += "I";
				break;
			case "float":
				hash.numBytes = 4;
				hash.type = 6;
				unpackstr += "f";
				break;
			case "enum":
				hash.numBytes = 1;
				hash.type = 7;
				unpackstr += "B";
				break;
			default:
				throw("Unknown field type: " + hash.type);
				break;
		}

		info.fields.push(hash);
	}
	info.unpackstr = unpackstr;

	info.fields.sort(fieldTypeLessThan);

	var id = calculateID(info) >> 0 >>> 0; // Calc id, convert to unsigned int: http://ask.metafilter.com/208403/What-kind-of-magic-does-QStringsetNum-do#3005095
	info.id = id;
	//if (info.name == 'GCSTelemetryStats') console.log(info);
	uavobjects[id] = info;
}

function fieldTypeLessThan(a, b){
	return a.numBytes < b.numBytes;
}

/**
 * Shift-Add-XOR hash implementation. LSB is set to zero, it is reserved
 * for the ID of the metaobject.
 *
 * http://eternallyconfuzzled.com/tuts/algorithms/jsw_tut_hashing.aspx
 */
function updateHash(value, hash){
	//console.log("Typeof %s is %s", value, typeof(value));
	if (typeof(value) == 'number'){
		var hashout = (hash ^ (lshift(hash, 5) + (hash>>>2) + value));
		//console.log("Hash of %d + %d is: %d", hash, value, hashout);
		return hashout;
	}
	else{
		var hashout = hash;
		//console.log("Hashing %s", value);
		for (var n = 0; n < value.length; n++){
			hashout = updateHash(value.charCodeAt(n), hashout);
			//console.log("Hash of %d: %d is %s", n, value.charCodeAt(n), hashout);
		}

		return hashout;
	}
}


