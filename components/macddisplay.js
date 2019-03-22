import React from "react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  } from 'recharts';
class MACDDisplay extends React.Component {
  componentDidMount(){

  }
  render() {
    var symbol = this.props.symbol;
    var macddata = this.props.macddata;
    var chartdata = [];
    for(var i = 0; i < this.props.macddata.MACD.length; i++){
        chartdata.push({
            macd:this.props.macddata.MACD[i],
            histogram:this.props.macddata.histogram[i],
            signal:this.props.macddata.signal[i]
        });
    }
    return (
        <LineChart
          width={500}
          height={300}
          data={chartdata}
          margin={{
            top: 5, right: 30, left: 20, bottom: 5,
          }}
        >
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="signal" stroke="#8884d8" activeDot={{ r: 8 }} />
          <Line type="monotone" dataKey="histogram" stroke="#82ca9d" />
        </LineChart>
      );
  }
}
export default MACDDisplay;