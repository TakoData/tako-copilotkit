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
