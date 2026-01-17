export interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
}
export declare function searchTavilyWeb(query: string, maxResults?: number): Promise<TavilySearchResult[]>;
//# sourceMappingURL=tavily.d.ts.map