import React, { useState, useEffect } from "react";

/**
 * Handles the details view
 * @returns the details view.
 */

const DetailsView = ({problemDetails, setInformationDisplay}) =>  {
  let [probDetails, setProbDetails] = useState(null);

  useEffect(() => {
    if (problemDetails) {
      setProbDetails({...problemDetails});

      if (problemDetails.type === "MultiAnswer") {
        informationDisplay("MultiAnswer");
      }
    } else {
      setProbDetails(null);
    }
  }, [problemDetails]);

  const informationDisplay = (type) => {
    let delay, msgs;

    if (type === "MultiAnswer") {
      delay = 5000;
      msgs = ["Detta är ett flervalsproblem...", "Flervalsproblem kräver en mappningsprocess av följdfrågor."];
    }
    
    setInformationDisplay(msgs, delay);
  }

  return (
     <div className="details-container">
      {probDetails &&
      <div className="details-inner">
        <div className="details-box head">Problemdetaljer</div>
        <div className="details-box">ID: {probDetails.id}</div>
        <div className="details-box">Svårighetsgrad: {probDetails.difficulty === "simple" ? "enkel" : "avancerad"}</div> 
        <div className="details-box">Typ: {probDetails.type === "SingleAnswer" ?  "enskild uppgift" : "flervalsproblem"}</div>
      </div>}
    </div>
  );
}

export default DetailsView;