"use client";

import { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  useCoAgent,
  useCoAgentStateRender,
  useCopilotAction,
} from "@copilotkit/react-core";
import { Progress } from "./Progress";
import { EditResourceDialog } from "./EditResourceDialog";
import { AddResourceDialog } from "./AddResourceDialog";
import { Resources } from "./Resources";
import { AgentState, Resource } from "@/lib/types";
import { useModelSelectorContext } from "@/lib/model-selector-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function ResearchCanvas() {
  const { model, agent } = useModelSelectorContext();

  const { state, setState } = useCoAgent<AgentState>({
    name: agent,
    initialState: {
      model,
    },
  });

  // Use refs to persist last known good values (prevents flicker on partial state updates)
  const lastResourcesRef = useRef<Resource[]>([]);
  const lastReportRef = useRef<string>("");
  const lastQuestionRef = useRef<string>("");

  // Update refs when we get valid values, use ref values as fallback
  if (state.resources && state.resources.length > 0) {
    lastResourcesRef.current = state.resources;
  }
  if (state.report && state.report.length > 0) {
    lastReportRef.current = state.report;
  }
  if (state.research_question && state.research_question.length > 0) {
    lastQuestionRef.current = state.research_question;
  }

  // Use current state if available, otherwise fall back to last known good value
  const resources = (state.resources && state.resources.length > 0) ? state.resources : lastResourcesRef.current;
  const report = (state.report && state.report.length > 0) ? state.report : lastReportRef.current;
  const researchQuestion = (state.research_question && state.research_question.length > 0) ? state.research_question : lastQuestionRef.current;

  useCoAgentStateRender({
    name: agent,
    render: ({ state, status }) => {
      // Show progress if logs exist, or if agent is still running but logs were cleared
      const hasLogs = state.logs && state.logs.length > 0;
      const isRunning = status === "inProgress";

      if (!hasLogs && !isRunning) {
        return null;
      }

      // If running but no logs, show a gentle "Finalizing..." message
      // This prevents the UI gap when logs are cleared mid-process
      if (!hasLogs && isRunning) {
        return (
          <Progress
            logs={[{ message: "Finalizing results...", done: false }]}
          />
        );
      }

      return <Progress logs={state.logs} />;
    },
  });

  useCopilotAction({
    name: "DeleteResources",
    description:
      "Prompt the user for resource delete confirmation, and then perform resource deletion",
    available: "remote",
    parameters: [
      {
        name: "urls",
        type: "string[]",
      },
    ],
    renderAndWait: ({ args, status, handler }) => {
      return (
        <div
          className=""
          data-test-id="delete-resource-generative-ui-container"
        >
          <div className="font-bold text-base mb-2">
            Delete these resources?
          </div>
          <Resources
            resources={resources.filter((resource) =>
              (args.urls || []).includes(resource.url)
            )}
            customWidth={200}
          />
          {status === "executing" && (
            <div className="mt-4 flex justify-start space-x-2">
              <button
                onClick={() => handler("NO")}
                className="px-4 py-2 text-[#6766FC] border border-[#6766FC] rounded text-sm font-bold"
              >
                Cancel
              </button>
              <button
                data-test-id="button-delete"
                onClick={() => handler("YES")}
                className="px-4 py-2 bg-[#6766FC] text-white rounded text-sm font-bold"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      );
    },
  });

  const setResources = (newResources: Resource[]) => {
    setState({ ...state, resources: newResources });
  };
  const [newResource, setNewResource] = useState<Resource>({
    url: "",
    title: "",
    description: "",
    resource_type: "web",
    source: "Manual",
  });
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);
  const [selectedChart, setSelectedChart] = useState<Resource | null>(null);
  const [isViewMode, setIsViewMode] = useState(true);  // Default to preview mode
  const [chartsExpanded, setChartsExpanded] = useState(false);  // Default collapsed
  const [webExpanded, setWebExpanded] = useState(false);  // Default collapsed

  const addResource = () => {
    if (newResource.url) {
      setResources([...resources, { ...newResource }]);
      setNewResource({
        url: "",
        title: "",
        description: "",
        resource_type: "web",
        source: "Manual",
      });
      setIsAddResourceOpen(false);
    }
  };

  const removeResource = (url: string) => {
    setResources(
      resources.filter((resource: Resource) => resource.url !== url)
    );
  };

  const [editResource, setEditResource] = useState<Resource | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [isEditResourceOpen, setIsEditResourceOpen] = useState(false);

  const handleCardClick = (resource: Resource) => {
    // If it's a Tako chart, open chart preview modal
    if (resource.resource_type === 'tako_chart') {
      setSelectedChart(resource);
    } else {
      // Otherwise, open edit dialog for web resources
      setEditResource({ ...resource }); // Ensure a new object is created
      setOriginalUrl(resource.url); // Store the original URL
      setIsEditResourceOpen(true);
    }
  };

  const updateResource = () => {
    if (editResource && originalUrl) {
      setResources(
        resources.map((resource) =>
          resource.url === originalUrl ? { ...editResource } : resource
        )
      );
      setEditResource(null);
      setOriginalUrl(null);
      setIsEditResourceOpen(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto p-10 bg-[#F5F8FF]">
      <div className="space-y-8 pb-10">
        <div>
          <h2 className="text-lg font-medium mb-3 text-primary">
            Research Question
          </h2>
          <div
            className="bg-background px-6 py-8 border-0 shadow-none rounded-xl text-md font-extralight min-h-[60px] flex items-center"
            aria-label="Research question"
          >
            {researchQuestion ? (
              <p className="text-foreground">{researchQuestion}</p>
            ) : (
              <p className="text-slate-400">
                The agent will automatically identify your research question from your query...
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-primary">Resources</h2>
            <div className="flex gap-2">
              <EditResourceDialog
                isOpen={isEditResourceOpen}
                onOpenChange={setIsEditResourceOpen}
                editResource={editResource}
                setEditResource={setEditResource}
                updateResource={updateResource}
              />
              <AddResourceDialog
                isOpen={isAddResourceOpen}
                onOpenChange={setIsAddResourceOpen}
                newResource={newResource}
                setNewResource={setNewResource}
                addResource={addResource}
              />
            </div>
          </div>

          {resources.length === 0 && (
            <div className="text-sm text-slate-400">
              Click the button above to add resources.
            </div>
          )}

          {resources.length > 0 && (
            <div className="space-y-6">
              {/* Tako Charts Section */}
              {resources.filter(r => r.resource_type === 'tako_chart').length > 0 && (
                <div>
                  <button
                    onClick={() => setChartsExpanded(!chartsExpanded)}
                    className="flex items-center gap-2 text-base font-medium text-primary mb-3 hover:text-[#6766FC] transition-colors"
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${
                        chartsExpanded ? "" : "-rotate-90"
                      }`}
                    />
                    Tako Charts ({resources.filter(r => r.resource_type === 'tako_chart').length})
                  </button>
                  {chartsExpanded && (
                    <Resources
                      resources={resources.filter(r => r.resource_type === 'tako_chart')}
                      handleCardClick={handleCardClick}
                      removeResource={removeResource}
                    />
                  )}
                </div>
              )}

              {/* Web Resources Section */}
              {resources.filter(r => r.resource_type === 'web').length > 0 && (
                <div>
                  <button
                    onClick={() => setWebExpanded(!webExpanded)}
                    className="flex items-center gap-2 text-base font-medium text-primary mb-3 hover:text-[#6766FC] transition-colors"
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${
                        webExpanded ? "" : "-rotate-90"
                      }`}
                    />
                    Web Resources ({resources.filter(r => r.resource_type === 'web').length})
                  </button>
                  {webExpanded && (
                    <Resources
                      resources={resources.filter(r => r.resource_type === 'web')}
                      handleCardClick={handleCardClick}
                      removeResource={removeResource}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tako Chart Preview Modal */}
        <Dialog open={selectedChart !== null} onOpenChange={(open) => !open && setSelectedChart(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedChart?.title}</DialogTitle>
            </DialogHeader>
            {selectedChart && selectedChart.iframe_html && (
              <div
                className="w-full min-h-[500px]"
                dangerouslySetInnerHTML={{ __html: selectedChart.iframe_html }}
              />
            )}
            {selectedChart && !selectedChart.iframe_html && (
              <div className="p-8 text-center text-gray-500">
                Chart preview not available
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-medium text-primary">
              Research Draft
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsViewMode(false)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  !isViewMode
                    ? "bg-[#6766FC] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Edit
              </button>
              <button
                onClick={() => setIsViewMode(true)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  isViewMode
                    ? "bg-[#6766FC] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Preview
              </button>
            </div>
          </div>

          {isViewMode ? (
            <MarkdownRenderer content={report || ""} />
          ) : (
            <Textarea
              data-test-id="research-draft"
              placeholder="Write your research draft here"
              value={report || ""}
              onChange={(e) => {
                setState({ ...state, report: e.target.value });
              }}
              rows={10}
              aria-label="Research draft"
              className="bg-background px-6 py-8 border-0 shadow-none rounded-xl text-md font-extralight focus-visible:ring-0 placeholder:text-slate-400"
              style={{ minHeight: "200px" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
