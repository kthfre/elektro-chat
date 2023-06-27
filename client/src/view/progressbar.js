import React, { useState, useEffect } from "react";

/**
 * Handles the progressbar view
 * @returns the progressbar view.
 */

const ProgressbarView = ({enable, step, totalSteps}) =>  {
  let [currentProgress, setCurrentProgress] = useState([]);

  useEffect(() => {
    let arr = [];
    for (let i = 0; i < totalSteps; i++) {
      arr.push(i < step - 1 ? true : false);
    }

    setCurrentProgress(arr);
  }, [step, totalSteps]);

  return (
     <div className="progress-container">
      {enable && <div className="progress-inner">
      {currentProgress.map((step, i) => {
        return <div className={currentProgress[i] ? "progress-box done" : "progress-box"} key={i}></div>
      })}
      </div>}
      {enable && <div className="progress-inner-separated">
      <div className="progress-box-inner">Step {step - 1} / {totalSteps} | {(((step - 1) / totalSteps) * 100).toFixed(0)}%</div>
      </div>}
    </div>
  );
}

export default ProgressbarView;