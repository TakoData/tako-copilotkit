import { ResearchCanvas } from "@/components/ResearchCanvas";
import { useModelSelectorContext } from "@/lib/model-selector-provider";
import { AgentState } from "@/lib/types";
import { useCoAgent } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { ChatInputWithModelSelector } from "@/components/ChatInputWithModelSelector";
import Split from "react-split";
import React from "react";

const CHAT_SUGGESTIONS = [
  {
    title: "Vietnam's Economy",
    message: "Tell me about Vietnam's economy",
  },
  {
    title: "Nvidia vs Intel",
    message: "Compare the performance of Nvidia and Intel over the last 10 years",
  },
  {
    title: "Commodities Prices",
    message: "How have commodities prices moved since the Global Financial Crisis?",
  },
  {
    title: "Global Military Spending",
    message: "What is the trend of global military spending since the Ukraine war started?",
  },
  {
    title: "Performance of AI companies",
    message: "How has the performance of AI company's stock prices and funding evolved since 2020 (also include traffic trends)?",
  },
  {
    title: "Rent & Inflation",
    message: "How has the rent, inflation, and average wages trended in top US cities?",
  }
];

export default function Main() {
  const { model, agent } = useModelSelectorContext();
  const { state, setState } = useCoAgent<AgentState>({
    name: agent,
    initialState: {
      model,
      research_question: "",
      resources: [],
      report: "",
      logs: [],
    },
  });

  return (
    <div style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <h1 className="flex h-[60px] bg-[#0E103D] text-white items-center px-10 text-2xl font-medium flex-shrink-0">
        Research Helper
      </h1>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Split
          sizes={[30, 70]}
          minSize={200}
          gutterSize={10}
          style={{ display: "flex", height: "100%" }}
          gutter={(index, direction) => {
            const gutter = document.createElement("div");
            gutter.className = `gutter gutter-${direction}`;

            // Create icon container
            const iconContainer = document.createElement("div");
            iconContainer.style.cssText = `
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              pointer-events: none;
              display: flex;
              align-items: center;
              justify-content: center;
            `;

            // Add SVG icon (GripVertical)
            iconContainer.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #9ca3af">
                <circle cx="9" cy="12" r="1"></circle>
                <circle cx="9" cy="5" r="1"></circle>
                <circle cx="9" cy="19" r="1"></circle>
                <circle cx="15" cy="12" r="1"></circle>
                <circle cx="15" cy="5" r="1"></circle>
                <circle cx="15" cy="19" r="1"></circle>
              </svg>
            `;

            gutter.appendChild(iconContainer);
            return gutter;
          }}
        >
          {/* Chat on Left */}
          <div
            style={{
              height: "100%",
              maxHeight: "100%",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              "--copilot-kit-background-color": "#E0E9FD",
              "--copilot-kit-secondary-color": "#6766FC",
              "--copilot-kit-separator-color": "#b8b8b8",
              "--copilot-kit-primary-color": "#FFFFFF",
              "--copilot-kit-contrast-color": "#000000",
              "--copilot-kit-secondary-contrast-color": "#000",
            } as React.CSSProperties}
          >
            <CopilotChat
              Input={ChatInputWithModelSelector}
              onSubmitMessage={async () => {
                setState({ ...state, logs: [] });
                await new Promise((resolve) => setTimeout(resolve, 30));
              }}
              suggestions={CHAT_SUGGESTIONS}
              labels={{
                initial: "Hi! How can I assist you with your research today?",
              }}
            />
          </div>

          {/* Canvas on Right */}
          <div style={{ height: "100%", overflow: "hidden" }}>
            <ResearchCanvas />
          </div>
        </Split>
      </div>
    </div>
  );
}
