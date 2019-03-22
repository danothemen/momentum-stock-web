import React from "react";
import ReactDOM from "react-dom";
import Positions from "./components/positioncomponent";
import MACDDisplay from "./components/macddisplay";
import * as SocketClient from "./websocketclient";

class Dashboard extends React.Component {
  posUpdate(pos, myself){
    myself.setState({positions:pos});
  }
  macdUpdate(macd,symbol,myself){
    for(var i = 0; i < this.state.positions.length; i++){
      if(this.state.positions.symbol == symbol){
        this.state.positions.macddata = macd;
        myself.setState(this.state);
      }
    }
  }
  componentDidMount(){
    SocketClient.setComponentRef(this);
    SocketClient.onPositionUpdate(this.posUpdate);
    SocketClient.onMacd(this.macdUpdate);
    SocketClient.connect();
  }
  render() {
    return (
    <div>
      <Positions data={this.state ? this.state.positions : ""} />
      {this.state.positions.map(pos =>{
        return <MACDDisplay symbol={pos.symbol} macddata={pos.macddata}/>
      })}
    </div>);
  }
}

var mountNode = document.getElementById("app");
ReactDOM.render(<Dashboard />, mountNode);