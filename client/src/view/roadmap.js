import React, { useState, useEffect } from "react";

/**
 * Handles the roadmap view
 * @returns the roadmap view.
 */

const RoadmapView = ({problemRoadmap}) =>  {
  let [path, setPath] = useState([]);
  let [history, setHistory] = useState([]);
  let [blink, setBlink] = useState([]);
  let [lastLength, setLastLength] = useState(0);
  const order = ["id", "maps_to", "problem_advanced", "part", "subject", "hint", "questions", "reading"];
  let currentTimers = [];

  useEffect(() => {
    if (problemRoadmap) {
      let keys = Object.keys(problemRoadmap);
      let p = [...path];
      let newHis = [...history];

      for (let i = 0; i < order.length; i++) {
        if (keys.indexOf(order[i]) !== -1) {
          let key = order[i];

          if (history.indexOf(key) !== -1) {
            continue;
          }
          
          if (key === "maps_to") {
            p.push({prefix: "delproblem", choice: problemRoadmap[key]});
            newHis.push(key);
          }

          if (key === "problem_advanced" && problemRoadmap[key] !== "ask") {
            p.push({prefix: "omfattning", choice: problemRoadmap[key] === "part" ? "delproblem" : "hela problemet"});
            newHis.push(key);
          }

          if (key === "part" && problemRoadmap.part) {
            p.push({prefix: "problemdel", choice: problemRoadmap.part});
            newHis.push(key);
          }
        }
      }

      setNewHistory(newHis);
      setPath(p);
    }
  }, [problemRoadmap]);

  useEffect(() => {
    if (blink.length !== lastLength) {
      const index = blink.length - 1;
      const diff = blink.length - lastLength;
      setLastLength(blink.length);
      const delay = 500;
      let idOne = setTimeout(() => {
        let newBlink = [...blink];

        for (let i = blink.length - diff; i < diff; i++) {
          newBlink[i] = false;
        }

        setBlink(newBlink);
      }, delay);

      let idTwo = setTimeout(() => {
        let newBlink = [...blink];

        for (let i = blink.length - diff; i < diff; i++) {
          newBlink[i] = true;
        }

        setBlink(newBlink);
      }, delay * 2);

      let idThree = setTimeout(() => {
        let newBlink = [...blink];

        for (let i = blink.length - diff; i < diff; i++) {
          newBlink[i] = false;
        }

        setBlink(newBlink);
        clean();
      }, delay * 3);

      currentTimers.concat([idOne, idTwo, idThree]);
      }
  }, [blink.length])

  const clean = () => {
    for (let i = 0; i < currentTimers.length; i++) {
      clearTimeout(currentTimers[i]);
    }

    currentTimers = [];
  }

  const setNewHistory = key => {
    let newHistory = [].concat(key);
    setHistory(newHistory);
    let nBlink = [];

    for (let i = 0; i < key.length; i++) {
      nBlink.push(true);
    }

    let blinks = [...blink].concat(nBlink);
    setBlink(blinks);
  }

  return (
    <div className="roadmap-container">
      <div className="roadmap-inner">
        {path.length > 0 && problemRoadmap && 
        <div className="roadmap-box head">
          Vägval
        </div>}
        {path.length > 0 && 
        path.map((p, i) => {return <div className="roadmap-box" key={i}><div className={blink[i] ? "roadmap-box-pre blink" : "roadmap-box-pre"}>{">"}</div><div className="roadmap-box-content">{p.prefix}: {p.choice}</div></div>})
        }
      </div>
    </div>
  );
}

export default RoadmapView;