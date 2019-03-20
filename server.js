const express = require('express');
const app = express();
const port = 4321;
const trader = require("./trader");

app.use(express.static("dist"));
var expressWs = require('express-ws')(app);
app.ws('/', function(ws, req) {
    ws.on('message', function(msg) {
      console.log(msg);
    });
    console.log('socket');
  });

trader.PositionsChanged(function(positions){
    console.log(positions);
    expressWs.getWss().clients.forEach(client=>{
        client.send(JSON.stringify({type:"positions",data:positions}));
    });
});
trader.SubscribeToPositions();

app.listen(port, () => console.log(`Example app listening on port ${port}!`));