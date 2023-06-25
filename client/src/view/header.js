import React from "react";

/**
 * Handles the header view
 * @returns the header view.
 */

// const URI = window.location.href;
const URI = "http://localhost:3003/";

const HeaderView = ({props}) => {

  return (
    <div className="header">
      <div className="header-logo"><img src={URI + "images/icons8-mind-map-tr.gif"} alt="banana" /></div>
      <div className="header-title">Välkommen till ElektroCHAT...</div>
      <div className="header-logo"></div>
    </div>
  );
}

export default HeaderView;