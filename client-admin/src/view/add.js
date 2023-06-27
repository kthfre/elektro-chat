import React, { useState, useEffect, useRef } from "react";
import MultistepView from "./multistep";
import StepView from "./step";
import FeedbackView from "./feedback";

/**
 * Handles the add view
 * @returns the add view.
 */

const URI = window.location.href;
// const URI = "http://localhost:4304/";

const AddView = ({modules, conf, mapFulfilled, setTheory, setProblems, token}) =>  {
  let [items, setItems] = useState([]);
  let [itemsCount, setItemsCount] = useState([]);
  let [loadData, setLoadData] = useState(null);
  let [newStep, setNewStep] = useState(null);
  let [feedback, setFeedback] = useState({enable: false, message: "", error: null});
  let [click, setClick] = useState({isClick: false, i: null, j: null});
  let [stepData, setStepData] = useState(null);
  let [multiCache, setMultiCache] = useState({});
  let lastTimerId = useRef({click: null, item: null, itemModule: null, storeStep: null, submitProblem: null, submitTheory: null});
  let storageObject = useRef({});
  let elModule = useRef(null);
  let elInput = useRef(null);
  let elCheckbox = useRef(null);
  let elTModule = useRef(null);
  let elTInput = useRef(null);
  let elTCheckbox = useRef(null);

  const resetAll = () => {
    if (elModule.current) {
      elModule.current.children[0].value = -1;
    }

    for (let i = 0; i < elInput.current.children.length; i++) {
      elInput.current.children[i].value = "";
    }
  }

  const resetAllTheory = () => {
    if (elTModule.current) {
      elTModule.current.children[0].value = -1;
    }

    for (let i = 0; i < elTInput.current.children.length; i++) {
      elTInput.current.children[i].value = "";
    }
  }

  const getStartOfText = text => {
    if (text.length < 25) {
      return text;
    }

    return text.slice(0, 25) + " ...";
  }

  const storeTheory = () => {
    const children = elTInput.current.children;

    if (lastTimerId.current.storeTheory) {
      clearTimeout(lastTimerId.current.storeTheory);
    }

    if (itemsCount[0] === 0) {
      setFeedback({enable: true, message: "Module must be set.", error: true});
    } else {
      let empty = false;

      for (let i = 0; i < children.length; i++) {
        if (children[i].value === "") {
          empty = true;
          setFeedback({enable: true, message: "Both title and theory text must be set.", error: true});
          break;
        }
      }

      if (!empty) {
        setFeedback({enable: true, message: "Adding items.", error: false});

        let newItems = createNewItems(2);
        let newItemsCount = [...itemsCount];
        newItemsCount[1]++;
        const title = children[0].value;
        const text = children[1].value;
        
        if (newItems[1] === null || newItems.length < 2) {
          newItems[1] = {title: "textContent", data: [[{title: "title", value: title}, {title: "text", value: getStartOfText(text), text}]]};
        } else {
          newItems[1].data.push([{title: "title", value: title}, {title: "text", value: getStartOfText(text), text}]);
        }

        setItems(newItems);
        setItemsCount(newItemsCount);
      }
    }

    lastTimerId.current.storeTheory = setTimeout(() => {
      setFeedback({enable: false, message: "", error: null});
    }, 2000);
  }

  const createStepObject = stepContent => {
    let obj = {};

    for (let i = 0; i < items.length; i++) {
      if (items[i] && stepContent.indexOf(items[i].title) !== -1) {
        obj[items[i].title] = items[i].data;
      }
    }

    return obj;
  }

  const deepCloneArrayArrayObject = array => {
    let arr = [];

    for (let i = 0; i < array.length; i++) {
      arr.push([]);

      for (let j = 0; j < array[i].length; j++) {
        arr[i].push({...array[i][j]});
      }
    }

    return arr;
  }

  const storeStep = () => {
    if (lastTimerId.current.storeStep) {
      clearTimeout(lastTimerId.current.storeStep);
    }

    const stepContent = ["keywords", "hint", "knowledge", "reading"];

    if (conf.multi) {
      if (conf.simple) {
        if (stepData && stepData.length === mapFulfilled.mappedLetters.length) {
          setFeedback({enable: true, message: "Simple problems only have 1 step per mapping.", error: true});

          lastTimerId.current.storeStep = setTimeout(() => {
            setFeedback({enable: false, message: "", error: null});
          }, 2000);

          return;
        }

        let inputValid = true;
        let key = conf.simple ? "simple" : "advanced";
        for (let i = 0; i < fieldConf[key].mandatory.length; i++) {
          if (fieldConf[key].mandatory[i]) {
            const name = fieldConf[key].groupName[fieldConf[key].groupMap[i]];

            if (itemsCount[i + 1] === 0 && stepContent.indexOf(name) !== -1) {
              inputValid = false;
              break;
            }
          }
        }

        if (!inputValid)  {
          setFeedback({enable: true, message: "All mandatory items must be stored.", error: true});
        } else {
          setFeedback({enable: true, message: "Storing step.", error: false});
          let step = createStepObject(stepContent);

          setNewStep(step);
        }
  
        lastTimerId.current.storeStep = setTimeout(() => {
          setFeedback({enable: false, message: "", error: null});
        }, 2000);
      } else {
        let inputValid = true;
        let key = conf.simple ? "simple" : "advanced";
        for (let i = 0; i < fieldConf[key].mandatory.length; i++) {
          if (fieldConf[key].mandatory[i]) {
            const name = fieldConf[key].groupName[fieldConf[key].groupMap[i]];

            if (itemsCount[i + 1] === 0 && stepContent.indexOf(name) !== -1) {
              inputValid = false;
              break;
            }
          }
        }

        if (!inputValid)  {
          setFeedback({enable: true, message: "All mandatory items must be stored.", error: true});
        } else {
          setFeedback({enable: true, message: "Storing step.", error: false});
          let step = createStepObject(stepContent);

          setNewStep(step);
        }
  
        lastTimerId.current.storeStep = setTimeout(() => {
          setFeedback({enable: false, message: "", error: null});
        }, 2000);
      }
    } else {
      // single advance/simple same but with check as single simple only have 1 step

      if (conf.simple && stepData && stepData.length) {
        setFeedback({enable: true, message: "Simple problems only have 1 step.", error: true});

        lastTimerId.current.storeStep = setTimeout(() => {
          setFeedback({enable: false, message: "", error: null});
        }, 2000);

        return;
      }

      let inputValid = true;
      let key = conf.simple ? "simple" : "advanced";
      for (let i = 0; i < fieldConf[key].mandatory.length; i++) {
        if (fieldConf[key].mandatory[i]) {
          const name = fieldConf[key].groupName[fieldConf[key].groupMap[i]];

          if (itemsCount[i + 1] === 0 && stepContent.indexOf(name) !== -1) {
            inputValid = false;
            break;
          }
        }
      }

      if (!inputValid)  {
        setFeedback({enable: true, message: "All mandatory items must be stored.", error: true});
      } else {
        setFeedback({enable: true, message: "Storing step.", error: false});
        let step = createStepObject(stepContent);

        setNewStep(step);
      }

      lastTimerId.current.storeStep = setTimeout(() => {
        setFeedback({enable: false, message: "", error: null});
      }, 2000);
    }
  }

  const submitProblem = () => {
    if (lastTimerId.current.submitProblem) {
      clearTimeout(lastTimerId.current.submitProblem);
    }

    if (items[0] && items[0].data.length && items[1] && items[1].data.length) {
      if (stepData === null) {
        setFeedback({enable: true, message: "There must be at least one valid step.", error: true});

        lastTimerId.current.submitProblem = setTimeout(() => {
          setFeedback({enable: false, message: "", error: null});
        }, 2000);

        return;
      }

      if (conf.multi && conf.simple && stepData && stepData.length !== mapFulfilled.mappedLetters.length) {
        setFeedback({enable: true, message: "All multi-part problems must have a step.", error: true});

        lastTimerId.current.submitProblem = setTimeout(() => {
          setFeedback({enable: false, message: "", error: null});
        }, 2000);

        return;
      }

      if (conf.multi && conf.advanced && multiCache) {
        let valid = true;

        for (let letter of mapFulfilled.mappedLetters) {
          if (!(multiCache[letter] instanceof Array) || !multiCache[letter].length) {
            valid = false;
            break;
          }
        }

        if (!valid) {
          setFeedback({enable: true, message: "All multi-part problems must have a step.", error: true});

          lastTimerId.current.submitProblem = setTimeout(() => {
            setFeedback({enable: false, message: "", error: null});
          }, 2000);

          return;
          }
      }

      let steps = [];
      if (conf.multi && conf.advanced) {
        for (let letter of mapFulfilled.mappedLetters) {
          steps.push([]);
          const index = steps.length - 1;

          for (let i = 0; i < multiCache[letter].length; i++) {
            steps[index].push(multiCache[letter][i].data);
          }
        }
      } else {
        for (let i = 0; i < stepData.length; i++) {
          steps.push(stepData[i].data);
        }
      }

      const module = items[0].data;
      const problemId = items[1].data;
      const images = items[2] ? items[2].data : [];
      const problemTitle = items[3] ? items[3].data : [];

      let body = {module, type: conf.single ? "single" : "multi", difficulty: conf.simple ? "simple" : "advanced", problemId, images, problemTitle, steps, overwrite: elCheckbox.current.checked};
      if (conf.multi) {
        body.mappedLetters = [...mapFulfilled.mappedLetters];
      }

      if (conf.multi) { 
        body.tree = mapFulfilled.tree;
      }

      body = JSON.stringify(body);
      let obj = {method: "POST", body, mode: "cors", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + token}};

      fetch(URI + "problem", obj).then(res => {
        if (res.status === 200) {
          res.json().then(data => {
            if (data.error) {
              setFeedback({enable: true, message: data.message, error: data.error});
            } else {
              setFeedback({enable: true, message: data.message, error: data.error});
              setProblems(data.data);
            }
          });  
        }
      });

    } else {
      setFeedback({enable: true, message: "Both module and problem id must be set.", error: true});
    }

    lastTimerId.current.submitProblem = setTimeout(() => {
      setFeedback({enable: false, message: "", error: null});
    }, 2000);
  }

  const submitTheory = () => {
    if (lastTimerId.current.submitTheory) {
      clearTimeout(lastTimerId.current.submitTheory);
    }

    if (!items[0] || !items[1]) {
      setFeedback({enable: true, message: "There must be at least one valid text.", error: true});

      lastTimerId.current.submitTheory = setTimeout(() => {
        setFeedback({enable: false, message: "", error: null});
      }, 2000);

      return;
    }

    if (items[0] && items[0].data.length && items[1] && items[1].data.length) {
      let texts = items[1].data;
      
      let body = JSON.stringify({module: items[0].data, texts, overwrite: elTCheckbox.current.checked});
      let obj = {method: "POST", body, mode: "cors", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + token}};
      fetch(URI + "theory", obj).then(res => {
        if (res.status === 200) {
          res.json().then(data => {
            if (data.error) {
              setFeedback({enable: true, message: data.message, error: true});
            } else {
              setFeedback({enable: true, message: data.message, error: false});
              setTheory(data.data);
            }
          });
        }
      });
    }

    lastTimerId.current.submitTheory = setTimeout(() => {
      setFeedback({enable: false, message: "", error: null});
    }, 2000);
  }

  const getControlsConf = () => {
    let obj;

    if ((conf.simple && conf.multi) || conf.advanced) {
      obj = {
        name: ["Reset all", "Store step", "Submit"],
        handler: [resetAll, storeStep, submitProblem]
      };
    } else {
      obj = {
        name: ["Reset all", "Store step", "Submit"],
        handler: [resetAll, storeStep, submitProblem]
      };
    }

    return obj;
  }

  const fieldConf = {
    "simple": {
      placeholder: ["problem id (mandatory)", "image file name excluding extension (voluntary)", "problem title (voluntary)", "hint (mandatory)", "knowledge bank / question (voluntary)", "knowledge bank / answer (voluntary)", "knowledge bank / interpretation (voluntary)", "reading material / book (voluntary)", "reading material / section (voluntary)"],
      name: ["id", "image", "title", "hint", "question", "answer", "interpretation", "book", "section"],
      groupName: ["problemId", "imageFiles", "problemTitle", "hint", "knowledge", "reading"],
      group: [{index: [0]}, {index: [1]}, {index: [2]}, {index: [3]}, {index: [4, 5, 6]}, {index: [7, 8]}],
      groupMap: [0, 1, 2, 3, 4, 4, 4, 5, 5],
      maxItems: [1, null, 1, 1, null, null, null, 1, 1],
      mandatory: [true, false, false, true, false, false, false, false, false],
      firstGroup: [false, true, true, true, true, false, false, true, false],
      controls: getControlsConf()
    }, 
    "advanced": {
      placeholder: ["problem id (mandatory)", "image file name excluding extension (voluntary)", "problem title (voluntary)", "keywords (mandatory)", "hint (mandatory)", "knowledge bank / question (voluntary)", "knowledge bank / answer (voluntary)", "knowledge bank / interpretation (voluntary)", "reading material / book (voluntary)", "reading material / section (voluntary)"],
      name: ["id", "image", "title", "keywords", "hint", "question", "answer", "interpretation", "book", "section"],
      groupName: ["problemId", "imageFiles", "problemTitle", "keywords", "hint", "knowledge", "reading"],
      group: [{index: [0]}, {index: [1]}, {index: [2]}, {index: [3]}, {index: [4]}, {index: [5, 6, 7]}, {index: [8, 9]}],
      groupMap: [0, 1, 2, 3, 4, 5, 5, 5, 6, 6],
      maxItems: [1, null, 1, null, 1, null, null, null, 1, 1],
      mandatory: [true, false, false, true, true, false, false, false, false, false],
      firstGroup: [false, true, true, true, true, true , false, false, true, false],
      controls: getControlsConf()
    }
  }

  useEffect(() => {
    if (!conf.theory) {
      let itemsCount = [];
      for (let i = 0; i <= fieldConf[conf.simple ? "simple" : "advanced"].maxItems.length; i++) {
        itemsCount.push(0);
      }
      resetAll();
      setItems([]);
      setItemsCount(itemsCount);
  
      if (conf.content) { 
        let moduleValue;
        const images = conf.content.images;
        const problemId = conf.content.problem_id;
        const problemTitle = conf.content.title;

        for (let i = 0; i < modules.length; i++) {
          if (modules[i].name === conf.content.module) {
            moduleValue = i;          
            break;
          }
        }
  
        setTimeout(() => {
          elModule.current.children[0].value = moduleValue;
          elInput.current.children[0].value = problemId;
          elInput.current.children[2].value = problemTitle;
  
          if (images.length) {
            let obj = {title: "imageFiles", data: []};
  
            for (let i = 0; i < images.length; i++) {
              obj.data.push([{title: "image", value: images[i]}]);
            }
  
            let newItems = createNewItems(items);
            let newItemsCount = [...itemsCount];
            newItemsCount[2] = images.length;    
            newItems[2] = obj;

            setItems(newItems);
            setItemsCount(newItemsCount);
          }
        }, 10);
      }
    } else {
      // theory
      let itemsCount = [];
      for (let i = 0; i < 2; i++) {
        itemsCount.push(0);
      }

      resetAllTheory();
      setItems([]);
      setItemsCount(itemsCount);
  
      if (conf.content) {
        let moduleValue;
        const title = conf.content.title;
        const text = conf.content.text;
        for (let i = 0; i < modules.length; i++) {
          if (modules[i].name === conf.content.module) {
            moduleValue = i;          
            break;
          }
        }

        setTimeout(() => {
          elTModule.current.children[0].value = moduleValue;
          elTInput.current.children[0].value = title;
          elTInput.current.children[1].value = text;
        }, 10);
      }
    }

  }, [conf])

  useEffect(() => {
    if (loadData) {
      const totalInputs = fieldConf[conf.simple ? "simple" : "advanced"].group.length + 1;
      const stepGroups = fieldConf[conf.simple ? "simple" : "advanced"].groupName.slice(3);
      const index = totalInputs - stepGroups.length;
      let newItems = createNewItems(fieldConf[conf.simple ? "simple" : "advanced"].group.length + 1);
      let newItemsCount = [...itemsCount];

      let newData = {};
      for (let key of Object.keys(loadData)) {
        newData[key] = deepCloneArrayArrayObject(loadData[key]);
      }

      let groupIndex = 0;
      for (let i = index; i < totalInputs; i++, groupIndex++) {
        const group = stepGroups[groupIndex];

        if (Object.keys(newData).indexOf(group) !== -1) {
          newItems[i] = {};
          newItems[i].title = group;
          newItems[i].data = newData[group];
        } else {
          newItems[i] = null;
        }
      }

      for (let i = index; i < fieldConf[conf.simple ? "simple" : "advanced"].group.length + 1; i++) {
        let indices = fieldConf[conf.simple ? "simple" : "advanced"].group[i - 1].index;
        let numEntries = 0;
        if (newItems[i]) {
          numEntries = newItems[i].data.length;
        }

        for (let j of indices) {
          newItemsCount[j + 1] = numEntries;
        }
      }

      setItemsCount(newItemsCount);
      setItems(newItems);
    }
  }, [loadData])

  const createNewItems = numItems => {
    let newItems = [];

    for (let i = 0; i < numItems; i++) {
      if (items[i] instanceof Object) {
        newItems[i] = {};
        newItems[i].title = items[i].title;
        newItems[i].data = [];

        for (let j = 0; j < items[i].data.length; j++) {
          newItems[i].data.push([...items[i].data[j]]);
        }
      }
    }

    return newItems;
  }

  const resetOption = (el, index) => {
    if (click.isClick && !click.isDouble && click.i === index && click.j === null) {
      setClick({isClick: true, i: index, j: null, isDouble: true});

      lastTimerId.current.click = setTimeout(() => {
        if (click.isClick && click.i === index && click.j === null) {
          const groupMap = fieldConf[conf.simple ? "simple" : "advanced"].groupMap;
          const itemsLength = conf.theory ? 2 : groupMap[groupMap.length - 1] + 2;
          let newItems = createNewItems(itemsLength);
          let newItemsCount = [...itemsCount];
          let itemsCountIndices = [0];

          if (index > 0 && !conf.theory) {
            itemsCountIndices = fieldConf[conf.simple ? "simple" : "advanced"].group[index - 1].index;
          } else if (index === 1 && conf.theory) {
            itemsCountIndices = [1];
          }

          newItems[index] = null;
          setItems(newItems);

          for (let i of itemsCountIndices) {
            newItemsCount[conf.theory ? i : i + 1] = 0;
          }

          setItemsCount(newItemsCount);
        }
      }, 500);
    } else if (click.isClick && click.isDouble && click.i === index && click.j === null) {
      if (lastTimerId.current.click) {
        clearTimeout(lastTimerId.current.click);
      }

      setClick({isClick: false, i: null, j: null, isDouble: false});
      setItems([]);

      let newItemsCount = [...itemsCount];
      for (let i = 0; i < itemsCount.length; i++) {
        newItemsCount[i] = 0;
      }

      setItemsCount(newItemsCount);
    } else {
      setClick({isClick: true, i: index, j: null, isDouble: click.isClick ? true : false});
    }
    
    setTimeout(() => {
      setClick({isClick: false, i: null, j: null, isDouble: false});
    }, 1000); 
  }

  const resetOptionItem = (el, i, j) => {
    if (click.isClick && click.i === i && click.j === j) {
      const groupMap = fieldConf[conf.simple ? "simple" : "advanced"].groupMap;
      const itemsLength = conf.theory ? 2 : groupMap[groupMap.length - 1] + 2;
      let newItems = createNewItems(itemsLength);
      let newItemsCount = [...itemsCount];
      let itemsCountIndices = [0];

      if (i > 0 && !conf.theory) {
        itemsCountIndices = fieldConf[conf.simple ? "simple" : "advanced"].group[i - 1].index;
      } else if (i === 1 && conf.theory) {
        itemsCountIndices = [1];
      }

      let arr = newItems[i].data;
      if (j === 0) {
        arr = arr.slice(1);
      } else if (j === (arr.length - 1)) {
        arr = arr.slice(0, arr.length - 1);
      } else {
        arr = arr.slice(0, j).concat(arr.slice(j + 1));
      }

      newItems[i].data = arr;

      if (!arr.length) {
        newItems[i] = null;
      }

      for (let i of itemsCountIndices) {
        newItemsCount[conf.theory ? i : i + 1]--;
      }

      setItems(newItems);
      setItemsCount(newItemsCount);
      setClick({isClick: false, i: null, j: null, isDouble: false});
    } else {
      setClick({isClick: true, i, j, isDouble: false});

      if (i) {
        const children = conf.theory ? elTInput.current.children : elInput.current.children;
        let indices;
        let data;

        if (conf.theory) {
          indices = [0, 1];
          data = items[i].data[j];
        } else {
          indices = fieldConf[conf.simple ? "simple" : "advanced"].group[i - 1].index;
          data = items[i].data[j];
        }        

        for (let i = 0; i < indices.length; i++) {
          children[indices[i]].value = data[i].title === "text" ? data[i].text : data[i].value;
        }
      }
    }
 
    setTimeout(() => {
      setClick({isClick: false, i: null, j: null, isDouble: false});
    }, 1000); 
  }

  const addChangeItem = el => {
    const value = el.target.value;

    if (value === -1) {
      return;
    }

    const groupMap = fieldConf[conf.simple ? "simple" : "advanced"].groupMap;
    let newItems = createNewItems(groupMap[groupMap.length - 1] + 2);
    let newItemsCount = [...itemsCount];
    newItemsCount[0]++;

    if (!(items[0] instanceof Object)) {
      newItems[0] = {};
      newItems[0].title = "module";
      newItems[0].data = [];
    }

    let data = [{title: "module", value: modules[Number(el.target.value)].name}];
    newItems[0].data.push(data);

    setItems(newItems);
    setItemsCount(newItemsCount);

    if (lastTimerId.current.itemModule) {
      clearTimeout(lastTimerId.current.id);
    }

    setFeedback({enable: true, message: "Adding item.", error: null});

    lastTimerId.current.itemModule = setTimeout(() => {
      setFeedback({enable: false, message: "", error: null});
    }, 2000);
  }

  const addItem = (el, index) => {
    if (el.keyCode === 13) {
      const children = elInput.current.children;
      let key = conf.simple ? "simple" : "advanced";
      const groups = fieldConf[key].group;
      const groupMap = fieldConf[key].groupMap;
      const groupIndices = groups[groupMap[index]].index;

      let allFilled = true;
      for (let i of groupIndices) {
        if (children[i].value === "") {
          allFilled = false;
        }
      }

      if (lastTimerId.current.item) {
        clearTimeout(lastTimerId.current.item);
      }

      if (!allFilled) {
        setFeedback({enable: true, message: "All group fields must be filled.", error: true});
      } else if (allFilled && itemsCount[index + 1] === fieldConf[key].maxItems[index]) {
        setFeedback({enable: true, message: "Max " + fieldConf[key].maxItems[index] + " entries allowed for this item.", error: true});
      } else {
        setFeedback({enable: true, message: "Adding item.", error: false});

        const itemIndex = groupMap[index] + 1;
        let newItems = createNewItems(groupMap[groupMap.length - 1] + 2);
        let nn = groupMap[groupMap.length - 1] + 2;
        let newItemsCount = [...itemsCount];
        
        for (let i of groupIndices) {
          newItemsCount[i + 1]++;
        }

        if (!(items[itemIndex] instanceof Object)) {
          newItems[itemIndex] = {};
          newItems[itemIndex].title = fieldConf[key].groupName[groupMap[index]];
          newItems[itemIndex].data = [];
        }

        let data = [];

        for (let i of groupIndices) {
          data.push({title: fieldConf[key].name[i], value: children[i].value});
        }

        newItems[itemIndex].data.push(data);
        setItems(newItems);
        setItemsCount(newItemsCount);
      }

      lastTimerId.current.item = setTimeout(() => {
        setFeedback({enable: false, message: "", error: null});
      }, 2000);
    } 
  }

  useEffect(() => {
    if (conf && conf.multi && conf.advanced && mapFulfilled && mapFulfilled.mappedLetters && mapFulfilled.mappedLetters.length) {
      let obj = {active: mapFulfilled.mappedLetters[0]};

      for (let letter of mapFulfilled.mappedLetters) {
        obj[letter] = [];
      }

      setMultiCache(obj);
    }
  }, [mapFulfilled])

  return (
    <div className="add-container">
      {conf && !conf.theory && <div className="section-title"><h2>Add problems (enter to submit item / double click added items to remove)</h2></div>}
      {conf && !conf.theory && <div className="add-inner">
      <div className="item-container">
        <div className="item-inner-col choices hover">
        {items.length > 0 && items.map((it, i) => it instanceof Object ? <div key={i}><div className="item-title" onClick={el => resetOption(el, i)}>{it.title} | {i === 0 ? itemsCount[0] : itemsCount[fieldConf[conf.simple ? "simple" : "advanced"].group[i - 1].index[0] + 1]}</div>{it.data.map((innerIt, j) => <div className="item-entry pad" onClick={el => resetOptionItem(el, i, j)} key={j}>{innerIt.map((innerItem, k) => <div className="item-prop" key={k}><span>{innerItem.title}</span>: {innerItem.value}</div>)}</div>)}</div> : null)}
        </div>
        {feedback.enable && <FeedbackView conf={feedback} />}
        <div className="item-inner-col">
          {itemsCount[0] < 1 && <div className="item-item" ref={elModule}>
            <select onChange={el => addChangeItem(el)} className="red"><option value={-1} key={0}>choose module...</option>{modules.map((opt, i) => <option value={i} key={i+1}>{opt.name}</option>)}</select>
          </div>}
          <div className="item-item" ref={elInput}>
            {fieldConf[conf.simple ? "simple" : "advanced"].placeholder.map((place, i) => <input onKeyDown={el => addItem(el, i)} className={(conf.simple && fieldConf.simple.mandatory[i] && fieldConf.simple.firstGroup[i] || conf.advanced && fieldConf.advanced.mandatory[i] && fieldConf.advanced.firstGroup[i]) ? "red item-first-group" : ((conf.simple && fieldConf.simple.mandatory[i] && !fieldConf.simple.firstGroup[i] || conf.advanced && fieldConf.advanced.mandatory[i] && !fieldConf.advanced.firstGroup[i]) ? "red" : ((conf.simple && fieldConf.simple.firstGroup[i] || conf.advanced && fieldConf.advanced.firstGroup[i]) ? "item-first-group" : ""))} type="text" placeholder={place} key={i} /> )}
          </div>
        </div>
      </div>

      {conf && conf.multi && conf.advanced && <MultistepView mapFulfilled={mapFulfilled} multiCache={multiCache} setMultiCache={setMultiCache} />}
      {conf && <StepView conf={conf} storage={storageObject} setLoadData={setLoadData} newStep={newStep} setStepData={setStepData} mapFulfilled={mapFulfilled} setFeedback={setFeedback} multiCache={multiCache} setMultiCache={setMultiCache} />}
      <div className="item-item-button"><div className="item-button label"><label htmlFor="overwrite-checkbox">Overwrite</label><input id="overwrite-checkbox" name="overwrite-checkbox" type="checkbox" ref={elCheckbox} /></div></div>
      {conf && <div className="item-item-button">
        {fieldConf[conf.simple ? "simple" : "advanced"].controls.name.map((button, i) => <div className="item-button" key={i}><input type="button" value={button} onClick={fieldConf[conf.simple ? "simple" : "advanced"].controls.handler[i]} /></div>)}
      </div>}
      </div>}

      {conf && conf.theory && <div className="section-title"><h2>Add theory text (enter to submit item / double click added items to remove)</h2></div>}
      {conf && conf.theory && <div className="add-inner">
      <div className="item-container">
        <div className="item-inner-col choices hover">
        {items.length > 0 && items.map((it, i) => it instanceof Object ? <div key={i}><div className="item-title" onClick={el => resetOption(el, i)}>{it.title} | {i === 0 ? itemsCount[0] : itemsCount[fieldConf[conf.simple ? "simple" : "advanced"].group[i - 1].index[0] + 1]}</div>{it.data.map((innerIt, j) => <div className="item-entry pad" onClick={el => resetOptionItem(el, i, j)} key={j}>{innerIt.map((innerItem, k) => <div className="item-prop" key={k}><span>{innerItem.title}</span>: {innerItem.value}</div>)}</div>)}</div> : null)}
        </div>
        {feedback.enable && <FeedbackView conf={feedback} />}
        <div className="item-inner-col">
          {itemsCount[0] < 1 && <div className="item-item" ref={elTModule}>
            <select onChange={el => addChangeItem(el)} className="red"><option value={-1} key={0}>choose module...</option>{modules.map((opt, i) => <option value={i} key={i+1}>{opt.name}</option>)}</select>
          </div>}
          <div className="item-item" ref={elTInput}>
            <input className="red item-first-group" type="text" placeholder="title (mandatory)" />
            <textarea className="red item-first-group" placeholder="theory text (mandatory)" />
          </div>
        </div>
      </div>

      {conf && !conf.theory && <StepView conf={conf} storage={storageObject} setLoadData={setLoadData} newStep={newStep} setStepData={setStepData} mapFulfilled={mapFulfilled} />}
      {conf && !conf.theory && <div className="item-item-button">
        {fieldConf[conf.simple ? "simple" : "advanced"].controls.name.map((button, i) => <div className="item-button" key={i}><input type="button" value={button} onClick={fieldConf[conf.simple ? "simple" : "advanced"].controls.handler[i]} /></div>)}
      </div>}
      
      <div className="item-item-button"><div className="item-button label"><label htmlFor="overwrite-checkbox">Overwrite</label><input id="overwrite-checkbox" name="overwrite-checkbox" type="checkbox" ref={elTCheckbox} /></div></div>
      {conf && conf.theory && <div className="item-item-button">
      <div className="item-button"><input type="button" value="Reset all" onClick={resetAllTheory} /></div><div className="item-button"><input type="button" value="Store text" onClick={storeTheory} /></div><div className="item-button"><input type="button" value="Submit" onClick={submitTheory} /></div>
      </div>}
      </div>}
    </div>
  );
}

export default AddView;