import React, { useState, useEffect } from "react";

/**
 * Handles the image view
 * @returns the image view.
 */

const URI = window.location.href;
// const URI = "http://localhost:3003/";

const ImageView = ({imageDetails}) =>  {
  let [title, setTitle] = useState("");
  let [images, setImages] = useState([]);

  useEffect(() => {
    if (imageDetails) {
      setTitle(imageDetails.title);
      setImages([...imageDetails.images]);
    } else {
      setTitle("");
      setImages([]);
    }
  }, [imageDetails]);

  return (
     <div className="image-container">
      <div className="image-title">{title}</div>
      {imageDetails && images.length > 0 &&
        <div className="image-inner">
          {images.map((image, i) => <img src={(image.indexOf("http://") !== -1 || image.indexOf("https://") !== -1 ? image : URI + "images/" + image + ".png")} alt="banana" key={i} />)}
        </div>
      }
    </div>
  );
}

export default ImageView;