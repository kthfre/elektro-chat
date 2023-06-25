import React, { useState, useEffect, useRef } from "react";
import TreeView from "./tree";

/**
 * Handles the map view
 * @returns the map view.
 */

const MapView = ({mapFulfilled, setMapFulfilled, loadTree, setLoadTree, conf}) =>  {
  let [answers, setAnswers] = useState([1]);
  let [tree, setTree] = useState(null);
  let [pointer, setPointer] = useState(null);
  let [fulfilled, setFulfilled] = useState(false);
  let [mappedLetters, setMappedLetters] = useState([]);
  let mapStore = useRef({order: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]});

  useEffect(() => {
    if (pointer && !pointer.length) {
      let newMappedLetters = [...mappedLetters];
      orderMappedLetters(newMappedLetters);
      setMappedLetters(newMappedLetters);
      setMapFulfilled({tree: tree, mappedLetters: newMappedLetters, requiresConversion: loadTree ? true : false});
      setLoadTree(null);
    }
  }, [pointer]);

  useEffect(() => {
    if (loadTree) {
      const contentSteps = Object.keys(conf.content.steps);
      let allLetters = [...contentSteps];
      orderMappedLetters(allLetters);
      
      setMappedLetters(allLetters);
      loadExistingTree(loadTree, allLetters);
      setFulfilled(true);
    }
  }, [loadTree]);

  const resetMap = () => {
    setAnswers([1]);
    setTree(null);
    setPointer(null);
    setFulfilled(false);
    setMappedLetters([]);
    setMapFulfilled(false);
  }

  const orderMappedLetters = letters => {
    let minVal;
    let minIndex;

    for (let i = 0; i < letters.length - 1; i++) {
      minVal = mapStore.current.order.indexOf(letters[i]);
      minIndex = i;

      for (let j = i + 1; j < letters.length; j++) {
        let otherVal = mapStore.current.order.indexOf(letters[j]);

        if (otherVal < minVal) {
          minVal = otherVal;
          minIndex = j;
        }
      }

      if (minIndex !== i) {
        let otherVal = letters[minIndex];
        letters[minIndex] = letters[i];
        letters[i] = otherVal;
      }
    }
  }

  const loadExistingTree = (newTree, letters) => {
    setTree(newTree);
    setMapFulfilled({tree: newTree, mappedLetters: letters, requiresConversion: true})
    setPointer([1]);
    setTimeout(() => {
      setPointer([]);
    }, 10)
  }

  const addNode = el => {
    if (el.keyCode === 13) {
      const root = el.target.parentElement.parentElement;
      const question = root.children[0].children[0].value;
      root.children[0].children[0].value = "";
      let answers = [];

      for (let i = 0; i < root.children[1].children.length; i++) {
        let answer = root.children[1].children[i].value;

        if (answer === "") {
          console.error("EMPTY ANSWER INPUT (index " + i + ")");
          return;
        }

        answers.push(answer);
        root.children[1].children[i].value = "";
      }

      if (question === "" && !(answers.length === 1 && answers[0].indexOf(">>>") !== -1)) {
        console.error("EMPTY QUESTION INPUT");
        return;
      }

      if (answers.length > 1) {
        let found = false;

        for (let i = 0; i < answers.length; i++) {
          if (answers[i].indexOf(">>>") !== -1) {
            if (found) {
              console.error("CANT MAP TO SEVERAL IDS.");
              return;
            }

            found = true;
          }
        }
      }

      let empty = tree === null ? true : false;
      let newTree;

      if (empty) {
        newTree = {question, answers};
        let nextNodes = [];

        for (let answer of answers) {
          if (answer.indexOf(">>>") !== -1) {
            newTree.question = null;
            newTree.answers = null;
            newTree.maps_to = answer.split(">>>")[1];
            continue;
          }

          newTree[answer] = {};
          nextNodes.push(newTree[answer]);
        }

        setTree(newTree);
        setPointer(nextNodes);
      } else {
        let newPointer = [...pointer];

        if (newPointer.length === 0) {
          console.error("NO MORE NODES TO FULFILL");
          return;
        }

        let node = newPointer.shift();

        node.question = question;
        node.answers = answers;
        let nextNodes = [];

        for (let answer of answers) {
          if (answer.indexOf(">>>") !== -1) {
            node.question = null;
            node.answers = null;
            const maps_to = answer.split(">>>")[1];
            node.maps_to = maps_to;
            let newMappedLetters = [...mappedLetters].concat([maps_to]);
            setMappedLetters(newMappedLetters);
            continue;
          }

          node[answer] = {};
          nextNodes.push(node[answer]);
        }

        newPointer = newPointer.concat(nextNodes);
        setPointer(newPointer);

        if (newPointer.length === 0) {
          setFulfilled(true);
        }
      }

      setAnswers([1]);
    }
  }

  const alterAnswers = el => {
    if (el.keyCode === 13) {
      addNode(el);
      return;
    }

    if (el.keyCode === 9) {
      let newAnswers = [...answers].concat([1]);
      setAnswers(newAnswers);
    } else if (el.keyCode === 27) {
      let newAnswers = answers.length > 1 ? [...answers].slice(0, answers.length - 1) : [...answers];
      setAnswers(newAnswers);
    }
  }

  return (
    <div className="map-container">
      <div className="section-title"><h2>Multi answer mapping (tab / esc in answer input adds / removes last input)</h2></div>
      <TreeView pointer={pointer} tree={tree} fulfilled={fulfilled} resetMap={resetMap} />
      {!mapFulfilled && <div className="map-inner-col">
          <div className="map-question">
            <input type="text" onKeyDown={addNode} placeholder="question (mandatory)" />
          </div>
          <div className="map-answer">
            {answers.map((el, i) => <input type="text" onKeyDown={alterAnswers} placeholder="answer (mandatory / tab / esc => add / remove answer)" key={i} />)}
          </div>
      </div>}
    </div>
  );
}

export default MapView;