/**
 * Tako MCP Client Configuration
 *
 * This module initializes the MCP client to connect to Tako's MCP server
 * and provides Tako-specific tools for the LangGraph agent.
 */

import { MultiServerMCPClient } from "@langchain/mcp-adapters";

// Feature flag: Use direct MCP connection (true) or legacy proxy (false)
const USE_DIRECT_MCP = true;

// Cache for MCP client initialization to avoid repeated connections
let mcpCache: { client: MultiServerMCPClient | null; tools: any[] } | null = null;
let initializationPromise: Promise<{ client: MultiServerMCPClient | null; tools: any[] }> | null = null;

/**
 * Initialize Tako MCP client with timeout
 *
 * @param timeoutMs Timeout in milliseconds (default: 3000ms)
 */
async function initializeWithTimeout(timeoutMs = 3000) {
  const takoMcpUrl = process.env.TAKO_MCP_URL || "http://localhost:8001";
  const takoApiToken = process.env.TAKO_API_TOKEN;

  if (!takoApiToken) {
    console.warn("TAKO_API_TOKEN not set - Tako MCP integration will be unavailable");
    return { client: null, tools: [] };
  }

  console.log(`🔧 MCP Mode: ${USE_DIRECT_MCP ? 'DIRECT' : 'PROXY'}`);
  console.log(`🔗 Connecting to: ${takoMcpUrl}${USE_DIRECT_MCP ? '/sse' : ''}`);

  const mcpServers = {
    tako: {
      transport: "http" as const,
      url: USE_DIRECT_MCP ? `${takoMcpUrl}/sse` : takoMcpUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${takoApiToken}`,
      },
    },
  };

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Tako MCP initialization timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    const client = new MultiServerMCPClient({
      mcpServers,
      throwOnLoadError: false,
      prefixToolNameWithServerName: true,
      useStandardContentBlocks: true,
    });

    console.log("Loading Tako MCP tools from:", USE_DIRECT_MCP ? `${takoMcpUrl}/sse` : takoMcpUrl);

    // Race between getTools and timeout
    const tools = await Promise.race([
      client.getTools(),
      timeoutPromise
    ]);

    console.log(`✅ Loaded ${tools.length} Tako MCP tools:`, tools.map(t => t.name));
    return { client, tools };
  } catch (error) {
    console.warn("❌ Failed to initialize Tako MCP client (will continue without Tako):", error.message);
    return { client: null, tools: [] };
  }
}

/**
 * Initialize Tako MCP client and load available tools
 *
 * This function configures the MCP client to connect to Tako's MCP server
 * using StreamableHTTP transport and loads all available tools.
 * Results are cached to avoid repeated initialization.
 *
 * @returns {Promise<{client: MultiServerMCPClient | null, tools: any[]}>}
 *   - client: The initialized MCP client (or null if unavailable)
 *   - tools: Array of LangChain-compatible tools from Tako MCP server (or empty array)
 */
export async function initializeTakoMCP() {
  // Return cached result if available
  if (mcpCache) {
    return mcpCache;
  }

  // Return in-progress initialization if it exists
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start new initialization
  initializationPromise = initializeWithTimeout(3000);

  try {
    mcpCache = await initializationPromise;
    return mcpCache;
  } finally {
    initializationPromise = null;
  }
}

/**
 * Get Tako tool by name
 *
 * Helper function to retrieve a specific Tako tool from the loaded tools array.
 *
 * @param tools - Array of tools from initializeTakoMCP()
 * @param toolName - Name of the tool to retrieve (e.g., "tako_knowledge_search")
 * @returns The tool if found, undefined otherwise
 */
export function getTakoTool(tools: any[], toolName: string) {
  return tools.find((tool) => tool.name === toolName);
}

/**
 * Call Tako explore API to discover entities, metrics, cohorts.
 *
 * @param query - Explore query
 * @param nodeTypes - Optional list of node types to filter (e.g. ["entity", "metric"])
 * @param limit - Number of results to return per type (default: 10)
 * @returns Object with keys: entities, metrics, cohorts, time_periods, total_matches
 */
export async function callTakoExplore(
  query: string,
  nodeTypes?: string[],
  limit: number = 10
): Promise<any> {
  const takoApiUrl = process.env.TAKO_API_URL || "http://localhost:8000";
  const takoApiToken = process.env.TAKO_API_TOKEN || "";

  const url = takoApiUrl.startsWith("http")
    ? takoApiUrl
    : `https://${takoApiUrl}`;

  try {
    const response = await fetch(`${url}/api/v1/explore/`, {
      method: 'POST',
      headers: {
        'X-API-Key': takoApiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        node_types: nodeTypes,
        limit,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✓ Tako explore succeeded: ${data.total_matches} matches`);
      return data;
    }

    console.warn(`✗ Tako explore failed: ${response.status}`);
    return { entities: [], metrics: [], cohorts: [], time_periods: [], total_matches: 0 };

  } catch (error) {
    console.error('Failed to call Tako explore:', error);
    return { entities: [], metrics: [], cohorts: [], time_periods: [], total_matches: 0 };
  }
}

/**
 * Format explore results for LLM context.
 *
 * @param exploreData - Raw explore API response
 * @returns Formatted string for LLM context
 */
export function formatExploreResults(exploreData: any): string {
  const parts: string[] = [];

  if (exploreData.entities?.length) {
    const entities = exploreData.entities.slice(0, 5).map((e: any) => e.name);
    parts.push(`Entities: ${entities.join(', ')}`);
  }

  if (exploreData.metrics?.length) {
    const metrics = exploreData.metrics.slice(0, 5).map((m: any) => m.name);
    parts.push(`Metrics: ${metrics.join(', ')}`);
  }

  if (exploreData.cohorts?.length) {
    const cohorts = exploreData.cohorts.slice(0, 3).map((c: any) => c.name);
    parts.push(`Cohorts: ${cohorts.join(', ')}`);
  }

  if (exploreData.time_periods?.length) {
    const periods = exploreData.time_periods.slice(0, 3);
    parts.push(`Time Periods: ${periods.join(', ')}`);
  }

  if (parts.length === 0) return '';

  return 'TAKO KNOWLEDGE BASE CONTEXT:\n' + parts.map(p => `  - ${p}`).join('\n');
}
