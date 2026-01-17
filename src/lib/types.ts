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

export type AgentState = {
  model: string;
  research_question: string;
  report: string;
  resources: any[];
  logs: any[];
  data_questions?: string[];
}