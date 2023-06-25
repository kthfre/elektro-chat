import logo from './logo.svg';
import './App.css';
import React, { useState, useEffect } from "react";
import ListView from './view/list';
import HeaderView from './view/header';
import FormView from './view/form';
import AddView from './view/add';
import MapView from './view/map';
import LoginView from './view/login';

// const URI = window.location.href;
const URI = "http://localhost:4304/";

function App() {
  let [theory, setTheory] = useState([]);
  let [problems, setProblems] = useState([]);
  let [modules, setModules] = useState([]);
  let [conf, setConf] = useState(null); // {theory: false, simple: true, advanced: false, single: false, multi: true}
  let [setter, setSetter] = useState(null);
  let [mapFulfilled, setMapFulfilled] = useState(false);
  let [loadTree, setLoadTree] = useState(null);
  let [auth, setAuth] = useState(false);

  useEffect(() => {
    if (auth) {
      fetch(URI + "data", {headers: {"Authorization": "Bearer " + auth.token.token}}).then(res => {
        if (res.status === 200) {
          res.json().then(data => {
            setTheory(data[0]);
            setProblems(data[1]);
            setModules(data[2]);
          });
        }
      });
    }
  }, [auth]);

  return (
    <div className="App">
      {!auth && <LoginView setAuth={setAuth} />}
      {auth && <HeaderView user={auth.user} setAuth={setAuth} />}
      {auth && <FormView modules={modules} setConf={setConf} setConfOptions={setSetter} setMapFulfilled={setMapFulfilled} />}
      {auth && (problems.length > 0 || theory.length > 0) && <ListView theory={theory} problems={problems} setConf={setConf} setConfOptions={setter} setTheory={setTheory} setProblems={setProblems} setLoadTree={setLoadTree} token={auth.token.token} />}
      {auth && conf !== null && conf.multi && <MapView mapFulfilled={mapFulfilled} setMapFulfilled={setMapFulfilled} loadTree={loadTree} setLoadTree={setLoadTree} conf={conf} />}
      {auth && conf !== null && modules.length > 0 && (conf.theory || conf.single || mapFulfilled) && <AddView modules={modules} conf={conf} mapFulfilled={mapFulfilled} setTheory={setTheory} setProblems={setProblems} token={auth.token.token} />}
    </div>
  );
}

export default App;
