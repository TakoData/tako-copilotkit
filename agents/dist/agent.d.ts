export declare const graph: import("@langchain/langgraph").CompiledStateGraph<import("@langchain/langgraph").StateType<{
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage[], import("@langchain/core/messages").BaseMessage[]>;
    research_question: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    data_questions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    report: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    resources: import("@langchain/langgraph").BinaryOperatorAggregate<import("./state").TakoResource[], import("./state").TakoResource[]>;
    logs: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
}>, import("@langchain/langgraph").UpdateType<{
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage[], import("@langchain/core/messages").BaseMessage[]>;
    research_question: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    data_questions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    report: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    resources: import("@langchain/langgraph").BinaryOperatorAggregate<import("./state").TakoResource[], import("./state").TakoResource[]>;
    logs: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
}>, "search" | "__start__" | "chat", {
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage[], import("@langchain/core/messages").BaseMessage[]>;
    research_question: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    data_questions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    report: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    resources: import("@langchain/langgraph").BinaryOperatorAggregate<import("./state").TakoResource[], import("./state").TakoResource[]>;
    logs: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
}, {
    messages: import("@langchain/langgraph").BinaryOperatorAggregate<import("@langchain/core/messages").BaseMessage[], import("@langchain/core/messages").BaseMessage[]>;
    research_question: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    data_questions: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
    report: import("@langchain/langgraph").BinaryOperatorAggregate<string, string>;
    resources: import("@langchain/langgraph").BinaryOperatorAggregate<import("./state").TakoResource[], import("./state").TakoResource[]>;
    logs: import("@langchain/langgraph").BinaryOperatorAggregate<string[], string[]>;
}, import("@langchain/langgraph").StateDefinition>;
//# sourceMappingURL=agent.d.ts.map