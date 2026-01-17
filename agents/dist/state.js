"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TakoResearchStateAnnotation = void 0;
const langgraph_1 = require("@langchain/langgraph");
exports.TakoResearchStateAnnotation = langgraph_1.Annotation.Root({
    messages: (0, langgraph_1.Annotation)({
        reducer: (x, y) => x.concat(y),
    }),
    research_question: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x ?? "",
    }),
    data_questions: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x ?? [],
    }),
    report: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x ?? "",
    }),
    resources: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x ?? [],
    }),
    logs: (0, langgraph_1.Annotation)({
        reducer: (x, y) => {
            if (!y)
                return x ?? [];
            return [...(x ?? []), ...y];
        },
    }),
});
//# sourceMappingURL=state.js.map