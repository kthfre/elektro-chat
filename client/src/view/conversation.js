import React, { useState, useEffect } from "react";
import TimerView from "./timer";

/**
 * Handles the conversation view
 * @returns the conversation view.
 */

const URI = window.location.href;
// const URI = "http://localhost:3003/";

const ConversationView = ({messageTrigger, reset, setProblemDetails, problemRoadmap, setProblemRoadmap, turnCount, setTurnCount, section, setSection, sessionId}) =>  {
  let [conversationHistory, setConversationHistory] = useState([]);
  let [eta, setEta] = useState(null);
  const customKeys = ["id", "problem_advanced", "maps_to", "section", "eta"];

  useEffect(() => {
    if (messageTrigger.length) {
      let now = new Date();
      let hours = now.getHours() < 10 ? "0" + now.getHours() : now.getHours();
      let mins = now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes();
      let timestamp = hours + ":" + mins;
      let initialMessage = [...messageTrigger];
      let index = extractCustomIndices(initialMessage);
      const arr = index.length ? initialMessage.slice(index.length) : initialMessage;
      arr[0].time = timestamp;

      appendConversation(arr);
      updateComponents(index, initialMessage);
      setTurnCount([1, messageTrigger.length])
    }
  }, [messageTrigger]);

  useEffect(() => {
    setConversationHistory([]);
    setTurnCount([0, 0])
  }, [reset]);

  const appendConversation = msgs => {
    let conversationNew = [...conversationHistory];

    for (let i = 0; i < msgs.length; i++) {
      conversationNew.push(msgs[i])
    }

    setConversationHistory(conversationNew);    
  }

  const submitMessage = el => {
    if (el.keyCode === 13) {
      const value = el.target.value
      let payload = {sender: sessionId, message: value};
      let obj = {method: "POST", mode: "cors", body: JSON.stringify(payload), headers: {"Content-Type": "application/json"}};

      fetch(URI, obj).then(res => {
        res.json().then(data => {
          let pl = [{sender: payload.sender, text: payload.message}];
          let index = extractCustomIndices(data);
          
          const arr = pl.concat(index.length ? data.slice(index.length) : [...data]);
          let now = new Date();
          let hours = now.getHours() < 10 ? "0" + now.getHours() : now.getHours();
          let mins = now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes();
          let timestamp = hours + ":" + mins;

          for (let i = 0; i < arr.length; i++) {
            arr[i].time = timestamp;
          }

          appendConversation(arr);
          el.target.value = "";

          setTurnCount([turnCount[0] + 2, turnCount[1] + arr.length]);
          updateComponents(index, data, {el, obj, message: payload.message});
        });
      });      
    }
  }

  const extractCustomIndices = (data) => {
    let index = [];

    for (let i = 0; i < data.length; i++) {
      let found = false;

      for (let j = 0; j < customKeys.length; j++) {
        if (Object.keys(data[i]).indexOf(customKeys[j]) !== -1) {
          index.push(j);
          found = true;
          break;
        }
      }

      if (!found) {
        break;
      }
    }

    return index;
  }

  const updateComponents = (index, data, req=null) => {
    if (index.length) {
      let obj = problemRoadmap ? {...problemRoadmap} : {};
      let newEta;

      for (let i = 0; i < index.length; i++) {
        if (index[i] === 0) {
          setProblemDetails(data[i]);
        } else if (index[i] === 1) {
          for (let key of Object.keys(data[i])) {
            if (data[i].hasOwnProperty(key)) {
              if (key === "topics") {
                obj[key] = data[i][key].replace(/[\[\]']/g, "").split(", ");
              } else {
                obj[key] = data[i][key];
              }
            }
          }

          if (obj.problem_advanced === "part" && obj.topics && obj.part) {
            for (let i = 0; i < obj.topics.length; i++) {
              if (obj.topics[i] === obj.part) {
                obj.currentIndex = i;
                break;
              }
            }
          }

          if (obj.problem_advanced === "whole" && obj.step_num && obj.total_steps) {
            obj.currentIndex = Number(obj.step_num) - 1;
          }

          if (Object.keys(data[i]).indexOf("remove") !== -1) {
            for (let j = 0; j < data[i].remove.length; j++) {
              if (obj.hasOwnProperty(data[i].remove[j])) {
                delete obj[data[i].remove[j]]
              }
            }
          }

          setProblemRoadmap(obj);
        } else if (index[i] === 2) {
          obj.maps_to = data[i]["maps_to"];
          setProblemRoadmap(obj);
        } else if (index[i] === 3) {
          if (data[i].section === null) {
            setSection(null);
          } else if (!section || data[i].section !== section.section) {
            let ob = {};
            ob.section = data[i]["section"];

            setSection(ob);
          }
        } else if (index[i] === 4) {
          if (data[0].eta !== null) {
            newEta = data[0].eta;
            req.el.target.value = req.message;

            let payload = {sender: sessionId, message: req.message};
            let obj = {method: "POST", mode: "cors", body: JSON.stringify(payload), headers: {"Content-Type": "application/json"}};

            fetch(URI, obj).then(res => {
              res.json().then(data => {
                let pl = [{sender: payload.sender, text: payload.message}];
                let index = extractCustomIndices(data);
                const arr = pl.concat(index.length ? data.slice(index.length) : [...data]);
                let now = new Date();
                let hours = now.getHours() < 10 ? "0" + now.getHours() : now.getHours();
                let mins = now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes();
                let timestamp = hours + ":" + mins;
                for (let i = 0; i < arr.length; i++) {
                  arr[i].time = timestamp;
                }

                appendConversation(arr);
                setTurnCount([turnCount[0] + 2, turnCount[1] + arr.length]);
                updateComponents(index, data);
                req.el.target.value = "";
              });
            });  
          } else {
            newEta = null;
          }
          setEta(newEta);
        }
      }
    }
  }

  return (
    <div className="conversation-container">
      <div className="conversation-inner">
      {conversationHistory.map((msg, i) => {
        return <div className={msg.sender ? "conversation-entry green" : "conversation-entry red"} key={i}><div className="conversation-timestamp">{msg.time}</div><div className="conversation-text">{msg.text}</div></div>
      })}
      <input className="conversation-input" type="text" onKeyDown={submitMessage} placeholder="message here" />
      </div>
      {eta && <TimerView eta={eta} delay={500} />}
    </div>
  );
}

export default ConversationView;