import React, { useState, useEffect, useRef } from "react";

/**
 * Handles the timer view
 * @returns the timer view.
 */

// const URI = window.location.href;
const URI = "http://localhost:3003/";

const TimerView = ({eta, delay}) =>  {
  let [currentCount, setCurrentCount] = useState(0);
  let [currentVector, setCurrentVector] = useState("");
  let vectors = useRef([]);
  let timerId = useRef(null);
  let timerMs = useRef(0);
  let currCount = useRef(0);

  useEffect(() => {
    if (!vectors.length) {
      let newVectors = [];

      for (let i = 0; i < 50; i++) {
        newVectors.push([Math.random(), Math.random()]);
      }

      vectors.current = newVectors;

      generateVector();
    }
  }, [vectors]);

  useEffect(() => {
    if (timerId.current) {
      clearTimeout(timerId.current)

      timerId.current = null;
    }

    if (timerMs.current && timerMs.current !== 0) {
      timerMs.current = 0;
    }

    triggerTimerLoop(delay);
    setCurrentCount(0);

    return () => {
      if (timerId.current) {
        clearTimeout(timerId.current);
        setCurrentCount(0);
        setCurrentVector("");
        vectors.current = [];
        timerId.current = null;
        timerMs.current = 0;
        currCount.current = 0;
      }
    }
  }, [eta]);

  const generateVector = () => {
    const randIndex = Math.floor(Math.random() * vectors.current.length)
    const vector = vectors.current[randIndex];
    let representation = "[ ... , ";

    for (let i = 0; i < vector.length; i++) {
      representation += vector[i].toFixed(3) + ", ";
    }

    representation += "... ]";
    setCurrentVector(representation);
  }

  const triggerTimerLoop = delay => {
    const id = setTimeout(() => {
      let isWhole = ((timerMs.current + delay) % 1000);

      if (isWhole === 0) {
        currCount.current += 1;
        setCurrentCount(currCount.current);
      }
      
      generateVector();
      timerMs.current += delay;
      triggerTimerLoop(delay);
    }, delay);

    timerId.current = id;
  }

  return (
     <div className="timer-container">
      <div className="timer-inner">
        <div className={currCount.current < eta ? "timer-box" : "timer-box exceed"}>
          {currentCount} / {eta} {currCount.current < eta ? "seconds" : "s (lugn!)"}
        </div>
        <div className="timer-spinner">
          <img src={URI + "images/icons8-loading-infinity-tr.gif"} alt="banana" />
        </div>
        <div className="timer-box small">
          {currentVector}
        </div>
      </div>
    </div>
  );
}

export default TimerView;