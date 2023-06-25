/**
 * Handles the feedback view
 * @returns the feedback view.
 */

const FeedbackView = ({conf}) =>  {

  return (
    <div className="feedback-container">
      {<div className={conf.error ? "feedback-inner feedback-error" : "feedback-inner feedback-success"}>
        {conf.message}
      </div>}
    </div>
  );
}

export default FeedbackView;