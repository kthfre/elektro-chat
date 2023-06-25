import React, { useState, useEffect } from "react";

/**
 * Handles the form view
 * @returns the form view.
 */

const FormView = ({modules, setConf, setConfOptions, setMapFulfilled}) =>  {
  let [index, setIndex] = useState(0);
  let [prevIndex, setPrevIndex] = useState(null);
  let [click, setClick] = useState(false);
  let [choices, setChoices] = useState([]);

  const options = [
    {choice: true, description: "type of insertion?", opts: ["theory text", "problem"], optsKey: ["type:theory", "type:problem"]},
    [null, {description: "type of problem?", opts: ["single answer", "multi answer"], optsKey: ["problemType:single", "problemType:multi"]}],
    {description: "difficulty of problem?", opts: ["simple", "advanced"], optsKey: ["difficulty:simple", "difficulty:advanced"]}];

  useEffect(() => {
    setConfOptions({fn: setChoices, fnIndex: setIndex, fnPrevIndex: setPrevIndex});
  }, []);

  const resetOptions = () => {
    if (click) {
      setIndex(0);
      setPrevIndex(null);
      setClick(false);
      setChoices([]);
      setConf(null);
      setMapFulfilled(false);
    }

    setClick(true);
    setTimeout(() => {
      setClick(false);
    }, 1000);
  }

  const choose = i => {
    let newChoices = [...choices];
    let item = prevIndex === null ? options[index].optsKey[i] : options[index][prevIndex].optsKey[i];
    newChoices.push(item);
    setChoices(newChoices);

    if (index === options.length - 1 || (prevIndex !== null && options[index + 1][prevIndex] === null)) {
      setIndex(null);
      let confObj = {theory: false, simple: false, advanced: false, single: false, multi: false};
      let problemType = newChoices[1].split(":")[1];
      let difficulty = newChoices[2].split(":")[1];
      confObj[problemType] = true;
      confObj[difficulty] = true;
      setConf(confObj);
      return;
    }

    if (options[index + 1][i] === null) {
      setIndex(null);
      let confObj = {theory: true, simple: false, advanced: false, single: false, multi: false};
      setConf(confObj);
      return;
    }

    setIndex(index + 1);

    if (prevIndex === null) {
      if (options[index].choice) {
        setPrevIndex(i);
      } else {
        setPrevIndex(null);
      }
    } else {
      if (options[index][prevIndex].choice) {
        setPrevIndex(i);
      } else {
        setPrevIndex(null);
      }
    }

    if (index === 0 && i === 0) {
      setConf({theory: true, simple: false, advanced: false, single: false, multi: false});
      setIndex(null);
    }
  }

  const getArray = () => {
    if (prevIndex === null) {
      return options[index].opts;
    } else {
      return options[index][prevIndex].opts;
    }
  }

  const getDescription = () => {
    if (prevIndex === null) {
      return options[index].description;
    } else {
      return options[index][prevIndex].description;
    }
  }

  const extractType = input => {
    let inputArr = input.split(":");
    return inputArr[0] + ": " + inputArr[1];
  }

  return (
    <div className="form-container">
      <div className="section-title"><h2>Configuration (double click options below to reset)</h2></div>
      {((prevIndex === null && index !== null) || (prevIndex !== null && options[index][prevIndex] !== null)) && <div className=""><h3>{getDescription()}</h3></div>}
      {((prevIndex === null && index !== null) || (prevIndex !== null && options[index][prevIndex] !== null)) && <div className="form-inner">
        {getArray().map((choice, i) => {
          return <div className="form-entry" key={i}><input type="button" onClick={() => choose(i)} value={choice} /></div>
        })}
      </div>}
      {choices && choices.length > 0 && <div className="form-inner choices hover" onClick={resetOptions}>
        <div className="form-entry pad choices">Choices:</div> {choices.map((opt, i) => <div className="form-entry" key={i}>{extractType(opt)}</div>)}
      </div>}
    </div>
  );
}

export default FormView;