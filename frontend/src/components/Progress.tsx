import { useCoAgentStateRender } from "@copilotkit/react-core";
import { TakoResearchState } from "../lib/types";

export function Progress() {
  const renderState = useCoAgentStateRender<TakoResearchState>({
    name: "tako_research_agent",
    render: ({ state }) => state,
  });

  // Handle case where hook returns undefined before agent is ready
  if (!renderState) {
    return null;
  }

  const { state } = renderState;
  const logs = state?.logs || [];

  if (logs.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Agent Activity
        </span>
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className="text-sm text-gray-600 dark:text-gray-400 font-mono flex items-start gap-2 animate-fade-in"
          >
            <span className="text-blue-500 mt-0.5">→</span>
            <span>{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
