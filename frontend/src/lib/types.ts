export interface TakoResource {
  card_id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  iframe_html?: string;
}

export interface TakoResearchState {
  research_question: string;
  data_questions: string[];
  report: string;
  resources: TakoResource[];
  logs: string[];
}

export interface SearchResult {
  card_id: string;
  title: string;
  description: string;
  source: string;
  url: string;
}
