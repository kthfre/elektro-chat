import logo from './logo.svg';
import './App.css';
import React, { useState, useEffect } from "react";
//import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import MainView from './view/main';
import HeaderView from './view/header';

function App() {

return (
  <div>
    <HeaderView />
    <MainView />
  </div>
);
}

export default App;
