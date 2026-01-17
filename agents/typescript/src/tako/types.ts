/**
 * Tako MCP Integration Types
 *
 * These types define the interfaces for Tako MCP server responses
 * and parameters used in the research canvas.
 */

/**
 * Result from Tako knowledge search
 */
export interface TakoSearchResult {
  card_id: string;
  title: string;
  description: string;
  url: string;
  score?: number;
  metadata?: {
    chart_type?: string;
    data_source?: string;
    created_at?: string;
  };
}

/**
 * Result from Tako chart UI rendering
 */
export interface TakoIframeResult {
  card_id: string;
  iframe_html: string;
  embed_url: string;
}

/**
 * Parameters for Tako search requests
 */
export interface TakoSearchParams {
  query: string;
  count?: number;
  search_effort?: 'fast' | 'deep';
  filters?: {
    chart_types?: string[];
    date_range?: {
      start: string;
      end: string;
    };
  };
}

/**
 * Tako card insights response
 */
export interface TakoInsightsResult {
  card_id: string;
  insights: string;
  key_findings: string[];
  data_quality?: {
    completeness: number;
    accuracy: number;
  };
}
