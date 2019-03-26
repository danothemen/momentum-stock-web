import React from "react";

class AccountInfo extends React.Component {
  componentDidMount(){

  }
  render() {
      console.log(this.props);
    if(this.props.data == "" || this.props.data == undefined || this.props.data == null){
      return <div></div>
    }
    else{
      return (<div className="accountinfo"><div className="accountproperty">Buying Power: {this.props.data.buying_power}</div><div className="accountproperty">Account Value: {this.props.data.portfolio_value}</div></div>);
    }
  }
}
export default AccountInfo;