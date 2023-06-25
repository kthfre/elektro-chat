import React, { useState, useEffect } from "react";

/**
 * Handles the information view
 * @returns the information view.
 */

const InformationView = ({enable, conf}) =>  {
  let [content, setContent] = useState("");
  let [timerHistory, setTimerHistory] = useState([]);

  useEffect(() => {
    if (enable) {
      clean();
      run();
    }
  }, [enable]);

  const clean = () => {
    if (timerHistory.length) {
      setContent("");
      for (let i = 0; i < timerHistory.length; i++) {
        clearTimeout(timerHistory[i]);
      }

      setTimerHistory([]);
    }
  }

  const run = () => {
    const {msgs, delay} = conf;
    setContent(msgs[0]);

    for (let i = 1; i < msgs.length; i++) {
      setTimeout(() => {
        setContent(msgs[i]);
      }, delay * i);
    }

    setTimeout(() => {
      clean();
    }, delay * msgs.length);
  }

  return (
     <div className="information-container">
      {enable &&
      <div className="information-inner">
        <div className="information-box head">INFORMATION</div>
        <div className="information-box content">{content}</div>
      </div>}
    </div>
  );
}

export default InformationView;