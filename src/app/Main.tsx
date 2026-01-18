import { ResearchCanvas } from "@/components/ResearchCanvas";
import { useModelSelectorContext } from "@/lib/model-selector-provider";
import { AgentState } from "@/lib/types";
import { useCoAgent } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotChatSuggestions } from "@copilotkit/react-ui";
import { ChatInputWithModelSelector } from "@/components/ChatInputWithModelSelector";

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

  useCopilotChatSuggestions({
    instructions: "Lifespan of penguins",
  });

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <h1 className="flex h-[60px] bg-[#0E103D] text-white items-center px-10 text-2xl font-medium flex-shrink-0">
        Research Helper
      </h1>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Chat on Left - 30% */}
        <div
          style={{
            width: "30%",
            height: "100%",
            overflow: "hidden",
            "--copilot-kit-background-color": "#E0E9FD",
            "--copilot-kit-secondary-color": "#6766FC",
            "--copilot-kit-separator-color": "#b8b8b8",
            "--copilot-kit-primary-color": "#FFFFFF",
            "--copilot-kit-contrast-color": "#000000",
            "--copilot-kit-secondary-contrast-color": "#000",
          } as any}
        >
          <CopilotChat
            Input={ChatInputWithModelSelector}
            onSubmitMessage={async (message) => {
              setState({ ...state, logs: [] });
              await new Promise((resolve) => setTimeout(resolve, 30));
            }}
            labels={{
              initial: "Hi! How can I assist you with your research today?",
            }}
          />
        </div>

        {/* Canvas on Right - 70% */}
        <div style={{ width: "70%", height: "100%", overflow: "hidden" }}>
          <ResearchCanvas />
        </div>
      </div>
    </div>
  );
}
