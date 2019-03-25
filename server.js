const express = require('express');
const app = express();
const port = 4321;
const trader = require("./trader");

app.use(express.static("dist"));
var expressWs = require('express-ws')(app);
app.ws('/', function(ws, req) {
    ws.on('message', function(msg) {
      console.log(msg);
      var toSend = trader.getPositions();
      //ws.send(JSON.stringify({type:"positions",data:toSend}));
    });
    console.log('socket');
  });

trader.PositionsChanged(function(positions){
    //console.log(positions);
    expressWs.getWss().clients.forEach(client=>{
        client.send(JSON.stringify({type:"positions",data:positions}));
    });
});
trader.MACDUpdate(function(macd,symbol){
  //console.log(positions);
  expressWs.getWss().clients.forEach(client=>{
      client.send(JSON.stringify({type:"macd",data:macd,symbol:symbol}));
  });
});
trader.OrderUpdate(function(orders){
  expressWs.getWss().clients.forEach(client=>{
    client.send(JSON.stringify({type:"order",data:orders}));
  });
});
trader.SubscribeToPositions();
trader.StartTrader();
app.listen(port, () => console.log(`Example app listening on port ${port}!`));