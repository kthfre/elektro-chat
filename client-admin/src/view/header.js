/**
 * Handles the header view
 * @returns the header view.
 */

// const URI = window.location.href;
const URI = "http://localhost:4304/";

const HeaderView = ({user="", setAuth}) =>  {
  const logout = el => {
    setAuth(null);
    localStorage.removeItem("auth");
  }

  return (
    <div className="header-container">
      <div className="header-col">
        Hello {user}.
      </div>
      <div className="header-title">
        <h1>Theory/Problem insertion/removal</h1>
      </div>
      <div className="header-col small"></div>
      <div className="header-col small"></div>
      <div className="header-col small">
        <button><img src={URI + "images/icons8-shutdown-tr.gif"} alt="banana" onClick={logout} /></button>
      </div>
    </div>
  );
}

export default HeaderView;