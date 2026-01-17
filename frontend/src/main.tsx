import React from "react";
import ReactDOM from "react-dom/client";
import { CopilotKit } from "@copilotkit/react-core";
import { Main } from "./components/Main";
import "./index.css";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:8000/copilotkit";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CopilotKit runtimeUrl={AGENT_URL}>
      <Main />
    </CopilotKit>
  </React.StrictMode>
);
