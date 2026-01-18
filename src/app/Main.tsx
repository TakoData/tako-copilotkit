import { ResearchCanvas } from "@/components/ResearchCanvas";
import { useModelSelectorContext } from "@/lib/model-selector-provider";
import { AgentState } from "@/lib/types";
import { useCoAgent } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotChatSuggestions } from "@copilotkit/react-ui";
import { Group, Panel, Separator } from "react-resizable-panels";
import { GripVertical } from "lucide-react";

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
    <>
      <h1 className="flex h-[60px] bg-[#0E103D] text-white items-center px-10 text-2xl font-medium">
        Research Helper
      </h1>

      <Group
        orientation="horizontal"
        className="border"
        style={{ height: "calc(100vh - 60px)" }}
      >
        {/* Chat on Left */}
        <Panel
          defaultSize={40}
          minSize={30}
          maxSize={70}
          id="chat-panel"
        >
          <div
            style={
              {
                "--copilot-kit-background-color": "#E0E9FD",
                "--copilot-kit-secondary-color": "#6766FC",
                "--copilot-kit-separator-color": "#b8b8b8",
                "--copilot-kit-primary-color": "#FFFFFF",
                "--copilot-kit-contrast-color": "#000000",
                "--copilot-kit-secondary-contrast-color": "#000",
              } as any
            }
            className="h-full overflow-hidden"
          >
            <CopilotChat
              className="h-full"
              onSubmitMessage={async (message) => {
                setState({ ...state, logs: [] });
                await new Promise((resolve) => setTimeout(resolve, 30));
              }}
              labels={{
                initial: "Hi! How can I assist you with your research today?",
              }}
            />
          </div>
        </Panel>

        {/* Resizable Divider */}
        <Separator
          id="resize-separator"
          className="flex items-center justify-center bg-gray-300 hover:bg-[#6766FC] transition-colors cursor-col-resize"
          style={{ width: "12px" }}
        >
          <GripVertical className="w-6 h-6 text-gray-600" />
        </Separator>

        {/* Canvas on Right */}
        <Panel
          defaultSize={60}
          minSize={30}
          maxSize={70}
          id="canvas-panel"
        >
          <div className="h-full overflow-hidden">
            <ResearchCanvas />
          </div>
        </Panel>
      </Group>
    </>
  );
}
