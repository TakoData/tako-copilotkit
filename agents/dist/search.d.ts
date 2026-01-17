import { TakoResearchState } from "./state";
interface SearchResult {
    card_id: string;
    title: string;
    description: string;
    source: string;
    url: string;
}
export declare function searchTakoCharts(query: string, count?: number): Promise<SearchResult[]>;
export declare function getChartIframe(pub_id: string, dark_mode?: boolean): Promise<string>;
export declare function search_node(state: TakoResearchState): Promise<{
    logs: string[];
    resources: import("./state").TakoResource[];
}>;
export {};
//# sourceMappingURL=search.d.ts.map