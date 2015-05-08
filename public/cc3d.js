$(function() {
var dps = [];
for(var i=0;i<10;i+=0.01) {
dps.push(Math.sin(i));
}
var smoothie = new SmoothieChart({ minValue: -180, maxValue: 180});
smoothie.streamTo(document.getElementById("chartContainer"));

var rollseries = new TimeSeries();
var pitchseries = new TimeSeries();
var yawseries = new TimeSeries();
smoothie.addTimeSeries(rollseries,{strokeStyle:'red'});
smoothie.addTimeSeries(pitchseries,{strokeStyle:'green'});
smoothie.addTimeSeries(yawseries,{strokeStyle:'blue'});

  function clamp(v) {
    while(v < 0) {
      v = 360 + v;
    }
    while(v > 360) {
      v = v - 360;
    }
    return v;
  }

    var socket = io();
    socket.on('AttitudeState', function(data) {
      var t = new Date().getTime();
      //data.Roll  = clamp(data.Roll);
      //data.Pitch  = clamp(data.Pitch);
      //data.Yaw  = clamp(data.Yaw);
      rollseries.append(t,data.Roll);
      pitchseries.append(t,data.Pitch);
      yawseries.append(t,data.Yaw);

      $('#attitude').html(JSON.stringify(data,null,2));
    });
});
