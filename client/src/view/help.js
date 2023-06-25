import React, { useState, useEffect } from "react";

/**
 * Handles the help view
 * @returns the help view.
 */

// const URI = window.location.href;
const URI = "http://localhost:3003/";

const HelpView = ({}) =>  {
  let [enable, setEnable] = useState(false);
  const contentList = ["Under dialogens gång visas som mest 4 informationsboxar nedan.", "Dialogfas anger vad som händer i denna del av dialogen.", "Problemdetaljer anger uppgiftens egenskaper.", "Problemsteg anger potentiella steg man kan få hjälp med om det är ett avancerat problem.", "Vägval bekräftar de val du har gjort.", "Resetknappen startar om chatsessionen, alternativt kan man ladda om sidan.", "Om botten vid något tillfälle inte ger något svar alls försöke formulera dig lite annorlunda då den sannolikt inte kan förstå dina intentioner."];

  const toggleHelp = el => {
    setEnable(!enable);
  }

  return (
     <div className="help-container">
      <div className="help-inner">
        <div className="help-box head"><div>Hjälp mig!</div><div><input type="button" onClick={toggleHelp} value={enable ? "<" : ">"} /></div></div>
        {enable && <div className="help-box content"><img src={URI + "images/icons8-ai-tr.gif"} alt="banana" /></div>}
        {enable && <div className="help-box content"><ul>{contentList.map((cont, i) => <li key={i}>{cont}</li>)}</ul></div>}
      </div>
    </div>
  );
}

export default HelpView;