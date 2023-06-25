import React, { useState, useEffect, useRef } from "react";

/**
 * Handles the tree view
 * @returns the tree view.
 */

const TreeView = ({pointer, tree, fulfilled, resetMap}) =>  {
  let [treeArray, setTreeArray] = useState([])
  let [lastRow, setLastRow] = useState({index: 1});
  let [click, setClick] = useState(false);
  let lastTimerId = useRef({id: null});

  useEffect(() => {   
    if (tree) {
      let newTreeArray = [];
      // traverse(tree, newTreeArray, 0, 1);
      traverse_bfs(tree, newTreeArray, 0);
      setTreeArray(newTreeArray);

      function traverse(tree, treeArr, level, prevAns) {
        if (treeArr.length === level) {
          treeArr.push([]);
        }

        if (!(tree.question || tree.maps_to)) {
          for (let i = 0; i < prevAns; i++) {
            treeArr[level].push({blank: true});
          }
          
          return;
        }

        if (!tree.question && tree.maps_to) {
          treeArr[level].push({maps_to: tree.maps_to});
          return;
        }

        let obj = {question: tree.question, answers: tree.answers};

        if (Object.keys(tree).indexOf("maps_to") !== -1) {
          obj.maps_to = tree.maps_to;
        }

        treeArr[level].push(obj);

        if (tree.answers && tree.answers.length > 0) {
          for (let answer of tree.answers) {
            traverse(tree[answer], treeArr, level + 1, prevAns * tree.answers.length);
          }
        } else if (tree.maps_to) {
          traverse({}, treeArr, level + 1, prevAns);
        }
      }

      function traverse_bfs(tree, treeArr, level) {
        let queue = [tree];
        let count = 1;
        let nextLevel = 0;
        let levelRepresentation = [[]];
        treeArr.push([]);

        while (queue.length > 0) {
          let node = queue.shift();
          count -= 1;
          let obj = {};
          
          if (node.answers && node.answers.length > 0) {
            nextLevel += node.answers.length;

            for (let i = 0; i < node.answers.length; i++) {
              if (node.answers[i].indexOf(" ") !== -1 && Object.keys(node).indexOf(node.answers[i].split(" ").join("_")) !== -1) {
                queue.push(node[node.answers[i].split(" ").join("_")]);
              } else {
                queue.push(node[node.answers[i]]);
              }
              
              levelRepresentation[levelRepresentation.length - 1].push(1);
            }

            obj.question = node.question;
            obj.answers = node.answers;
          }

          if (Object.keys(node).indexOf("maps_to") !== -1) {
            obj.maps_to = node.maps_to;
            levelRepresentation[levelRepresentation.length - 1].push(0);
          }

          treeArr[level].push(obj);

          if (count === 0) {
            count = nextLevel;
            nextLevel = 0;
            level += 1;
            treeArr.push([])
            levelRepresentation.push([]);
          }
        }

        // let sequences = extractSequences(levelRepresentation[levelRepresentation.length - 3])
        // console.log(sequences)
      }

      // function extractSequences(arr) {
      //   let start = -1;
      //   let sequences = [];

      //   for (let i = 0; i < arr.length; i++) {
      //     if (arr[i] === 1 && start === -1) {
      //       start = i;
      //     }

      //     let lastIndex = (i === (arr.length - 1));
      //     if (arr[i] === 0 && start !== -1 || lastIndex) {
      //       sequences.push({start, end: lastIndex ? (i + 1) : i, size: lastIndex ? (i - start + 1) : (i - start)});
      //       start = -1;
      //     }
      //   }

      //   let index = 0;
      //   let maxLength = 0;
      //   for (let i = 0; i < sequences.length; i++) {
      //     if (sequences[i].size > maxLength) {
      //       index = i;
      //       maxLength = sequences[i].size;
      //     }
      //   }

      //   return {maxLength, index, sequences};
      // }
    }
  }, [pointer]);

  useEffect(() => {
    if (treeArray.length > 0 && treeArray.length > lastRow.index) {
      let lastIndex = treeArray.length - 2;
      let totalAnswers = 0;
      let numMaps = 0;
      let numAns = 0;
      let mapIndex = [];
      
      for (let i = 0; i < treeArray[lastIndex].length; i++) {
        if (Object.keys(treeArray[lastIndex][i]).indexOf("answers") !== -1) {
          totalAnswers += treeArray[lastIndex][i].answers.length;
          numAns += 1;

          for (let j = 0; j < treeArray[lastIndex][i].answers.length; j++) {
            mapIndex.push(1);
          }
        } else {
          numMaps += 1;
          mapIndex.push(0);
        }     
      }

      let avgAns = totalAnswers / numAns;
      totalAnswers += totalAnswers * numMaps;

      if (mapIndex.length < totalAnswers) {
        let newMapIndex = [];
        for (let i = 0; i < mapIndex.length; i++) {
          if (mapIndex[i] === 1) {
            newMapIndex.push(1);
          } else {
            for (let j = 0; j < avgAns; j++) {
              newMapIndex.push(0);
            }
          }
        }
      }

      setLastRow({index: lastIndex + 1, totalAnswers});
    }
  }, [treeArray.length]);

  const handleClick = () => {
      if (lastTimerId.current.id) {
        clearTimeout(lastTimerId.current.id);
      }
  
      if (click) {
        setTreeArray([]);
        setLastRow({index: 1});
        resetMap();
        setClick(false);
      }
  
      setClick(true);
      lastTimerId.current.id = setTimeout(() => {
        lastTimerId.current.id = null;
        setClick(false);
      }, 1000);
  }

  return (
    <div className="tree-container">
      {treeArray.length > 0 && <div onClick={handleClick} className={fulfilled ? "tree-status fulfilled" : "tree-status"}>{fulfilled ? "fulfilled" : "rejected"}</div>}
      {treeArray.length > 0 && <div className="tree-inner-col">
        {treeArray.map((nodeRow, i) => <div className="tree-inner-row" key={i}>{nodeRow.map((node, j) => {
          return node.question ? <div className="tree-item" key={j}><div className="tree-inner-item-col"><div className="tree-question"><span>question</span>: {node.question}</div><div className="tree-answers-row">{node.answers.map((answer, k) => <div className="tree-answers" key={k}><span>answer</span>: {answer}</div>)}</div></div></div> : (node.maps_to ? <div className="tree-item" key={j}><span>maps to</span>: {node.maps_to}</div> : <div className="tree-item" key={j}></div>);
        })}
          
        </div>)}
      </div>}
    </div>
  );
}

export default TreeView;