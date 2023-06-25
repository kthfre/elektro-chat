import React, { useState, useEffect } from "react";

/**
 * Handles the topics view
 * @returns the topics view.
 */

const TopicsView = ({enable, topics}) =>  {
  const topicClass = index => {
    if (topics.type && topics.type === "part") {
      if (topics.currentIndex === index) {
        return "topics-box green";
      } else {
        return "topics-box red";
      }
    } else if (topics.type && topics.type === "whole") {
      if (topics.currentIndex === index) {
        return "topics-box green";
      } else {
        return "topics-box inactive";
      }
    }

    return "topics-box"
  }

  return (
     <div className="topics-container">
      {topics &&
      <div className="topics-inner">
        <div className="topics-box head">Problemsteg</div>
        {topics.topics.map((topic, i) => <div className={topicClass(i)} key={i}>{i + 1}. {topic}</div>)}
      </div>}
    </div>
  );
}

export default TopicsView;