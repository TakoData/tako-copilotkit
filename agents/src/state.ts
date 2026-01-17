import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

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

export const TakoResearchStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  research_question: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
  }),
  data_questions: Annotation<string[]>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  report: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
  }),
  resources: Annotation<TakoResource[]>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  logs: Annotation<string[]>({
    reducer: (x, y) => {
      if (!y) return x ?? [];
      return [...(x ?? []), ...y];
    },
  }),
});

export type TakoResearchState = typeof TakoResearchStateAnnotation.State;
