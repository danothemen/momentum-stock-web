import React from "react";

class Orders extends React.Component {
  componentDidMount(){

  }
  render() {
      console.log(this.props);
    if(this.props.data == "" || this.props.data == undefined || this.props.data == null){
      return <div></div>
    }
    else{
      return (<table className="ordersTable">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Created At</th>
            <th>Buy/Sell</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(this.props.data).map(pos=>{
            return (
            <tr>
              <td>{pos}</td>
              <td>{this.props.data[pos].created_at}</td>
              <td>{this.props.data[pos].side}</td>
              <td>{this.props.data[pos].qty}</td>
              <td>{this.props.data[pos].limit_price}</td>
            </tr>
            )
          })}
        </tbody>
      </table>);
    }
  }
}
export default Orders;