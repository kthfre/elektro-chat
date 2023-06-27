import React, { useState, useEffect, useRef } from "react";
import jwt_decode from "jwt-decode";

/**
 * Handles the login view
 * @returns the login view.
 */

const URI = window.location.href;
// const URI = "http://localhost:4304/";

const LoginView = ({setAuth}) =>  {
  let [feedback, setFeedback] = useState("");
  const timerId = useRef(null);

  useEffect(() => {
    let auth = localStorage.getItem("auth");
    
    if (auth) {
      auth = JSON.parse(auth);

      fetch(URI + "auth", {headers: {"Authorization": "Bearer " + auth.token.token}}).then(res => {
        if (res.status === 200) {
          setAuth(auth);
        } else {
          setAuth(false);
        }
      });
    }
    
  }, []);

  const login = el => {
    const userName = el.target.parentElement.children[0].value;
    const password = el.target.parentElement.children[1].value;
    const obj = {method: "POST", body: JSON.stringify({userName, password}), mode: "cors", headers: {"Content-Type": "application/json"}};
    fetch(URI + "login", obj).then(res => {
      if (res.status === 200) {
        res.json().then(data => {
          const auth = {token: data, user: jwt_decode(data.token).user}
          setAuth(auth);
          localStorage.setItem("auth", JSON.stringify(auth));
          const tt= JSON.parse(localStorage.getItem("auth"));
        });
      } else if (res.status === 401) {
        setFeedback("Invalid credentials.");
        clean();
      } else {
        setFeedback("Server error.");
        clean()
      }

      function clean() {
        timerId.current = setTimeout(() => {
          setFeedback("");

          if (timerId && timerId.current) {
            timerId.current = null;
          }
        }, 2000);
      }
    });
  }

  return (
    <div className="login-container">
      <div className="login-inner">
        <div className="login-title">
          <div className="one">
            Login
          </div>
          <div className={feedback === "" ? "two" : "two fail"}>
            {feedback === "" ? "ElektroBase!" : "Implosion!"}
          </div>
        </div>
        <div className={feedback === "" ? "login-feedback" : "login-feedback active"}>
          {feedback}
        </div>
        <div className="login-input">
          <input type="text" placeholder="username" />
          <input type="password" placeholder="password" />
          <input type="button" value="Launch!" onClick={login} />
        </div>
      </div>
    </div>
  );
}

export default LoginView;