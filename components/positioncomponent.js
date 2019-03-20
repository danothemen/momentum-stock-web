import React from "react";

class Positions extends React.Component {
  componentDidMount(){

  }
  render() {
    return <div>Hello {JSON.stringify(this.props.data)}</div>;
  }
}
export default Positions;