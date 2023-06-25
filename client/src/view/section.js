import React, { useState, useEffect } from "react";

/**
 * Handles the section view
 * @returns the section view.
 */

const SectionView = ({problemSection}) =>  {
  let [blink, setBlink] = useState([]);
  let [lastLength, setLastLength] = useState(0);
  let currentTimers = [];

  useEffect(() => {
    setLastLength(0);

    if (problemSection) {
      setBlink([true])
    }
  }, [problemSection]);

  useEffect(() => {
    if (blink.length !== lastLength) {
      setLastLength(blink.length);
      let index = blink.length - 1;
      let delay = 500;

      let idOne = setTimeout(() => {
        let newBlink = [...blink];
        newBlink[index] = false;
        setBlink(newBlink);
      }, delay);

      let idTwo = setTimeout(() => {
        let newBlink = [...blink];
        newBlink[index] = true;
        setBlink(newBlink);
      }, delay * 2);

      let idThree = setTimeout(() => {
        let newBlink = [...blink];
        newBlink[index] = false;
        setBlink(newBlink);
        clean();
      }, delay * 3);

      currentTimers.concat([idOne, idTwo, idThree]);
      }
  }, [blink])

  const clean = () => {
    for (let i = 0; i < currentTimers.length; i++) {
      clearTimeout(currentTimers[i]);
    }

    currentTimers = [];
  }

  const getContent = section => {
    let content = "";

    if (section === "type") {
      content = "hjälptyp: teori/uppgift"
    } else if (section === "theory") {
      content = "faktasummering: egna frågor"
    } else if (section === "problem") {
      content = "problemval: ange id";
    } else if (section === "multi") {
      content = "flervalsmappning: svara";
    } else if (section === "advanced") {
      content = "stegval: del/hela problemet";
    } else if (section === "hint") {
      content = "generellt tips: ges";
    } else if (section === "knowledge") {
      content = "kunskapsbank: egna frågor";
    } else if (section === "reading") {
      content = "läsanvisningar: ges";
    }

    return content;
  }

  return (
    <div className="section-container">
      {problemSection &&<div className="section-inner">
        <div className="section-box head">
          Dialogfas
        </div>
        <div className="section-box"><div className={blink[0] ? "section-box-pre blink" : "section-box-pre"}>{">"}</div><div className="section-box-content">{getContent(problemSection.section)}</div></div>
      </div>}
    </div>
  );
}

export default SectionView;