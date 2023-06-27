import React, { useState, useEffect } from "react";
import ConversationView from "./conversation";
import DetailsView from "./details";
import TopicsView from "./topics";
import ProgressbarView from "./progressbar";
import RoadmapView from "./roadmap";
import SectionView from "./section";
import ImageView from "./image";
import InformationView from "./information";
import HelpView from "./help";

/**
 * Handles the main view
 * @returns the main view.
 */

const URI = window.location.href;
// const URI = "http://localhost:3003/";

const MainView = () =>  {
  let [response, setResponse] = useState([]);
  let [reset, toggleReset] = useState(false);
  let [problemDetails, setProblemDetails] = useState(null);
  let [problemRoadmap, setProblemRoadmap] = useState(null);
  let [section, setSection] = useState(null);
  let [enableProgress, setEnableProgress] = useState(false);
  let [progressSteps, setProgressSteps] = useState([0, 0]);
  let [enableTopic, setEnableTopic] = useState(false);
  let [topics, setTopics] = useState(null);
  let [turnCount, setTurnCount] = useState([0, 0]);
  let [enableInformation, setEnableInformation] = useState(false);
  let [informationConf, setInformationConf] = useState(null);
  let [sessionId, setSessionId] = useState(null);

  useEffect(() => {
    const id = generateId();

    id.then(res => {
      sendMessage(res);
      setSessionId(res);
    });
  }, []);

  useEffect(() => {
    if (problemDetails && problemDetails.difficulty === "advanced") {
      if (problemRoadmap && problemRoadmap.problem_advanced === "ask") {
        setEnableTopic(true);
        setTopics({topics: problemRoadmap.topics});
      } else if (problemRoadmap && problemRoadmap.problem_advanced === "part") {
        setEnableTopic(true);
        setTopics({topics: problemRoadmap.topics, currentIndex: problemRoadmap.currentIndex, type: "part"});
      } else if (problemRoadmap && problemRoadmap.problem_advanced === "whole") {
        setEnableTopic(true);
        setTopics({topics: problemRoadmap.topics, currentIndex: problemRoadmap.currentIndex, type: "whole"});
      }
    }
  }, [problemRoadmap]);

  const generateId = () => {
    const id = Math.floor(Math.random() * 99999999);

    return validateId(id);
    
    function validateId(sessId) {
      return fetch(URI + sessId).then(res => {
        if (res.status === 200) {
          return res.json().then(data => {
            if (data.status) {
              return data.id;
            } else {
              const id = Math.floor(Math.random() * 99999999);
              return validateId(id);
            }
          });
        }
      });;
    }
  }

  const sendMessage = (sender, message = null) => {
    let data = {sender, message: message === null ? "/session_start" : message};

    let obj = {
      method: "POST",
      mode: "cors",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      }
    };

    fetch(URI, obj).then(res => {
      res.json().then(data => {
        const arr = [...data];
        setResponse(arr);
      })
    });
  }

  const handleReset = msg => {
    toggleReset(!reset);
    const id = generateId();
    
    id.then(res => {
      sendMessage(res);
      setSessionId(res);

      setProblemDetails(null);
      setProblemRoadmap(null);
      setEnableProgress(false);
      setProgressSteps([0, 0]);
      setEnableTopic(false);
      setTopics(null);
      setTurnCount([0, 0]);
      setSection(null);
    });
  }

  const setInformation = (msgs, delay) => {
    setEnableInformation(true);
    setInformationConf({msgs, delay});
    
    const disableDelay = msgs.length * delay + 10;
    setTimeout(() => {
      setEnableInformation(false);
    }, disableDelay);
  }

  return (
    <div className="main-container">
      <div className="main-column one">
        <div className="main">
          <input className="main-button" type="button" value="RESET" onClick={handleReset} />
        </div>
        {false && <div className="counter-container">
          <div className="conversation-counter"><span>turn</span>{turnCount[0]}</div>
          <div className="conversation-counter"><span>msg</span>{turnCount[1]}</div>
        </div>}
        {enableProgress && <ProgressbarView enable={enableProgress} step={progressSteps[0]} totalSteps={progressSteps[1]} />}
        <HelpView />
        {section && <SectionView problemSection={section} />}
        {problemDetails && <DetailsView problemDetails={problemDetails} setInformationDisplay={setInformation} />}
        {enableTopic && problemDetails && problemDetails.difficulty === "advanced" && <TopicsView enable={enableTopic} topics={topics} />}
        {problemRoadmap && <RoadmapView problemRoadmap={problemRoadmap} />}
      </div>
      <div className="main-column two">
        <InformationView enable={enableInformation} conf={informationConf} />
        <ConversationView messageTrigger={response} reset={reset} setProblemDetails={setProblemDetails} problemRoadmap={problemRoadmap} setProblemRoadmap={setProblemRoadmap} turnCount={turnCount} setTurnCount={setTurnCount} section={section} setSection={setSection} sessionId={sessionId} />
        <ImageView imageDetails={problemDetails} />
      </div>
    </div>
  );
}

export default MainView;