var onPositions;
function connect() {
    client = new WebSocket("ws://localhost:4321");
    client.onmessage = function (event) {
        console.log(event.data);
        var msg = JSON.parse(event.data);
        switch (msg.type) {
            case "positions":
                if (typeof onPositions == "function") {
                    onPositions(msg.data);
                }
                break;
        }
    }
}
function onPositionUpdate(del) {
    onPositions = del;
}
module.exports.connect = connect;
module.exports.onPositionUpdate = onPositionUpdate;
