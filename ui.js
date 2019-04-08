import React from "react";
import ReactDOM from "react-dom";
import Positions from "./components/positioncomponent";
import MACDDisplay from "./components/macddisplay";
import Orders from "./components/openorders";
import AccountInfo from "./components/accountinfo";
import * as SocketClient from "./websocketclient";

class Dashboard extends React.Component {
  accountUpdate(account,myself){
    myself.state.account = account;
    myself.setState(myself.state);
  }
  posUpdate(pos, myself){
    if(myself.state && myself.state.positions){
    for(var i = 0;i < pos.length; i++){
      for(var y =0; y < myself.state.positions.length; y++){
        if(myself.state.positions[y].symbol == pos[i].symbol){
          if(myself.state.positions[y].macddata){
            pos[i].macddata = myself.state.positions[y].macddata;
          }
        }
      }
    }
  }
    pos.sort(function(a,b){
      var textA = a.symbol.toUpperCase();
      var textB = b.symbol.toUpperCase();
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });
    if(myself.state){
      myself.state.positions = pos;
      myself.setState(myself.state);
    }
    else{
      myself.setState({positions:pos});
    }
  }
  orderUpdate(orders,myself){
    myself.state.orders = orders;
    myself.setState(myself.state);
  }
  macdUpdate(macd,symbol,myself){
    console.log("Macd Update");
    if(macd==undefined) console.log(macd);
    if(myself.state){
    for(var i = 0; i < myself.state.positions.length; i++){
      //console.log(typeof macd);
      if(myself.state.positions[i].symbol == symbol && macd){
        myself.state.positions[i].macddata = macd;
      }
    }
    myself.state.positions.sort(function(a,b){
      var textA = a.symbol.toUpperCase();
      var textB = b.symbol.toUpperCase();
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });
    myself.setState(myself.state);
  }
  }
  componentDidMount(){
    SocketClient.setComponentRef(this);
    SocketClient.onPositionUpdate(this.posUpdate);
    SocketClient.onMacd(this.macdUpdate);
    SocketClient.onOrders(this.orderUpdate);
    SocketClient.onAccount(this.accountUpdate);
    SocketClient.connect();
  }
  render() {
    if(!this.state){
      return (<div></div>);
    }
    return (
      
    <div>
      <AccountInfo data={this.state ? this.state.account : ""}/>
      <div className="tables">
        <Positions data={this.state ? this.state.positions : ""} />
        <Orders data={this.state ? this.state.orders : ""} />
      </div>
      <div className="charts">
       {this.state.positions.map(pos =>{
         //console.log(pos.macddata);
         if(pos.macddata){
          return <MACDDisplay symbol={pos.symbol} pos={pos} macddata={pos.macddata}/>
         }
         else{
           return <div>{JSON.stringify(Object.keys(pos))}</div>
         }
      })}
      </div>
    </div>);
  }
}

var mountNode = document.getElementById("app");
ReactDOM.render(<Dashboard />, mountNode);