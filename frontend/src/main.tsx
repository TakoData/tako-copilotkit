import React from "react";
import ReactDOM from "react-dom/client";
import { SimpleTakoChat } from "./components/SimpleTakoChat";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SimpleTakoChat />
  </React.StrictMode>
);
