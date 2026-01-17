import { TakoResearchState } from "./state";
export declare function chat_node(state: TakoResearchState): Promise<Partial<import("@langchain/langgraph").StateType<{
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage[], import("@langchain/core/messages").BaseMessage[]>;
    research_question: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    data_questions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    report: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    resources: import("@langchain/langgraph").BinaryOperatorAggregate<import("./state").TakoResource[], import("./state").TakoResource[]>;
    logs: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
}>>>;
//# sourceMappingURL=chat.d.ts.map