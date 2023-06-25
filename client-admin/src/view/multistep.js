import React, { useState, useEffect } from "react";

/**
 * Handles the multistep view
 * @returns the multistep view.
 */

const MultistepView = ({mapFulfilled, multiCache, setMultiCache}) =>  {
  let [activeStep, setActiveStep] = useState(0);
  let [mapLetters, setMapLetters] = useState([]);

  useEffect(() => {
    if (mapFulfilled && mapFulfilled.mappedLetters) {
      setMapLetters([...mapFulfilled.mappedLetters]);
    }
  }, [mapFulfilled]);

  const doSetActiveStep = i => {
    let obj = {...multiCache};
    obj.active = mapLetters[i];

    setActiveStep(i);
    multiCache.setterOne(multiCache[obj.active]);
    multiCache.setterTwo(multiCache[obj.active]);
    setMultiCache(obj);
  }

  return (
    <div className="multistep-container">
      <div className="multistep-inner">
        <h3>Stored parts</h3>
      </div>
      <div className="multistep-inner">
        {mapLetters.map((letter, i) => <div className={letter === mapLetters[activeStep] ? "multistep-item active" : "multistep-item"} onClick={() => doSetActiveStep(i)} key={i}>{letter}</div>)}
      </div>
    </div>
  );
}

export default MultistepView;