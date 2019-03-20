const express = require('express');
const app = express();
const port = 4321;
const trader = require("./trader");

app.use(express.static("dist"));
trader.PositionsChanged(function(positions){
    console.log(positions);
});
trader.SubscribeToPositions();

app.listen(port, () => console.log(`Example app listening on port ${port}!`));