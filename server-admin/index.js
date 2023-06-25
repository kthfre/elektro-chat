const http = require("http");
const https= require('https');
const fs = require('node:fs');
const hostname = "127.0.0.1";
const neo4j = require('neo4j-driver')
const express = require("express");
const bodyParser = require('body-parser');
const jsonwt = require('jsonwebtoken');
const {expressjwt: jwt} = require("express-jwt");
const { promises } = require("dns");
const { Client } = require('pg')
const argon2 = require('argon2');
const app = express();
const port = 4304;
const portHttps = 44344;
const driver = neo4j.driver('bolt://127.0.0.1:7687', neo4j.auth.basic('neo4j', 'neo4j'));

const options = {};
// const options = {
//   key: fs.readFileSync('../private.key'),
//   cert: fs.readFileSync('../public.crt'),
// };

const secret = "somelongsecretkey";

app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});

app.use(express.static('public'));

app.post("/login", (req, res) => {
  const userName = req.body.userName;
  const password = req.body.password;
  
  // circumvent userdb for development purposes
  // let payload = {user: userName, exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60), iss: "https://elektro.base"};
  // let token = jsonwt.sign(payload, secret);
  // res.send({token});

  // for production use with userdb
  const isValid = verifyUser(userName, password);

  isValid.then(verRes => {
    if (!verRes) {
      res.sendStatus(401);
    } else {
      let payload = {user: userName, exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60), iss: "https://elektro.base"};
      let token = jsonwt.sign(payload, secret);

      res.send({token});
    }
  });
});

app.get("/auth", jwt({secret, algorithms: ["HS256"]}), (req, res) => {
  res.send({});
});

app.get("/data", jwt({secret, issuer: "https://elektro.base", algorithms: ["HS256"]}), (req, res) => {
  Promise.all([getTheory(), getProblems(), getModules()]).then(data => {
    convertIntegerIds(data[1]);

    res.send(data);
  }); 
});

app.post("/problem", jwt({secret, issuer: "https://elektro.base", algorithms: ["HS256"]}), (req, res) => {
  const moduleName = req.body.module[0][0].value;
  const problemId = req.body.problemId[0][0].value;
  const problemType = req.body.type;
  const difficulty = req.body.difficulty;
  let images = [];
  const imageArr = req.body.images;

  for (let i = 0; i < imageArr.length; i++) {
    images.push(imageArr[i][0].value);
  }

  const problemTitle = req.body.problemTitle.length && req.body.problemTitle[0][0].value ? req.body.problemTitle[0][0].value : "";
  const step = req.body.steps;

  problemExists(problemId).then(existRes => {
    const exists = existRes.records[0]._fields[0];
    const overwrite = req.body.overwrite;

    if (exists && !overwrite) {
      res.send({message: "Problem already exists, id must be unique.", error: true});
    } else {
      let promise;

      if (exists) {
        deleteProblem(problemId).then(res => {
          promise = insertProblem();
        });
      } else {
        promise = insertProblem();
      }

      function insertProblem() {
        let promise;

        if (problemType === "single") {
          if (difficulty === "simple") {
            promise = addSingleSimpleProblem(moduleName, problemId, images, problemTitle, step);
          } else {
            promise = addSingleAdvancedProblem(moduleName, problemId, images, problemTitle, step);
          }
        } else {
          const tree = req.body.tree;
          const mappedLetters = [...req.body.mappedLetters];
  
          if (difficulty === "simple") {
            promise = addMultiSimpleProblem(moduleName, problemId, images, problemTitle, step, tree, mappedLetters);
          } else {
            promise = addMultiAdvancedProblem(moduleName, problemId, images, problemTitle, step, tree, mappedLetters);
          }
        }

        return promise;
      }

      setTimeout(() => {
        getProblems().then(data => {
          convertIntegerIds(data);
          res.send({data, message: "Problem inserted into knowledge base.", error: false});
        });
      }, 1000);
    }
  });
});

app.post("/theory", jwt({secret, issuer: "https://elektro.base", algorithms: ["HS256"]}), (req, res) => {
  const modul = req.body.module[0][0].value;
  let theoryTexts = [];

  for (let i = 0; i < req.body.texts.length; i++) {
    theoryTexts.push({title: req.body.texts[i][0].value, text: req.body.texts[i][1].text});
  }

  theoryExists(theoryTexts[0].title).then(existRes => {
    const exists = existRes.records[0]._fields[0];

    if (exists) {
      res.send({message: "Theory text with that title already exists, title must be unique.", error: true});
    } else {
      addTheory(modul, theoryTexts).then(theoryRes => {
        getTheory().then(data => {
          res.send({data, message: "Theory inserted into knowledge base.", error: false});
        });
      }); 
    }
  });
});

app.delete("/problem/:id", jwt({secret, issuer: "https://elektro.base", algorithms: ["HS256"]}), (req, res) => {
  const problemId = req.params.id;
  
  deleteProblem(problemId).then(deleteRes => {
    getProblems().then(data => {
      convertIntegerIds(data);
      res.send({data, message: "Problem deleted from knowledge base.", error: false});
    });
  });
});

app.delete("/theory/:title", jwt({secret, issuer: "https://elektro.base", algorithms: ["HS256"]}), (req, res) => {
  const title = req.params.title;

  deleteTheory(title).then(deleteRes => {
    getTheory().then(data => {
      res.send({data, message: "Theory text deleted from knowledge base.", error: false});
    });
  });
});

http.createServer(app).listen(port, () => {
  console.log(`HTTP: listen on port ${port}`)
});
https.createServer(options, app).listen(portHttps, () => {
  console.log(`HTTPS: listen on port ${portHttps}`)
});

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}!`);
// });

const getModules = () => {
  try {
    const session = driver.session();
    return session.run(
      "MATCH (m:Module) return m").then(result => {
      let arr = [];

      result.records.forEach(record => {
        let obj = {};

        obj.name = record._fields[0].properties.name
        obj.number = record._fields[0].properties.number.low

        arr.push(obj);
      });

      return makePromise(arr);
    })
  } catch(err) {
    console.log("ERROR RETRIEVING MODULES FROM DB");
    console.log(err)
  }   
}

const getTheory = () => {
  try {
    const session = driver.session();

    return session.run(
      "MATCH path = (m:Module)-[:hasTheory]->(n:Theory) \
      WITH collect(path) AS paths \
      CALL apoc.convert.toTree(paths, false) \
      YIELD value AS theory \
      RETURN theory").then(result => {
      let arr = [];

      if (!(result.records.length === 1 && Object.keys(result.records[0]._fields[0]).length === 0)) {
        result.records.forEach(record => {
          let obj = {};

          obj.module = record._fields[0].name
          obj.title = record._fields[0].hasTheory[0].title
          obj.text = record._fields[0].hasTheory[0].text
          const modul = obj.module = record._fields[0].name;

          for (let i = 0; i < record._fields[0].hasTheory.length; i++) {
            arr.push({module: modul, title: record._fields[0].hasTheory[i].title, text: record._fields[0].hasTheory[i].text});
          }
        });
      }

      return makePromise(arr);
    })
  } catch(err) {
    console.log("ERROR RETRIEVING THEORY FROM DB");
    console.log(err)
  }      
}

const getProblems = () => {
    try {
      const session = driver.session();

      return session.run(
        "MATCH path = (m:Module)-[:hasProblem]->(n:Problem)-[r*]->(b:Reading|Hint|Solution|StepId|Knowledge) \
        WITH collect(path) AS paths \
        CALL apoc.convert.toTree(paths, false) \
        YIELD value AS problem \
        RETURN problem").then(result => {
        let arr = [];

        if (!(result.records.length === 1 && Object.keys(result.records[0]._fields[0]).length === 0)) {
          result.records.forEach(record => {
            record._fields[0].hasProblem.forEach(problem => {
              let obj = {};

              obj.module = record._fields[0].name;
              obj.id = problem.id;
              obj.difficulty = problem.difficulty;
              obj.title = (!problem.title || problem.title === "") ? "" : problem.title;
              obj.images = problem.images;
              obj.type = problem.isType[0]._type;

              if (obj.type === "SingleAnswer") {
                let steps = [];
                let root = problem.isType[0];

                while (!root.hasSolution) {
                  root = root.hasStep[0];
                  let stepObj = {keywords: root.keywords};

                  if (root.hasHint) {
                    stepObj.hint = root.hasHint[0].text;
                  }

                  if (root.hasKnowledge) {
                    stepObj.knowledge = {questions: root.hasKnowledge[0].questions, answers: root.hasKnowledge[0].answers, interpretation: root.hasKnowledge[0].text};
                  }

                  if (root.reading) {
                    stepObj.reading = {book: root.reading[0].book, section: root.reading[0].section};
                  }

                  steps.push(stepObj);
                }

                obj.steps = steps;
              } else if (obj.type === "MultiAnswer") {
                let steps = {};
                let root = problem.isType[0];
  
                for (let i = 0; i < root.isMappedTo.length; i++) {
                  let rootStep = root.isMappedTo[i];
                  const stepId = rootStep.id;
                  steps[stepId] = [];
                  let j = 0;

                  while (true) { // !rootStep.hasSolution || j === 0
                    let stepObj = {keywords: rootStep.keywords};
    
                    if (rootStep.hasHint) {
                      stepObj.hint = rootStep.hasHint[0].text;
                    }
    
                    if (rootStep.hasKnowledge) {
                      stepObj.knowledge = {questions: rootStep.hasKnowledge[0].questions, answers: rootStep.hasKnowledge[0].answers, interpretation: rootStep.hasKnowledge[0].text};
                    }
    
                    if (rootStep.reading) {
                      stepObj.reading = {book: rootStep.reading[0].book, section: rootStep.reading[0].section};
                    }
    
                    steps[stepId].push(stepObj);
                    j++;

                    if (!rootStep.hasSolution) {
                      rootStep = rootStep.hasStep[0];
                    } else {
                      break;
                    }
                  }
                }
  
                root = root.hasObject[0];
                let map = {question: root.question, answers: root.answers};
                let mapQueue = [map];
                let queue = [root];

                while (queue.length > 0) {
                  let node = queue.shift();
                  let mapNode = mapQueue.shift();

                  if (node.hasObject) {
                    for (let i = 0; i < node.hasObject.length; i++) {
                      let answer = node.hasObject[i]["hasObject.answer"];
                      mapNode[answer] = {question: node.hasObject[i].question, answers: node.hasObject[i].answers};
                      mapQueue.push(mapNode[answer]);
                      queue.push(node.hasObject[i]);
                    }
                  }

                  if (node.mapsTo) {
                    for (let i = 0; i < node.mapsTo.length; i++) {
                      let answer = node.mapsTo[i]["mapsTo.answer"];
                      mapNode[answer] = {maps_to: node.mapsTo[i].id};
                    }
                  }
                }

                obj.steps = steps;
                obj.map = map;
              }

              arr.push(obj);
            });
          });
        }

        return makePromise(arr);
      })
    } catch(err) {
      console.log("ERROR RETRIEVING PROBLEMS FROM DB");
      console.log(err)
    }      
}

const convertIntegerIds = data => {
  for (let i = 0; i < data.length; i++) {
    if (data[i].id instanceof Object) {
      data[i].id = String(data[i].id.low);
    }
  }
}

const theoryExists = name => {
  const session = driver.session();
  return session.run("OPTIONAL MATCH (n:Theory {title: $name}) RETURN n IS NOT NULL AS Predicate", {name: name}).then(result => {
    return result;
  });
}

const problemExists = id => {
  const session = driver.session();
  return session.run("OPTIONAL MATCH (n:Problem {id: $id}) RETURN n IS NOT NULL AS Predicate", {id: id}).then(result => {
    return result;
  });
}

const addTheory = (modul, theory) => {
  try {
    let promises = [];
    let sessions = [];

    for (let i = 0; i < theory.length; i++) {
      const session = driver.session();
      const theoryPromise = session.run("MATCH (m:Module) where m.name = $module CREATE (m)-[:hasTheory]->(:Theory {title: $title, text: $text})", {module: modul, title: theory[i].title, text: theory[i].text});
      promises.push(theoryPromise);
      sessions.push(session);
    }

    return Promise.all(promises).then(res => {
      for (let i = 0; i < sessions.length; i++) {
        sessions[i].close();
      }
    });
    } catch(err) {
      console.log("database error")
      console.log(err)
    }
}

const addSingleSimpleProblem = (modul, id, images, title, steps) => {
  try {
    const stepsData = extractStepsData(steps);
    const session = driver.session();

    return session.run("MATCH (m:Module) where m.name = $module CREATE (m)-[:hasProblem]->(problem:Problem {difficulty: 'simple', id: $id, images: $images, title: $title})-[r:isType]->(s:SingleAnswer)-[:hasStep]->(step1:Step {keywords: []})-[:hasSolution]->(:Solution) return problem, step1", {module: modul, id: id, images: images, title: title}).then(result => {
      let obj = {};

      result.records.forEach(record => {
        const stepId = record.get("step1").identity.low;
        let sessions = [];
        let promises = [];
        
        if (stepsData[0].hint) {
          const hintSession = driver.session();
          let hintPromise = hintSession.run("MATCH (s:Step) where ID(s) = $stepId CREATE (s)-[:hasHint]->(h:Hint {text: $hint}) return s, h", {stepId: stepId, hint: stepsData[0].hint}).then(hintRes => {
            return hintRes;
          });

          promises.push(hintPromise);
          sessions.push(hintSession);
        }

        if (stepsData[0].knowledge) {
          const knowledgeSession = driver.session();
          let knowledgePromise = knowledgeSession.run("MATCH (s:Step) where ID(s) = $stepId CREATE (s)-[:hasKnowledge]->(k:Knowledge {questions: $questions, answers: $answers, text: $text}) return s, k", {stepId: stepId, questions: [...stepsData[0].knowledge.questions], answers: [...stepsData[0].knowledge.answers], text: [...stepsData[0].knowledge.text]}).then(knowledgeRes => {
            return knowledgeRes;
          });

          promises.push(knowledgePromise);
          sessions.push(knowledgeSession);
        }

        if (stepsData[0].reading) {
          const readingSession = driver.session();
          let readingPromise = readingSession.run("MATCH (s:Step) where ID(s) = $stepId CREATE (s)-[:hasReading]->(r:Reading {book: $book, section: $section}) return s, r", {stepId: stepId, book: stepsData[0].reading.book, section: stepsData[0].reading.section}).then(readingRes => {
            return readingRes;
          });

          promises.push(readingPromise);
          sessions.push(readingSession);
        }
        
        return Promise.all(promises).then(resAll => {
          for (let i = 0; i < sessions.length; i++) {
            sessions[i].close;
          }

          session.close();
        });
      });
    }).catch(err => {
      console.log("database session error")
      console.log(err)
    });
  } catch(err) {
    console.log("database error")
    console.log(err)
  }
}

const addMultiSimpleProblem = (modul, id, images, title, steps, tree, mappedLetters) => {
  try {
    const stepsData = extractStepsData(steps);

    const session = driver.session(); // {database: 'Electrical Engineering', defaultAccessMode: neo4j.session.READ}
    let seeObj = session.run("MATCH (m:Module) where m.name = $module CREATE (m)-[:hasProblem]->(problem:Problem {difficulty: 'simple', id: $id, images: $images, title: $title})-[r:isType]->(mu:MultiAnswer) return problem, mu", {module: modul, id: id, images: images, title: title}).then(result => {
      let prom;
      result.records.forEach(record => {       
        const multiAnswerId = record.get("mu").identity.low;
        
        let sessions = [];
        let promises = [];

        prom = insertMultiAnswerStepMapping(multiAnswerId, stepsData, mappedLetters, sessions, promises);

        return prom.then(res => {
          for (let i = 0; i < sessions.length; i++) {
            sessions[i].close();
          }
          sessions = [];
          promises = [];

          let travObj = traverseAndInsertMapObjectTree(multiAnswerId, tree, sessions, promises);

          return travObj
        });
      });

      return prom;
    }).catch(err => {
      console.log("database session error")
      console.log(err)
    });

    return seeObj;
  } catch(err) {
    console.log("database error")
    console.log(err)
  }
}

const addSingleAdvancedProblem = (modul, id, images, title, steps) => {
  try {
    const stepsData = extractStepsData(steps);

    const session = driver.session();
    return session.run("MATCH (m:Module) where m.name = $module CREATE (m)-[:hasProblem]->(problem:Problem {difficulty: 'advanced', id: $id, images: $images, title: $title})-[r:isType]->(s:SingleAnswer)-[:hasStep]->(step1:Step {keywords: $keywords}) return problem, step1", {module: modul, id: id, images: images, title: title, keywords: [...stepsData[0].keywords]}).then(result => {
      result.records.forEach(record => {
        const stepId = record.get("step1").identity.low;
        let sessions = [];

        return insertSingleAnswerStepData(stepId, stepsData, sessions).then(resAll => {
          for (let i = 0; i < sessions.length; i++) {
            sessions[i].close;
          }
          
          session.close();
          sessions = [];
          let stepIdCache = [];
          return traverseAndInsertSingleAnswerSteps(stepId, stepsData.slice(1), sessions, stepIdCache);
        });
      });
    }).catch(err => {
      console.log("database session error")
      console.log(err)
    });
  } catch(err) {
    console.log("database error")
    console.log(err)
  }
}

const addMultiAdvancedProblem = (modul, id, images, title, steps, tree, mappedLetters) => {
  try {
    let stepsData = [];
    for (let i = 0; i < steps.length; i++) {
      let sData = extractStepsData(steps[i]);
      stepsData.push(sData);
    }

    const session = driver.session();
    let seeObj = session.run("MATCH (m:Module) where m.name = $module CREATE (m)-[:hasProblem]->(problem:Problem {difficulty: 'advanced', id: $id, images: $images, title: $title})-[r:isType]->(mu:MultiAnswer) return problem, mu", {module: modul, id: id, images: images, title: title}).then(result => {
      let prom;
      result.records.forEach(record => {
        const multiAnswerId = record.get("mu").identity.low;
        
        let sessions = [];
        let promises = [];

        prom = insertMultiAnswerStepMappingAdvanced(multiAnswerId, stepsData, mappedLetters, sessions, promises);

        return prom.then(res => {
          for (let i = 0; i < sessions.length; i++) {
            sessions[i].close();
          }

          sessions = [];
          promises = [];

          let travObj = traverseAndInsertMapObjectTree(multiAnswerId, tree, sessions, promises);

          return travObj
        });
      });

      return prom;
    }).catch(err => {
      console.log("database session error")
      console.log(err)
    });

    return seeObj;
  } catch(err) {
    console.log("database error")
    console.log(err)
  }
}

const deleteTheory = name => {
  const session = driver.session();
  return session.run("MATCH path = (n:Theory) where n.title = $title CALL {with path detach delete path}", {title: name}).then(result => {
    return result;
  });
}

const deleteProblem = id => {
  const session = driver.session();
  return session.run("MATCH path = (n:Problem)-[r*]->(b:Reading|Hint|Solution|StepId|Knowledge) where n.id = $id CALL {with path detach delete path}", {id: id}).then(result => {
    return result;
  });
}

const traverseAndInsertSingleAnswerSteps = (stepId, stepsData, sessions, stepIdCache, promiseMe=null) => {
  function insertMe() {
    const session = driver.session();
    return session.run("MATCH (step:Step) where ID(step) = $id CREATE (step)-[:hasStep]->(step2:Step {keywords: $keywords}) return step, step2", {id: stepId, keywords: stepsData[0].keywords}).then(results => {
      results.records.forEach(record => {
        const nextStepId = record.get("step2").identity.low;
        const nextStepsData = stepsData.slice(1);
        let stepObj = insertSingleAnswerStepData(nextStepId, stepsData, sessions);
        session.close();

        if (!nextStepsData.length) {
          stepIdCache.push(nextStepId);
          return stepObj.then(stepRes => {
            const finalStepSession = driver.session();

            return finalStepSession.run("MATCH (step:Step) where ID(step) = $id CREATE (step)-[:hasSolution]->(:Solution)", {id: nextStepId});
          });
        } else {
          return traverseAndInsertSingleAnswerSteps(nextStepId, nextStepsData, sessions, stepIdCache, stepObj);
        }
      });
    });
  }

  stepIdCache.push(stepId);

  if (!promiseMe) {
    return insertMe();
  } else {
    promiseMe.then(res => {
      return insertMe();
    });
  }
}

const insertSingleAnswerStepData = (stepId, stepsData, sessions) => {
        let promises = [];
        
        if (stepsData[0].hint) {
          const hintSession = driver.session();
          let hintPromise = hintSession.run("MATCH (s:Step) where ID(s) = $stepId CREATE (s)-[:hasHint]->(h:Hint {text: $hint}) return s, h", {stepId: stepId, hint: stepsData[0].hint}).then(hintRes => {

            return hintRes;
          });

          promises.push(hintPromise);
          sessions.push(hintSession);
        }

        if (stepsData[0].knowledge) {
          const knowledgeSession = driver.session();

          let knowledgePromise = knowledgeSession.run("MATCH (s:Step) where ID(s) = $stepId CREATE (s)-[:hasKnowledge]->(k:Knowledge {questions: $questions, answers: $answers, text: $text}) return s, k", {stepId: stepId, questions: [...stepsData[0].knowledge.questions], answers: [...stepsData[0].knowledge.answers], text: [...stepsData[0].knowledge.text]}).then(knowledgeRes => {

            return knowledgeRes;
          });

          promises.push(knowledgePromise);
          sessions.push(knowledgeSession);
        }

        if (stepsData[0].reading) {
          const readingSession = driver.session();
          let readingPromise = readingSession.run("MATCH (s:Step) where ID(s) = $stepId CREATE (s)-[:hasReading]->(r:Reading {book: $book, section: $section}) return s, r", {stepId: stepId, book: stepsData[0].reading.book, section: stepsData[0].reading.section}).then(readingRes => {

            return readingRes;
          });

          promises.push(readingPromise);
          sessions.push(readingSession);
        }
        
        return Promise.all(promises);
}

const insertMultiAnswerStepMapping = (multiAnswerId, steps, mappedLetters, sessions, promises) => {
  for (let i = 0; i < mappedLetters.length; i++) {
    const session = driver.session();
    let promise = session.run("MATCH (mu:MultiAnswer) where ID(mu) = $multiId CREATE (mu)-[:isMappedTo]->(step:Step {id: $letter, keywords: []})-[:hasSolution]->(:Solution) return step", {multiId: multiAnswerId, letter: mappedLetters[i]});

    sessions.push(session);
    promises.push(promise);
  }
  
  let stepPromises = [];
  return Promise.all(promises).then(res => {
    for (let i = 0; i < mappedLetters.length; i++) {
      const stepId = res[i].records[0].get("step").identity.low;

      if (steps[i].hint) {
        const hintSession = driver.session();
        const hintPromise = hintSession.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasHint]->(:Hint {text: $hint})", {stepId: stepId, hint: steps[i].hint});

        sessions.push(hintSession);
        stepPromises.push(hintPromise);
      }

      if (steps[i].knowledge) {
        const knowledgeSession = driver.session();
        const knowledgePromise = knowledgeSession.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasKnowledge]->(:Knowledge {questions: $questions, answers: $answers, text: $interpretation})", {stepId: stepId, questions: [...steps[i].knowledge.questions], answers: [...steps[i].knowledge.answers], interpretation: [...steps[i].knowledge.text]});

        sessions.push(knowledgeSession);
        stepPromises.push(knowledgePromise);
      }

      if (steps[i].reading) {
        const readingSession = driver.session();
        const readingPromise = readingSession.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasReading]->(:Reading {book: $book, section: $section})", {stepId: stepId, book: steps[i].reading.book, section: steps[i].reading.section});

        sessions.push(readingSession);
        stepPromises.push(readingPromise);
      }
    }

    return Promise.all(stepPromises);
  });
}

const insertMultiAnswerStepMappingAdvanced = (multiAnswerId, steps, mappedLetters, sessions, promises) => {
  for (let i = 0; i < mappedLetters.length; i++) {
    const session = driver.session();
    let promise = session.run("MATCH (mu:MultiAnswer) where ID(mu) = $multiId CREATE (mu)-[:isMappedTo]->(step:Step {id: $letter, keywords: $keywords}) return step", {multiId: multiAnswerId, letter: mappedLetters[i], keywords: [...steps[i][0].keywords]});

    sessions.push(session);
    promises.push(promise);
  }
  
  let stepPromises = [];
  return Promise.all(promises).then(res => {
    let initialDataPromises = [];

    for (let i = 0; i < sessions.length; i++) {
      sessions[i].close();
    }

    sessions = [];

    for (let i = 0; i < mappedLetters.length; i++) {
      const stepId = res[i].records[0].get("step").identity.low;

      const initialDataPromise = insertAdditionalStepData(stepId, [steps[i][0]], sessions, steps[i].length === 1 ? true : false);
      initialDataPromises.push(initialDataPromise);
    }
    
    Promise.all(initialDataPromises).then(r => {
      for (let i = 0; i < sessions.length; i++) {
        sessions[i].close();
      }

      sessions = [];

      for (let i = 0; i < mappedLetters.length; i++) {
        const stepId = res[i].records[0].get("step").identity.low;
  
        if (steps[i].length === 1) {
          continue;
        }
  
        const stepPromise = traverseAndInsertSteps(stepId, steps[i].slice(1), sessions);
        stepPromises.push(stepPromise);
      }
      
      return Promise.all(stepPromises);
    });
  });

  function insertAdditionalStepData(sId, sData, sessions = [], isFinal = false) {
    let stepPromises = [];

    if (sData[0].hint) {
      const hintSession = driver.session();
      const hintPromise = hintSession.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasHint]->(:Hint {text: $hint})", {stepId: sId, hint: sData[0].hint});

      sessions.push(hintSession);
      stepPromises.push(hintPromise);
    }

    if (sData[0].knowledge) {
      const knowledgeSession = driver.session();
      const knowledgePromise = knowledgeSession.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasKnowledge]->(:Knowledge {questions: $questions, answers: $answers, text: $interpretation})", {stepId: sId, questions: [...sData[0].knowledge.questions], answers: [...sData[0].knowledge.answers], interpretation: [...sData[0].knowledge.text]});

      sessions.push(knowledgeSession);
      stepPromises.push(knowledgePromise);
    }

    if (sData[0].reading) {
      const readingSession = driver.session();
      const readingPromise = readingSession.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasReading]->(:Reading {book: $book, section: $section})", {stepId: sId, book: sData[0].reading.book, section: sData[0].reading.section});

      sessions.push(readingSession);
      stepPromises.push(readingPromise);
    }

    if (isFinal) {
      const finalSession = driver.session();
      const finalPromise = finalSession.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasSolution]->(:Solution)", {stepId: sId});

      sessions.push(finalSession);
      stepPromises.push(finalPromise);
    }

    return Promise.all(stepPromises);
  }

  function traverseAndInsertSteps(sId, sData, sessions = [], promiseMe = null) {
    if (promiseMe) {
      const session = driver.session();
      sessions.push(session);

      if (sData.length === 1) {
        return promiseMe.then(res => {
          const promise = session.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasStep]->(nextStep:Step {keywords: $keywords}) return nextStep", {stepId: sId, keywords: [...sData[0].keywords]});

          return promise.then(res => {
            const nextId = res.records[0].get("nextStep").identity.low;

            return insertAdditionalStepData(nextId, sData, sessions, true);
          });
        });
      } else {
        return promiseMe.then(res => {
          const promise = session.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasStep]->(nextStep:Step {keywords: $keywords}) return nextStep", {stepId: sId, keywords: [...sData[0].keywords]});

          return promise.then(res => {
            const nextId = res.records[0].get("nextStep").identity.low;

            const dataPromise = insertAdditionalStepData(nextId, sData, sessions);
            return traverseAndInsertSteps(nextId, sData.slice(1), sessions, dataPromise);
          });
        });
      }
    } else {
      const session = driver.session();
      sessions.push(session);

      if (sData.length === 1) {
        const promise = session.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasStep]->(nextStep:Step {keywords: $keywords}) return nextStep", {stepId: sId, keywords: [...sData[0].keywords]});

        return promise.then(res => {
          const nextId = res.records[0].get("nextStep").identity.low;

          return insertAdditionalStepData(nextId, sData, sessions, true);
        });
      } else {
        const promise = session.run("MATCH (step:Step) where ID(step) = $stepId CREATE (step)-[:hasStep]->(nextStep:Step {keywords: $keywords}) return nextStep", {stepId: sId, keywords: [...sData[0].keywords]});

        return promise.then(res => {
          const nextId = res.records[0].get("nextStep").identity.low;

          const dataPromise = insertAdditionalStepData(nextId, sData, sessions);
          return traverseAndInsertSteps(nextId, sData.slice(1), sessions, dataPromise);
        });
      }
    }
  }
}

const traverseAndInsertMapObjectTree = (multiAnswerId, tree, sessions, promises) => {
  const session = driver.session();
  let promise = session.run("MATCH (mu:MultiAnswer) where ID(mu) = $multiId CREATE (mu)-[:hasObject]->(map:MapObject {question: $question, answers: $answers}) return map", {multiId: multiAnswerId, question: tree.question, answers: [...tree.answers]});
  promises.push(promise);
  sessions.push(session);

  let count = [0];
  traverseCount(tree, null, count);

  function traverseCount(node, promise, count) {
    for (let i = 0; i < node.answers.length; i++) {

      if (node[node.answers[i]].maps_to && !node[node.answers[i]].question && !node[node.answers[i]].answers) {
        count[0]++;
      } else if (node[node.answers[i]].question && node[node.answers[i]].answers && !node[node.answers[i]].maps_to) {
        traverseCount(node[node.answers[i]], null, count);
      }
    }
  }

  async function createPromise() {
    return 33;
  }
  let promiseArray = [];
  for (let i = 0; i < count[0]; i++) {
    promiseArray.push(createPromise);
  }

  traverse(tree, sessions, promises, promise, 0, true);
  let outside = 0;

  function traverse(node, sessions, promises, promiseMe, rootId, isRoot=false) {
    if (isRoot) {
      return promiseMe.then(res => {
        const mapId = res.records[0].get("map").identity.low;

        for (let i = 0; i < node.answers.length; i++) {
          const session = driver.session();

          if (node[node.answers[i]].maps_to && !node[node.answers[i]].question && !node[node.answers[i]].answers) {
            let promise = session.run("MATCH (map:MapObject) where ID(map) = $mapId CREATE (map)-[:mapsTo {answer: $answer}]->(:StepId {id: $stepId})", {mapId: mapId, answer: node.answers[i], stepId: node[node.answers[i]].maps_to});
            
            promises.push(promise);
            sessions.push(session);

            promiseArray[outside] = promiseArray[outside++]()

            // return promise;
          } else if (node[node.answers[i]].question && node[node.answers[i]].answers && !node[node.answers[i]].maps_to) {
            let promise = session.run("MATCH (m:MapObject) where ID(m) = $mapId CREATE (m)-[:hasObject {answer: $answer}]->(map:MapObject {question: $question, answers: $answers}) return map", {mapId: mapId, answer: node.answers[i], question: node[node.answers[i]].question, answers: [...node[node.answers[i]].answers]});
            
            // promises.push(promise);
            sessions.push(session);

            let val = traverse(node[node.answers[i]], sessions, promises, promise, mapId, true);

            // return val;
          } else {
            // console.log("here")
          }
        }
      });
    }    
  }

    let promObj = Promise.all(promiseArray);

    return setTimeout(() => {
      return promObj;
    }, 1500);
}

const extractStepsData = data => {
  let translate = {question: "questions", answer: "answers", interpretation: "text"};
  let stepsData = [];

  for (let i = 0; i < data.length; i++) {
    stepsData.push({});

    if (data[i].keywords) {
      stepsData[i].keywords = [];

      for (let j = 0; j < data[i].keywords.length; j++) {
        for (let k = 0; k < data[i].keywords[j].length; k++) {         
          stepsData[i].keywords.push(data[i].keywords[j][k].value);
        }
      }
    }

    if (data[i].hint) {
      stepsData[i].hint = data[i].hint[0][0].value;
    }
  
    if (data[i].knowledge) {
      stepsData[i].knowledge = {questions: [], answers: [], text: []};
  
      for (let j = 0; j < data[i].knowledge.length; j++) {
        for (let k = 0; k < data[i].knowledge[j].length; k++) {
          const key = translate[data[i].knowledge[j][k].title];
          
          stepsData[i].knowledge[key].push(data[i].knowledge[j][k].value);
        }
      }
    }
  
    if (data[i].reading) {
      stepsData[i].reading = {book: data[i].reading[0][0].value, section: data[i].reading[0][1].value};
    }
  }

  return stepsData;
}

// change according to needs
function verifyUser(username, password) {
  const client = new Client({
    database: 'elektrouser',
    user: 'postgres',
    password: 'postgres',
  });
  
  return client.connect().then(res => {
    const query = "SELECT password from users WHERE username = $1";

    return client.query(query, [username]).then(queryRes => {
      const pw = queryRes.rows[0].password;

      return argon2.verify(pw, password).then(verRes => {
        return verRes;
      });
    });

  });
}

const makePromise = input => {
  return new Promise((res, rej) => {
    try {
      res(input);
    } catch(err) {
      console.log(err)
      rej("Error: " + err);
    }
  });
}