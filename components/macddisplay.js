import React from "react";
import {
    LineChart, Line, XAxis,YAxis,Text,Legend
  } from 'recharts';
class MACDDisplay extends React.Component {
  componentDidMount(){

  }
  render() {
    var symbol = this.props.symbol;
    var macddata = this.props.macddata;
    var chartdata = [];
    for(var i = this.props.macddata.MACD.length - 100; i < this.props.macddata.MACD.length; i++){
        chartdata.push({
            macd:this.props.macddata.MACD[i],
            histogram:this.props.macddata.histogram[i],
            signal:this.props.macddata.signal[i],
            zero:0
        });
    }
    return (
        <div className={"chartcontainer "+(this.props.pos.macd > 0 ? "" : "warnborder")}>
          <div className="symbolInfoContainer">
            <p className="symbolLabel">{symbol}</p>
            <p className="symbolLabel">Cost Basis: {this.props.pos.avg_entry_price}</p>
            <p className="symbolLabel">Price: {this.props.pos.current_price}</p>
            <p className="symbolLabel">Stop: {this.props.pos.stop_price}</p>
          </div>
        <LineChart
          isAnimationActive="false"
          width={500}
          height={300}
          data={chartdata}
          margin={{
            top: 5, right: 30, left: 20, bottom: 5,
          }}
        >
          
          <XAxis dataKey="name" />
          <YAxis />
          <Legend />
          <Line type="linear" isAnimationActive={false} dot={false} dataKey="signal" stroke="#8884d8" activeDot={{ r: 8 }} />
          <Line type="linear" isAnimationActive={false} dot={false} dataKey="histogram" stroke="#82ca9d" />
          <Line type="linear" isAnimationActive={false} dot={false} dataKey="macd" stroke="#FF0000" />
          <Line type="linear" isAnimationActive={false} dot={false} dataKey="zero" stroke="#000000" />
        </LineChart>
        </div>
      );
  }
}
export default MACDDisplay;