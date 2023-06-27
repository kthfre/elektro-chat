const http = require("http");
const https= require('https');
const fs = require('node:fs');
const hostname = "127.0.0.1";
const neo4j = require('neo4j-driver')
const express = require("express");
const bodyParser = require('body-parser')
const app = express();
const port = 3003;
const portHttps = 3333;
const driver = neo4j.driver('neo4j://127.0.0.1:7687', neo4j.auth.basic('neo4j', 'neo4j'));

// for HTTPS
// const options = {
//   key: fs.readFileSync('../private.key'),
//   cert: fs.readFileSync('../public.crt'),
// };

let currentSessionIds = [];
let sessionsCount = 0;
let sessionTimer = {};
let sessionLock = false;

app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(express.static('public'));

app.get("/:id", (req, res) => {
  const id = req.params.id;

  if (currentSessionIds.indexOf(id) === -1) {
    refreshSession(id);
    res.send({status: true, id});
  } else {
    res.send({status: false, id: null});
  }
});

app.post("/", (req, res) => {
  const sender = req.body.sender;
  const message = req.body.message;

  transmitToRasa(sender, message).then(res_ => {
    res_.json().then(data => {
      let arr = message === "/session_start" ? data.slice(0, 2) : [...data];
      const {array, index} = removeFromArray(arr, "custom");

      let tasks = [];
      if (index.length) {
        const customKeys = ["problem_id", ["problem_advanced", "part", "step_num", "total_steps", "topics"], "maps_to", "section", "eta"];
        const fnName = {problem_id: "getProblem", problem_advanced: "getAdvancedType", maps_to: "getMapping", section: "getSection", eta: "getEta"};
        let keyName, data;

        for (let i = 0; i < index.length; i++) {
          for (let j = 0; j < customKeys.length; j++) {
            let key = customKeys[j];
  
            if (customKeys[j] instanceof(Array)) {
              let found = Object.keys(arr[index[i]].custom).indexOf(customKeys[j][0]) !== -1 ? true : false;
  
              if (found) {
                keyName = customKeys[j][0];
                data = {}
  
                for (let k = 0; k < customKeys[j].length; k++) {
                  data[customKeys[j][k]] = arr[index[i]].custom[customKeys[j][k]];
                }
  
                break;
              }
            } else {
              if (Object.keys(arr[index[i]].custom).indexOf(key) !== -1) {
                keyName = key;
                data = arr[index[i]].custom[keyName];

                break;
              }
            }
          }

          tasks.push(db[fnName[keyName]](data));
        }
      }

      if (index.length) {
        Promise.all(tasks).then(data => {
          res.send(data.concat(array));
        });
      } else {
        res.send(array);
      } 
    });
  }).catch(err => {
    console.log("ERROR")
    console.log(err)
    res.send({error: err})
  });
});

// comment/uncomment these according to preferences
// http.createServer(app).listen(port, () => {
//   console.log(`HTTP: listen on port ${port}`)
// });

// https.createServer(options, app).listen(portHttps, () => {
//   console.log(`HTTPS: listen on port ${portHttps}`)
// });

// comment/uncomment according to preferences
app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});

function transmitToRasa(id, msg) {
  let obj = {
    method: "POST",
    mode: "cors",
    body: JSON.stringify({sender: id, message: msg})
  }

  return fetch("http://127.0.0.1:5005/webhooks/rest/webhook", obj);
}

function removeFromArray(arr, key) {
  arr = [...arr]
  let index = [];

  for (let i = 0; i < arr.length; i++) {
    if (Object.keys(arr[i]).indexOf(key) !== -1) {
      index.push(i);
    }
  }

  if (index.length) {
    if (index.length === 1 && index[0] === 0) {
      arr.shift();
    } else if (index.length === 1 && index[0] === arr.length - 1) {
      arr.pop();
    } else {
      let arrCopy = [...arr];
      let indexCopy = [...index];
      let arrNew =  [];
      indexCopy.unshift(-1);

      for (let i = 0; i < arr.length; i++) {
        if (index.indexOf(i) === -1) {
          arrNew.push(arr[i]);
        }
      }

      arr = arrNew;
    }
  }

  return {array: arr, index: index};
}

const db = {
  getProblem: function(id, isNumerical=false) {
    try {
      if (isNumerical) {
        id = Number(id);
      }

      const session = driver.session();
      return session.run("MATCH (p:Problem {id: $id})-[r:isType]->(t) return p, r, t", {id: id}).then(result => {
        let obj = {};
        result.records.forEach(record => {
          obj.id = id;
          obj.difficulty = record._fields[0].properties.difficulty;
          obj.images = record._fields[0].properties.images;
          obj.title = record._fields[0].properties.title;
          obj.type = record._fields[2].labels[0];
        });

        return obj;

        session.close();
      }).catch(err => {
        console.log("DATABASE SESSION ERROR")
        console.log(err)
      });
    } catch(err) {
      console.log("DATABASE ERROR")
      console.log(err)
    }
  },
  getAdvancedType: function(input) {
    return this.makeAsPromise(input);
  },
  getMapping: function(input) {
    input = {maps_to: input};

    return this.makeAsPromise(input);
  },
  getSection: function(input) {
    if (input === "null") {
      input = {section: null};
    } else {
      input = {section: input};
    }

    return this.makeAsPromise(input);
  },
  getEta: function(input) {
    if (input === "null") {
      input = {eta: null};
    } else {
      input = {eta: input};
    }

    return this.makeAsPromise(input);
  },
  makeAsPromise: function(input) {
    return new Promise((res, rej) => {
      try {
        let obj = {};

        for (let key of Object.keys(input)) {
          if (input.hasOwnProperty(key) && input[key] !== "N/A") {
            obj[key] = input[key];
          }
        }

        res(obj);
      } catch(err) {
        rej("Error: " + err);
      }
    });
  }
};

const createSessionTimer = (sessionId, delay, oldTimerId=null) => {
  if (oldTimerId) {
    clearTimeout(oldTimerId);
  }

  const timerId = setTimeout(() => {
    currentSessionIds[currentSessionIds.indexOf(sessionId)] = null;
    sessionTimer[sessionId] = null;
    sessionsCount--;
  }, delay);

  return timerId;
}

const copyArrayWithoutNulls = arr => {
  let array = [];

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null) {
      array.push(arr[i]);
    }
  }

  return array;
}

const refreshSession = sessionId => {
  // lock avoid race condition - shouldn't be possible but if in the future multi-threading would be utilized...
  if (sessionLock) {
    setTimeout(() => {
      refreshSession(sessionId)
    }, 50);
  }
  
  if (currentSessionIds.length - sessionsCount > 250) {
    sessionLock = true;
    currentSessionIds = copyArrayWithoutNulls(currentSessionIds);
    sessionLock = false;
  }

  if (currentSessionIds.indexOf(sessionId) === -1) {
    // add session
    currentSessionIds.push(sessionId);
    sessionTimer[sessionId] = createSessionTimer(sessionId, 900000);

    sessionsCount++;
  } else {
    // refresh
    sessionTimer[sessionId] = createSessionTimer(sessionId, 900000, sessionTimer[sessionId]);
  }
}