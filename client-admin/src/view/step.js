import React, { useState, useEffect, useRef } from "react";

/**
 * Handles the step view
 * @returns the step view.
 */

const StepView = ({conf, storage, setLoadData, newStep, setStepData, mapFulfilled, setFeedback, multiCache, setMultiCache}) =>  {
  let [step, setSteps] = useState([]);
  let [click, setClick] = useState(-1);
  let [usedLetters, setUsedLetters] = useState([]);
  let stepStore = useRef({order: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]});
  let lastTimerId = useRef({saveStep: null});

  useEffect(() => {
    if (multiCache && !multiCache.setterOne) {
      let obj = {...multiCache};
      obj.setterOne = setSteps;
      obj.setterTwo = setStepData;

      setMultiCache(obj);
    }
  }, [multiCache]);

  useEffect(() => {
    if (conf.content && conf.content.steps) {
      let steps = [];

      function insertIntoDataObject(dataObj, keys, currentStep) {
        if (keys.indexOf("keywords") !== -1) {
          dataObj.keywords = [];
          
          for (let j = 0; j < currentStep.keywords.length; j++) {
            dataObj.keywords.push([{title: "keywords", value: currentStep.keywords[j]}]);
          }
        }

        if (keys.indexOf("hint") !== -1) {
          dataObj.hint = [[{title: "hint", value: currentStep.hint}]];
        }

        if (keys.indexOf("knowledge") !== -1) {
          dataObj.knowledge = [];

          for (let j = 0; j < currentStep.knowledge.questions.length; j++) {
            dataObj.knowledge.push([{title: "question", value: currentStep.knowledge.questions[j]}, {title: "answer", value: currentStep.knowledge.answers[j]}, {title: "interpretation", value: currentStep.knowledge.interpretation[j]}]);
          }
        }

        if (keys.indexOf("reading") !== -1) {
          dataObj.reading = [];

          for (let j = 0; j < currentStep.reading.book.length; j++) {
            dataObj.reading.push([{title: "book", value: currentStep.reading.book[j]}, {title: "section", value: currentStep.book.section[j]}]);
          }
        }
      }

      if (conf.content.steps instanceof Array) {
        stepStore.current.type = "array";

        for (let i = 0; i < conf.content.steps.length; i++) {
          let dataObj = {};
          const currentStep = conf.content.steps[i];
          const keys = Object.keys(currentStep);

          insertIntoDataObject(dataObj, keys, currentStep);

          steps.push({edit: false, name: (i + 1), data: dataObj});
        }
      } else if (conf.multi && conf.advanced) {
        stepStore.current.type = "array";
        const activeLetter = mapFulfilled.mappedLetters[0];

        for (let i = 0; i < conf.content.steps[activeLetter].length; i++) {
          let dataObj = {};
          const currentStep = conf.content.steps[activeLetter][i];
          const keys = Object.keys(currentStep);

          insertIntoDataObject(dataObj, keys, currentStep);

          steps.push({edit: false, name: (i + 1), data: dataObj});
        }

        let obj = {active: mapFulfilled.mappedLetters[0]};
        for (let letter of mapFulfilled.mappedLetters) {
          let otherSteps = [];

          for (let i = 0; i < conf.content.steps[letter].length; i++) {
            let dataObj = {};
            const currentStep = conf.content.steps[letter][i];
            const keys = Object.keys(currentStep);
  
            insertIntoDataObject(dataObj, keys, currentStep);
  
            otherSteps.push({edit: false, name: (i + 1), data: dataObj});

            obj[letter] = otherSteps;
          }
        }

        setTimeout(() => {
          setMultiCache(obj);
        }, 75);
      } else {
        stepStore.current.type = "object";

        for (let key of stepStore.current.order) {
          if (Object.keys(conf.content.steps).indexOf(key) !== -1) {
            let dataObj = {};
            const currentStep = conf.content.steps[key][0];
            const keys = Object.keys(currentStep);

            insertIntoDataObject(dataObj, keys, currentStep);
            steps.push({edit: false, name: key, data: dataObj});
          }
        }
      }

      setSteps(steps);
      setStepData(steps);
    } else if (conf && !conf.content) {
      if (conf.simple) {
        if (conf.multi) {
          // mapped letter steps
          stepStore.current.type = "object";
        } else {
          stepStore.current.type = "array";
        }
      } else {
        if (conf.multi) {
          stepStore.current.type = "array";
        } else {
          // numbered steps
          stepStore.current.type = "array";
        }
      }
    }
  }, [conf]);

  useEffect(() => {
    if (newStep !== null) {
      let name;
      let data = {};

      if (Object.keys(newStep).indexOf("keywords") !== -1) {
        data.keywords = newStep.keywords;
      }

      if (Object.keys(newStep).indexOf("hint") !== -1) {
        data.hint = newStep.hint;
      }

      if (Object.keys(newStep).indexOf("knowledge") !== -1) {
        data.knowledge = newStep.knowledge;
      }

      if (Object.keys(newStep).indexOf("reading") !== -1) {
        data.reading = newStep.reading;
      }

      if (stepStore.current.type === "array") {
        name = step.length ? step[step.length - 1].name + 1 : 1;
        let newSteps = [...step].concat([{edit: false, name, data}]);

        setSteps(newSteps);
        setStepData(newSteps);

        if (conf.multi && conf.advanced) {
          let obj = {...multiCache};
          obj[obj.active] = newSteps;

          setMultiCache(obj);
        }        
      } else if (stepStore.current.type === "object") {
        if (conf.simple) {        
          for (let i = 0; i < mapFulfilled.mappedLetters.length; i++) {
            if (usedLetters.indexOf(mapFulfilled.mappedLetters[i]) === -1) {
              name = mapFulfilled.mappedLetters[i];
              break;
            }
          }

        let newSteps = [...step].concat([{edit: false, name, data}]);
        let newUsedLetters = [...usedLetters].concat([name]);
        orderSteps(newSteps);

        setSteps(newSteps);
        setStepData(newSteps);
        setUsedLetters(newUsedLetters);

        if (conf.multi && conf.advanced) {
          let obj = {...multiCache};
          obj[obj.active] = newSteps;

          setMultiCache(obj);
        }

        setTimeout(() => {
          syncUsedLetters(newSteps);
        }, 10);
        }
      }
    }
  }, [newStep]);

  const deleteStep = index => {
    if (stepStore.current.type === "array") {
      let newSteps;

      if (index === 0) {
        newSteps = step.slice(1);

        for (let i = 0; i < newSteps.length; i++) {
          newSteps[i].name--;
        }
      } else if (index === (step.length - 1)) {
        newSteps = step.slice(0, step.length - 1);
      } else {
        newSteps = step.slice(0, index).concat(step.slice(index + 1));

        for (let i = index; i < newSteps.length; i++) {
          newSteps[i].name--;
        }
      }

      setStepData(newSteps);
      setSteps(newSteps);

      if (conf.multi && conf.advanced) {
        let obj = {...multiCache};
        obj[obj.active] = newSteps;

        setMultiCache(obj);
      }
    } else {
      let newSteps;
      let newUsedLetters;

      if (index === 0) {
        newSteps = step.slice(1);
        newUsedLetters = usedLetters.slice(1);
      } else if (index === (step.length - 1)) {
        newSteps = step.slice(0, step.length - 1);
        newUsedLetters = usedLetters.slice(0, step.length - 1);
      } else {
        newSteps = step.slice(0, index).concat(step.slice(index + 1));
        newUsedLetters = usedLetters.slice(0, index).concat(usedLetters.slice(index + 1));
      }

      setUsedLetters(newUsedLetters);
      setStepData(newSteps);
      setSteps(newSteps);

      if (conf.multi && conf.advanced) {
        let obj = {...multiCache};
        obj[obj.active] = newSteps;

        setMultiCache(obj);
      }
    }
  }

  const syncUsedLetters = steps => {
    let newUsedLetters = [...usedLetters];
    let mem;
    let index;

    for (let i = 0; i < steps.length; i++) {
      if (steps[i].name !== newUsedLetters[i]) {
        index = newUsedLetters.indexOf(steps[i].name);
        mem = newUsedLetters[i];
        newUsedLetters[i] = steps[i].name;
        newUsedLetters[index] = mem;
      }
    }

    setUsedLetters(newUsedLetters);
  }

  const orderSteps = (steps, newUsedLetters) => {
    if (stepStore.current.type === "array") {
      let ref;
      let minVal;
      let minIndex;
      
      for (let i = 0; i < steps.length - 1; i++) {
        minVal = steps[i].name;
        minIndex = i;

        for (let j = (i + 1); j < steps.length; j++) {
          if (steps[j].name < minVal) {
            minVal = steps[j].name;
            minIndex = j;
          }
        }

        if (minIndex !== i) {
          ref = steps[i];
          steps[i] = steps[minIndex];
          steps[minIndex] = ref;
        } 
      }
    } else if (stepStore.current.type === "object") {
      let ref;
      let minVal;
      let minIndex;
      
      for (let i = 0; i < steps.length - 1; i++) {
        minVal = stepStore.current.order.indexOf(steps[i].name);
        minIndex = i;

        for (let j = (i + 1); j < steps.length; j++) {
          if (stepStore.current.order.indexOf(steps[j].name) < minVal) {
            minVal = stepStore.current.order.indexOf(steps[j].name);
            minIndex = j;
          }
        }

        if (minIndex !== i) {
          ref = steps[i];
          steps[i] = steps[minIndex];
          steps[minIndex] = ref;
        } 
      }

      setUsedLetters(newUsedLetters);
    }
  }

  const editStep = (value, index, newSteps, newUsedLetters, order=false) => {
    newSteps[index].edit = value;

    if (order) {
      orderSteps(newSteps, newUsedLetters);
    }

    setStepData(newSteps);
    setSteps(newSteps);

    if (conf.multi && conf.advanced) {
      let obj = {...multiCache};
      obj[obj.active] = newSteps;

      setMultiCache(obj);
    }
  }

  const saveStep = (value, index, newSteps, newUsedLetters) => {
    if (lastTimerId.current.saveStep) {
      clearTimeout(lastTimerId.current.saveStep);
    }

    if (/^[0-9]+$/.test(value) && stepStore.current.type === "array") {
      value = Number(value);
      newSteps[index].name = value;
    } else if (stepStore.current.type === "object") {
      if (mapFulfilled.mappedLetters.indexOf(value) === -1) {
        setFeedback({enable: true, message: "Name must be mapped.", error: true});
        
        lastTimerId.current.saveStep = setTimeout(() => {
          lastTimerId.current.saveStep = null;
          setFeedback({enable: false, message: "", error: null});
        }, 2000);

        return;
      }

      if (usedLetters.indexOf(value) !== -1) {
        let otherIndex;
        let newUsedLetters = [...usedLetters];

        for (let i = 0; newSteps.length; i++) {
          if (newSteps[i].name === value) {
            otherIndex = i;
            break;
          }
        }

        const otherValue = newSteps[index].name;
        newSteps[otherIndex].name = otherValue;
        newSteps[index].name = value;
        newUsedLetters[otherIndex] = otherValue;
        newUsedLetters[index] = value;

      } else {
        if (mapFulfilled.mappedLetters.indexOf(value) === -1) {
          setFeedback({enable: true, message: "Name must be mapped.", error: true});
          
          lastTimerId.current.saveStep = setTimeout(() => {
            lastTimerId.current.saveStep = null;
            setFeedback({enable: false, message: "", error: null});
          }, 2000);
  
          return;
        } else {
          const oldValue = newSteps[index].name;
          newSteps[index].name = value;
          newUsedLetters[newUsedLetters.indexOf(oldValue)] = value;
        }
      }

      setUsedLetters(newUsedLetters);
    }

    setSteps(newSteps);
    setStepData(newSteps);

    if (conf.multi && conf.advanced) {
      let obj = {...multiCache};
      obj[obj.active] = newSteps;

      setMultiCache(obj);
    }
  }

  const handleKey = (el, index) => {
    if (el.keyCode === 13) {
      const value = el.target.value;
      let newSteps = [...step];
      let newUsedLetters = [...usedLetters];
      saveStep(value, index, newSteps, newUsedLetters);
      editStep(false, index, newSteps, newUsedLetters, true);
    } else if (el.keyCode === 27) {
      deleteStep(index);
    }
  }

  const handleClick = index => {    
    if (click === index) {
      let newSteps = [...step];
      let newUsedLetters = [...usedLetters];
      editStep(true, index, newSteps, newUsedLetters);
      setClick(-1);
      stepStore.current.timerId = null;
      stepStore.current.lastClickId = null;
      storage.current.lastClickId = null;

      return;
    }

    setClick(index);
    let id = setTimeout(() => {      
      if (!step[index].edit) {
        setLoadData(step[index].data);
        setTimeout(() => {
          setLoadData(false);
          stepStore.current.timerId = null;
          stepStore.current.lastClickId = null;
        }, 0);
      }
      
      setClick(-1);
    }, 1000);

    stepStore.current.timerId = id;
    stepStore.current.lastClickId = index;
    storage.current.lastClickId = index;
  }

  return (
    <div className="step-container">
      {step.length > 0 && <div className="step-inner"><h3>Stored steps</h3></div>}
      {step.length > 0 && <div className="step-inner">
        {step.length > 0 && step.map((st, i) => <div className="step-item" onClick={() => handleClick(i)} key={i}>{st.edit ? <input type="text" onKeyDown={el => handleKey(el, i)} defaultValue={st.name} /> : st.name}</div>)}
      </div>}
    </div>
  );
}

export default StepView;