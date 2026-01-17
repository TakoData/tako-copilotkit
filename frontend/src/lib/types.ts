export interface TakoResource {
  // Common fields (required for all)
  title: string;
  description: string;
  source: string;
  url: string;

  // Discriminator field
  resource_type: 'tako_chart' | 'tavily_web';

  // Tako-specific (optional)
  card_id?: string;
  iframe_html?: string;

  // Tavily-specific (optional)
  content?: string;
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
