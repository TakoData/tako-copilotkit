import { BaseMessage } from "@langchain/core/messages";
export interface TakoResource {
    title: string;
    description: string;
    source: string;
    url: string;
    resource_type: 'tako_chart' | 'tavily_web';
    card_id?: string;
    iframe_html?: string;
    content?: string;
}
export declare const TakoResearchStateAnnotation: import("@langchain/langgraph")._INTERNAL_ANNOTATION_ROOT<{
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<BaseMessage[], BaseMessage[]>;
    research_question: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    data_questions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    report: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    resources: import("@langchain/langgraph").BinaryOperatorAggregate<TakoResource[], TakoResource[]>;
    logs: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
}>;
export type TakoResearchState = typeof TakoResearchStateAnnotation.State;
//# sourceMappingURL=state.d.ts.map