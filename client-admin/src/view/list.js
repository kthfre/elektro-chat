import React, { useState } from "react";

/**
 * Handles the list view
 * @returns the list view.
 */

// const URI = window.location.href;
const URI = "http://localhost:4304/";

const ListView = ({problems, theory, setConf, setConfOptions, setTheory, setProblems, setLoadTree, token}) =>  {
  let [click, setClick] = useState(-1);
  let [timerId, setTimerId] = useState(null);

  const handleClick = (item, index, type) => {
    if (click !== -1) {
      if (click === index) {
        clearTimeout(timerId);
        setClick(-1);

        // code to delete item
        if (type === "theory") {
          let obj = {method: "DELETE", mode: "cors", headers: {"Authorization": "Bearer " + token}};
          fetch(URI + "theory/" + theory[index].title, obj).then(res => {
            if (res.status === 200) {
              res.json().then(data => {
                setTheory(data.data);
              });
            }
          });
        } else if (type === "problem") {
          let obj = {method: "DELETE", mode: "cors", headers: {"Authorization": "Bearer " + token}};
          fetch(URI + "problem/" + problems[index].id, obj).then(res => {
            if (res.status === 200) {
              res.json().then(data => {
                setProblems(data.data);
              });
            }
          });
        }

        return;
      }
    }

    // code to copy item
    if (type === "theory") {
      let content = {...item};
      setConf({theory: true, single: false, multi: false, simple: false, advanced: false, content});
      setConfOptions.fn(["type:theory"]);
      setConfOptions.fnIndex(null);
      setConfOptions.fnPrevIndex(null);
    } else if (type === "problem") {
      const difficulty = item.difficulty;
      const problemType = item.type === "SingleAnswer" ? "single" : "multi";
      const single = problemType === "single" ? true : false;
      const simple = difficulty === "simple" ? true : false;
      let content = {module: item.module, problem_id: item.id, images: item.images, title: item.title, steps: item.steps};

      if (problemType === "multi") {
        content.map = item.map;
        setLoadTree(item.map);
      }

      setConf({theory: false, single, multi: !single, simple, advanced: !simple, content});
      let confOpts = ["type:problem", "problemType:" + (single ? "single" : "multi"), "difficulty:" + (simple ? "simple" : "advanced")];
      setConfOptions.fn(confOpts);
      setConfOptions.fnIndex(null);
      setConfOptions.fnPrevIndex(null);
    }

    clearTimeout(timerId);
    setClick(index);

    let id = setTimeout(() => {
      setClick(-1);
    }, 1000);
    setTimerId(id);
  }

  return (
    <div className="list-container">
      <div className="section-title"><h2>Existing theory texts / problems (click item for copy / double click for removal)</h2></div>
      {theory.length > 0 && <div className="list-section">
        <h3>Theory</h3>
        {theory.map((theory, i) => <div className="list-entry" onClick={() => handleClick(theory, i, "theory")} key={i}><span>module</span>: {theory.module} | <span>title</span>: {theory.title}</div>)}
      </div>}
      {problems.length && <div className="list-section">
        <h3>Problems</h3>
      {problems.map((problem, i) => {
        return <div className="list-entry" onClick={() => handleClick(problem, i, "problem")} key={i}><span>id</span>: {problem.id} | <span>module</span>: {problem.module} | <span>difficulty</span>: {problem.difficulty} | <span>type</span>: {problem.type === "SingleAnswer" ? "single answer" : "multi answer"}</div>
      })}
      </div>}
    </div>
  );
}

export default ListView;