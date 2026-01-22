export type Resource = {
  url: string;
  title: string;
  description: string;
  content?: string;
  resource_type: 'web' | 'tako_chart';
  card_id?: string;
  iframe_html?: string;
  source: string;
};

export type LogEntry = {
  message: string;
  done: boolean;
};

export type AgentState = {
  model: string;
  research_question: string;
  report: string;
  resources: Resource[];
  logs: LogEntry[];
  data_questions?: string[];
}