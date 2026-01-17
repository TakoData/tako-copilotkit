/**
 * Tako MCP Client Configuration
 *
 * This module initializes the MCP client to connect to Tako's MCP server
 * and provides Tako-specific tools for the LangGraph agent.
 */

import { MultiServerMCPClient } from "@langchain/mcp-adapters";

/**
 * Initialize Tako MCP client and load available tools
 *
 * This function configures the MCP client to connect to Tako's MCP server
 * using StreamableHTTP transport and loads all available tools.
 *
 * @returns {Promise<{client: MultiServerMCPClient, tools: any[]}>}
 *   - client: The initialized MCP client
 *   - tools: Array of LangChain-compatible tools from Tako MCP server
 */
export async function initializeTakoMCP() {
  // Get Tako MCP server URL and API token from environment
  const takoMcpUrl = process.env.TAKO_MCP_URL || "http://localhost:8002";
  const takoApiToken = process.env.TAKO_API_TOKEN;

  if (!takoApiToken) {
    console.warn(
      "TAKO_API_TOKEN not set - Tako MCP integration will be unavailable"
    );
    return { client: null, tools: [] };
  }

  // Configure MCP servers
  const mcpServers = {
    tako: {
      transport: "streamable_http" as const,
      url: takoMcpUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${takoApiToken}`,
      },
    },
  };

  try {
    // Initialize the MCP client
    const client = new MultiServerMCPClient({
      mcpServers,
      throwOnLoadError: false, // Graceful degradation if Tako unavailable
      prefixToolNameWithServerName: true, // Tools named "tako_knowledge_search", etc.
      useStandardContentBlocks: true, // Use standard MCP content blocks
    });

    // Load tools from MCP server
    console.log("Loading Tako MCP tools from:", takoMcpUrl);
    const tools = await client.getTools();
    console.log(`Loaded ${tools.length} Tako MCP tools:`, tools.map(t => t.name));

    return { client, tools };
  } catch (error) {
    console.error("Failed to initialize Tako MCP client:", error);
    // Return empty tools array on error to allow graceful degradation
    return { client: null, tools: [] };
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
