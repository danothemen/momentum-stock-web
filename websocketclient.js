var onPositions;
var onPrice;
var onMacd;
var component;
function connect() {
    client = new WebSocket("ws://localhost:4321");
    client.onmessage = function (event) {
        console.log(event.data);
        var msg = JSON.parse(event.data);
        switch (msg.type) {
            case "positions":
                if (typeof onPositions == "function") {
                    onPositions(msg.data,component);
                }
                break;
            case "macd":
                if(typeof onMacd == "function"){
                    onMacd(msg.data,msg.symbol,component);
                }
                break;
        }
    }
}
function setComponentRef(reactcomp){
    component = reactcomp;
}
function onPositionUpdate(del) {
    onPositions = del;
}
function onMacd(del){
    onMacd = del;
}
module.exports.connect = connect;
module.exports.onPositionUpdate = onPositionUpdate;
module.exports.setComponentRef = setComponentRef;
module.exports.onMacd = onMacd;
