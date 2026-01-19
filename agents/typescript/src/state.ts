import { Annotation } from "@langchain/langgraph";
import { CopilotKitStateAnnotation } from "@copilotkit/sdk-js/langgraph";

// Define a Resource annotation with properties for URL, title, and description
// Extended with Tako chart support
const ResourceAnnotation = Annotation.Root({
  url: Annotation<string>,
  title: Annotation<string>,
  description: Annotation<string>,
  content: Annotation<string>,
  resource_type: Annotation<'web' | 'tako_chart'>,
  card_id: Annotation<string | undefined>,
  iframe_html: Annotation<string | undefined>,
  source: Annotation<string>,
});

// Define a Log annotation with properties for message and done status
const LogAnnotation = Annotation.Root({
  message: Annotation<string>,
  done: Annotation<boolean>,
});

// Define a DataQuestion annotation for structured queries
const DataQuestionAnnotation = Annotation.Root({
  question: Annotation<string>,
  search_effort: Annotation<'fast' | 'deep'>,
  query_type: Annotation<'basic' | 'complex' | 'prediction_market'>,
});

// Define the AgentState annotation, extending MessagesState
export const AgentStateAnnotation = Annotation.Root({
  model: Annotation<string>,
  research_question: Annotation<string>,
  report: Annotation<string>,
  resources: Annotation<(typeof ResourceAnnotation.State)[]>,
  logs: Annotation<(typeof LogAnnotation.State)[]>,
  data_questions: Annotation<(typeof DataQuestionAnnotation.State)[]>,
  explore_context: Annotation<string>,
  ...CopilotKitStateAnnotation.spec,
});

export type AgentState = typeof AgentStateAnnotation.State;
export type Resource = typeof ResourceAnnotation.State;
export type DataQuestion = typeof DataQuestionAnnotation.State;
