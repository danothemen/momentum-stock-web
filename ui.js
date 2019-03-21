import React from "react";
import ReactDOM from "react-dom";
import Positions from "./components/positioncomponent";
import * as SocketClient from "./websocketclient";

class Dashboard extends React.Component {
  posUpdate(pos, myself){
    myself.setState({positions:pos});
  }
  componentDidMount(){
    SocketClient.setComponentRef(this);
    SocketClient.onPositionUpdate(this.posUpdate);
    SocketClient.connect();
  }
  render() {
    return <Positions data={this.state ? this.state.positions : ""} />;
  }
}

var mountNode = document.getElementById("app");
ReactDOM.render(<Dashboard />, mountNode);