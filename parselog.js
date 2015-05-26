var fs = require('fs');
var readline = require('readline');

var rd = readline.createInterface({
  input: fs.createReadStream('all.log'),
  output: process.stdout,
  terminal:false
});


rd.on('line', function(line) {
  line = JSON.parse(line);
});
