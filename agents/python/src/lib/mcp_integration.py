"""
MCP Integration Module

Provides integration with MCP (Model Context Protocol) servers for accessing
structured data sources. Includes session management, error handling, and
automatic reconnection on session expiry.
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

import httpx

# Configure logging
logger = logging.getLogger(__name__)

# Configuration from environment variables
DATA_SOURCE_URL = os.getenv("TAKO_URL", "https://tako.com").rstrip("/")
MCP_SERVER_URL = os.getenv("TAKO_MCP_URL", "https://mcp.tako.com").rstrip("/")
TAKO_API_TOKEN = os.getenv("TAKO_API_TOKEN", "")


class SessionExpiredException(Exception):
    """Exception raised when MCP server session expires (410 response)."""
    pass


class SimpleMCPClient:
    """
    Minimal MCP client following the Model Context Protocol specification.

    Handles connection lifecycle, session management, and message passing
    with MCP servers via SSE and HTTP.
    """

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session_id = None
        self.message_id = 0
        self._responses = {}
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0))
        self._sse_task = None

    async def connect(self):
        """Connect to MCP server and get session ID via SSE."""
        logger.info(f"Connecting to MCP server: {self.base_url}/sse")
        self._sse_task = asyncio.create_task(self._sse_reader())

        # Wait for session_id to be established
        for _ in range(50):
            if self.session_id:
                await asyncio.sleep(0.2)
                logger.info(f"Connected to MCP server (session: {self.session_id[:8]}...)")
                return True
            await asyncio.sleep(0.1)

        logger.error("Failed to connect to MCP server (timeout)")
        return False

    async def _sse_reader(self):
        """Read SSE events from server to get session_id and responses."""
        try:
            async with self._client.stream("GET", f"{self.base_url}/sse") as resp:
                if resp.status_code != 200:
                    logger.error(f"SSE connection failed: {resp.status_code}")
                    return

                event_type = None
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue

                    if line.startswith("event:"):
                        event_type = line[6:].strip()
                    elif line.startswith("data:"):
                        data = line[5:].strip()
                        if event_type == "endpoint" and "session_id=" in data:
                            self.session_id = data.split("session_id=")[1].split("&")[0]
                        elif event_type == "message":
                            try:
                                msg = json.loads(data)
                                msg_id = msg.get("id")
                                if msg_id in self._responses:
                                    self._responses[msg_id].set_result(msg)
                            except Exception as e:
                                logger.error(f"Error parsing message: {e}")
                        event_type = None
        except asyncio.CancelledError:
            logger.debug("SSE connection cancelled")
        except Exception as e:
            logger.error(f"SSE error: {e}")

    async def close(self):
        """Close connection."""
        if self._sse_task:
            self._sse_task.cancel()
            try:
                await self._sse_task
            except asyncio.CancelledError:
                pass
        if self._client:
            await self._client.aclose()

    async def reconnect(self):
        """Reconnect to MCP server with new session."""
        logger.info("Reconnecting to MCP server...")

        # Close existing connection
        if self._sse_task and not self._sse_task.done():
            self._sse_task.cancel()
            try:
                await self._sse_task
            except asyncio.CancelledError:
                pass

        # Clear session state
        self.session_id = None
        self._responses.clear()

        # Establish new connection
        if not await self.connect():
            raise RuntimeError(f"Failed to reconnect to MCP server {self.base_url}")

        await self.initialize()
        logger.info(f"Reconnected successfully (session: {self.session_id[:8]}...)")

    async def _send(self, method: str, params: dict = None) -> dict:
        """Send JSON-RPC message to server and wait for response via SSE."""
        if not self.session_id:
            raise RuntimeError("Not connected. Call connect() first.")

        self.message_id += 1
        msg_id = self.message_id
        msg = {"jsonrpc": "2.0", "id": msg_id, "method": method}
        if params:
            msg["params"] = params

        future = asyncio.get_event_loop().create_future()
        self._responses[msg_id] = future

        try:
            resp = await self._client.post(
                f"{self.base_url}/messages/?session_id={self.session_id}",
                json=msg,
            )

            if resp.status_code >= 400:
                error_text = resp.text
                try:
                    error_data = resp.json()
                    error_msg = error_data.get("error", error_text)

                    if resp.status_code == 410:
                        logger.warning("Session expired (410), needs reconnection")
                        raise SessionExpiredException(
                            "Session expired or not found. Reconnection required."
                        )
                except json.JSONDecodeError:
                    error_msg = error_text
                    if resp.status_code == 410:
                        raise SessionExpiredException(
                            "Session expired or not found. Reconnection required."
                        )

                raise RuntimeError(
                    f"HTTP {resp.status_code} from server: {error_msg}"
                )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 410:
                raise SessionExpiredException("Session expired. Reconnection required.")
            raise RuntimeError(f"HTTP error {e.response.status_code}: {e.response.text}")

        try:
            return await asyncio.wait_for(future, timeout=120.0)
        finally:
            self._responses.pop(msg_id, None)

    async def initialize(self):
        """Initialize MCP connection."""
        return await self._send(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "research-agent", "version": "1.0.0"},
            },
        )

    async def call_tool(self, name: str, args: dict):
        """Call an MCP tool."""
        return await self._send("tools/call", {"name": name, "arguments": args})


# Global MCP client instance (reused across calls)
_mcp_client: Optional[SimpleMCPClient] = None


async def _get_mcp_client() -> SimpleMCPClient:
    """Get or create MCP client with proper session."""
    global _mcp_client

    if _mcp_client is None or _mcp_client.session_id is None:
        _mcp_client = SimpleMCPClient(MCP_SERVER_URL)
        if not await _mcp_client.connect():
            raise RuntimeError(f"Failed to connect to MCP server {MCP_SERVER_URL}")
        await _mcp_client.initialize()

    return _mcp_client


async def _call_mcp_tool(tool_name: str, arguments: Dict[str, Any], retry_count: int = 1) -> Any:
    """
    Call MCP server tool with session management and automatic retry.

    Args:
        tool_name: Name of the MCP tool to call (e.g., "knowledge_search")
        arguments: Tool arguments as dict
        retry_count: Number of retries on session expiry (default: 1)

    Returns:
        Tool result from MCP server
    """
    logger.info(f"Calling MCP tool: {tool_name}")

    for attempt in range(retry_count + 1):
        try:
            client = await _get_mcp_client()
            result = await client.call_tool(tool_name, arguments)

            logger.info(f"MCP tool call succeeded: {tool_name}")

            # MCP protocol returns results in result.content array
            if "result" in result and "content" in result["result"]:
                content = result["result"]["content"]
                if isinstance(content, list) and len(content) > 0:
                    first_content = content[0]
                    if isinstance(first_content, dict) and "text" in first_content:
                        text = first_content["text"]
                        if text and text.strip():
                            try:
                                return json.loads(text)
                            except json.JSONDecodeError:
                                return text
                    return first_content
                return content

            return result.get("result", {})

        except SessionExpiredException:
            if attempt < retry_count:
                logger.warning(f"Session expired, retrying ({attempt + 1}/{retry_count})...")
                global _mcp_client
                if _mcp_client:
                    await _mcp_client.reconnect()
                continue
            else:
                logger.error(f"Session expired after {retry_count} retries")
                raise

        except Exception as e:
            logger.error(f"Failed to call MCP tool {tool_name}: {e}")
            return None

    return None


async def search_knowledge_base(
    query: str,
    count: int = 5,
    search_effort: str = "fast"
) -> List[Dict[str, Any]]:
    """
    Search the knowledge base via MCP server.

    Args:
        query: Search query
        count: Number of results to return
        search_effort: Search effort level ('fast', 'medium', or 'deep')

    Returns:
        List of search results with metadata
    """

    result = await _call_mcp_tool("knowledge_search", {
        "query": query,
        "api_token": TAKO_API_TOKEN,
        "count": count,
        "search_effort": search_effort,
        "country_code": "US",
        "locale": "en-US"
    })

    if result and "results" in result:
        formatted_results = []
        for item in result["results"]:
            # Extract ID from various possible locations
            open_ui_args = item.get("open_ui_args", {})
            item_id = open_ui_args.get("pub_id") or item.get("card_id") or item.get("id")

            title = item.get("title", "")
            description = item.get("description", "")
            url = item.get("url") or f"{DATA_SOURCE_URL}/card/{item_id}" if item_id else None
            embed_url = f"{DATA_SOURCE_URL}/embed/{item_id}/?theme=dark" if item_id else None

            formatted_results.append({
                "type": "data_visualization",
                "content": description,
                "id": item_id,
                "embed_url": embed_url,
                "title": title,
                "description": description,
                "url": url
            })

        logger.info(f"Knowledge search returned {len(formatted_results)} results for '{query}'")
        return formatted_results

    return []


async def explore_knowledge_graph(
    query: str,
    node_types: Optional[List[str]] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Explore the knowledge graph to discover entities and relationships.

    Args:
        query: Explore query
        node_types: Optional list of node types to filter
        limit: Number of results to return per type

    Returns:
        Dict with discovered entities, metrics, cohorts, and time periods
    """

    result = await _call_mcp_tool("explore_knowledge_graph", {
        "query": query,
        "api_token": TAKO_API_TOKEN,
        "node_types": node_types,
        "limit": limit
    })

    if result:
        return result

    return {
        "entities": [],
        "metrics": [],
        "cohorts": [],
        "time_periods": [],
        "total_matches": 0
    }


def format_knowledge_graph_results(data: Dict[str, Any]) -> str:
    """Format knowledge graph results for LLM context."""
    parts = []

    if data.get("entities"):
        entities = [e.get("name", "") for e in data["entities"][:5]]
        parts.append(f"Entities: {', '.join(entities)}")

    if data.get("metrics"):
        metrics = [m.get("name", "") for m in data["metrics"][:5]]
        parts.append(f"Metrics: {', '.join(metrics)}")

    if data.get("cohorts"):
        cohorts = [c.get("name", "") for c in data["cohorts"][:3]]
        parts.append(f"Cohorts: {', '.join(cohorts)}")

    if data.get("time_periods"):
        periods = data["time_periods"][:3]
        parts.append(f"Time Periods: {', '.join(periods)}")

    if not parts:
        return ""

    return "KNOWLEDGE BASE CONTEXT:\n" + "\n".join(f"  - {p}" for p in parts)


async def get_visualization_iframe(item_id: str = None, embed_url: str = None) -> Optional[str]:
    """
    Get iframe HTML for a data visualization with dynamic resizing.

    Args:
        item_id: Visualization ID (when using MCP)
        embed_url: Direct embed URL (when using direct embedding)

    Returns:
        Iframe HTML string with resizing script or None if failed
    """
    if item_id:
        try:
            # Use _call_mcp_tool to get automatic session reconnection
            result = await _call_mcp_tool("open_chart_ui", {
                "pub_id": item_id,
                "dark_mode": True,
                "width": 900,
                "height": 600
            })

            if not result:
                logger.warning(f"No result from MCP for item: {item_id}")
                return None

            # Handle both direct result and nested result format
            content = result.get("content", []) if "content" in result else result.get("result", {}).get("content", [])
            if not content:
                return None

            resource_item = next((c for c in content if c.get("type") == "resource"), None)
            if not resource_item:
                return None

            resource = resource_item.get("resource", {})
            html_content = (
                resource.get("htmlString") or
                (resource.get("content", {}).get("htmlString") if isinstance(resource.get("content"), dict) else None) or
                resource.get("text")
            )

            if html_content and html_content.strip():
                logger.info(f"Retrieved visualization HTML from MCP ({len(html_content)} chars)")
                return html_content

            logger.warning(f"No HTML content found for item: {item_id}")
            return None

        except Exception as e:
            logger.error(f"Failed to get visualization iframe from MCP: {e}")

    # Fallback: Generate iframe HTML with embed_url
    if embed_url:
        logger.info("Using embed_url fallback for visualization")
        return f'''<iframe
  width="100%"
  height="600"
  src="{embed_url}"
  scrolling="no"
  frameborder="0"
  style="display: block; border: none;"
></iframe>

<script type="text/javascript">
!function() {{
  "use strict";
  window.addEventListener("message", function(e) {{
    const d = e.data;
    if (d.type !== "tako::resize") return;

    for (let iframe of document.querySelectorAll("iframe")) {{
      if (iframe.contentWindow !== e.source) continue;
      iframe.style.height = d.height + "px";
    }}
  }});
}}();
</script>'''

    logger.warning("No item_id or embed_url provided for iframe generation")
    return None
