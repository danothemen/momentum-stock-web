import React from "react";

class Positions extends React.Component {
  componentDidMount(){

  }
  render() {
    if(this.props.data == ""){
      return <div></div>
    }
    else{
      return (<table className="positionsTable">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Exchange</th>
            <th>Qty</th>
            <th>Cost Basis</th>
            <th>Market Value</th>
            <th>Avg. Buy</th>
            <th>Current Price</th>
            <th>Stop Price</th>
            <th>MACD</th>
          </tr>
        </thead>
        <tbody>
          {this.props.data.map(pos=>{
            return (
            <tr className={pos.market_value > pos.cost_basis ? "profit" : "loss"}>
              <td>{pos.symbol}</td>
              <td>{pos.exchange}</td>
              <td>{pos.qty}</td>
              <td>{pos.cost_basis}</td>
              <td>{pos.market_value}</td>
              <td>{pos.avg_entry_price}</td>
              <td>{pos.current_price}</td>
              <td>{pos.stop_price}</td>
              <td className={pos.macd > 0 ? "momentumup":"momentumdown"}>{pos.macd}</td>
            </tr>
            )
          })}
        </tbody>
      </table>);
    }
  }
}
export default Positions;