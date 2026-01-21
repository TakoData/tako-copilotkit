"""Tako API Direct Integration - MCP Protocol Implementation"""

import asyncio
import os
import traceback
from typing import Any, Dict, List, Optional
import json

import httpx

# Tako base URL for generating embed URLs
TAKO_URL = os.getenv("TAKO_URL", "http://localhost:8000").rstrip("/")


class SimpleMCPClient:
    """Minimal MCP client for Tako server following proper MCP protocol."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session_id = None
        self.message_id = 0
        self._responses = {}
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0))
        self._sse_task = None

    async def connect(self):
        """Connect to MCP server and get session ID via SSE."""
        print(f"🔗 Connecting to MCP server: {self.base_url}/sse")
        self._sse_task = asyncio.create_task(self._sse_reader())

        # Wait for session_id to be established
        for _ in range(50):
            if self.session_id:
                # Small delay to ensure session is fully registered on server
                await asyncio.sleep(0.2)
                print(f"✅ Connected to MCP server (session: {self.session_id[:8]}...)")
                return True
            await asyncio.sleep(0.1)

        print(f"❌ Failed to connect to MCP server (timeout)")
        return False

    async def _sse_reader(self):
        """Read SSE events from server to get session_id and responses."""
        try:
            async with self._client.stream("GET", f"{self.base_url}/sse") as resp:
                if resp.status_code != 200:
                    print(f"❌ SSE connection failed: {resp.status_code}")
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
                            print(f"   Received session_id: {self.session_id}")
                        elif event_type == "message":
                            try:
                                msg = json.loads(data)
                                msg_id = msg.get("id")
                                if msg_id in self._responses:
                                    self._responses[msg_id].set_result(msg)
                            except Exception as e:
                                print(f"Error parsing message: {data} {e}")
                        event_type = None
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"❌ SSE error: {e}")
            import traceback
            traceback.print_exc()

    async def close(self):
        """Close connection."""
        if self._sse_task:
            self._sse_task.cancel()
            try:
                await self._sse_task
            except:
                pass
        if self._client:
            await self._client.aclose()

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
            # Check for HTTP errors - if session not found, server may return 404/500
            if resp.status_code >= 400:
                error_text = resp.text
                # If we get an error response, try to parse it as JSON
                try:
                    error_data = resp.json()
                    error_msg = error_data.get("error", error_text)
                except:
                    error_msg = error_text
                raise RuntimeError(
                    f"HTTP {resp.status_code} from server: {error_msg} "
                    f"(session_id: {self.session_id})"
                )
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"HTTP error {e.response.status_code}: {e.response.text} "
                f"(session_id: {self.session_id})"
            )

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
                "clientInfo": {"name": "tako-copilotkit-agent", "version": "1.0.0"},
            },
        )

    async def call_tool(self, name: str, args: dict):
        """Call an MCP tool."""
        return await self._send("tools/call", {"name": name, "arguments": args})

    async def close(self):
        """Close connection."""
        if self._sse_task:
            self._sse_task.cancel()
            try:
                await self._sse_task
            except:
                pass
        if self._client:
            await self._client.aclose()
        self._connected = False
        self.session_id = None


# Global MCP client instance (reused across calls)
_mcp_client: Optional[SimpleMCPClient] = None


async def _get_mcp_client() -> SimpleMCPClient:
    """Get or create MCP client with proper session."""
    global _mcp_client
    mcp_url = os.getenv("TAKO_MCP_URL", "http://localhost:8001")

    # Create new client if needed or if session is lost
    if _mcp_client is None or _mcp_client.session_id is None:
        _mcp_client = SimpleMCPClient(mcp_url)
        if not await _mcp_client.connect():
            raise RuntimeError("Failed to connect to MCP server")
        await _mcp_client.initialize()

    return _mcp_client


async def _call_mcp_tool(tool_name: str, arguments: Dict[str, Any]) -> Any:
    """
    Call Tako MCP server tool via proper MCP protocol with session management.

    Args:
        tool_name: Name of the MCP tool to call (e.g., "knowledge_search")
        arguments: Tool arguments as dict

    Returns:
        Tool result from MCP server
    """
    print(f"🔧 MCP Mode: DIRECT")
    print(f"🔗 Calling MCP tool: {tool_name}")

    try:
        client = await _get_mcp_client()
        result = await client.call_tool(tool_name, arguments)

        print(f"✅ MCP tool call succeeded: {tool_name}")
        print(f"   Raw result keys: {list(result.keys())}")
        if "result" in result:
            print(f"   Result keys: {list(result['result'].keys())}")
            if "content" in result["result"]:
                content = result["result"]["content"]
                print(f"   Content type: {type(content)}, length: {len(content) if isinstance(content, (list, dict, str)) else 'N/A'}")
                if isinstance(content, list) and len(content) > 0:
                    print(f"   First content item: {content[0]}")

        # MCP protocol returns results in result.content array
        if "result" in result and "content" in result["result"]:
            content = result["result"]["content"]
            # Content is typically an array of content blocks
            if isinstance(content, list) and len(content) > 0:
                # Get the text from the first content block
                first_content = content[0]
                if isinstance(first_content, dict) and "text" in first_content:
                    text = first_content["text"]
                    if text and text.strip():
                        try:
                            return json.loads(text)
                        except json.JSONDecodeError:
                            # If it's not JSON, return as-is
                            return text
                return first_content
            return content

        return result.get("result", {})

    except Exception as e:
        print(f"❌ Failed to call MCP tool {tool_name}: {e}")
        import traceback
        traceback.print_exc()
        return None


async def call_tako_knowledge_search(
    query: str,
    count: int = 5,
    search_effort: str = "fast"  # Changed to "fast" for quicker responses
) -> List[Dict[str, Any]]:
    """
    Call Tako knowledge search API directly or via MCP server.

    Args:
        query: Search query
        count: Number of results to return
        search_effort: Search effort level ('fast', 'medium', or 'deep')

    Returns:
        List of search results with chart metadata
    """
    tako_api_token = os.getenv("TAKO_API_TOKEN", "")

    # Use direct MCP connection if enabled
    result = await _call_mcp_tool("knowledge_search", {
        "query": query,
        "api_token": tako_api_token,
        "count": count,
        "search_effort": search_effort,
        "country_code": "US",
        "locale": "en-US"
    })

    if result and "results" in result:
        # Debug: Log raw MCP results
        print(f"📊 Raw MCP results ({len(result['results'])} items):")
        for i, card in enumerate(result["results"][:3], 1):
            print(f"  [{i}] card_id={card.get('card_id')}, title={card.get('title', '')[:40]}")
            print(f"      url={card.get('url', 'N/A')}")
            open_ui_args = card.get('open_ui_args', {})
            print(f"      pub_id={open_ui_args.get('pub_id', 'N/A')}")

        # Convert MCP result format to expected format
        formatted_results = []
        for card in result["results"]:
            # Get pub_id from open_ui_args (new format)
            open_ui_args = card.get("open_ui_args", {})
            pub_id = open_ui_args.get("pub_id") or card.get("card_id")

            title = card.get("title", "")
            description = card.get("description", "")

            # url is now null in the new format, construct embed URL from pub_id
            url = card.get("url") or f"{TAKO_URL}/card/{pub_id}" if pub_id else None
            embed_url = f"{TAKO_URL}/embed/{pub_id}/?theme=dark" if pub_id else None

            formatted_results.append({
                "type": "tako_chart",
                "content": description,
                "pub_id": pub_id,
                "embed_url": embed_url,
                "title": title,
                "description": description,
                "url": url
            })

        print(f"✅ Tako MCP search succeeded for '{query}': {len(formatted_results)} results")
        if formatted_results:
            for i, r in enumerate(formatted_results[:2]):
                print(f"  [{i+1}] {r['title'][:60]} (pub_id: {r['pub_id']})")
        return formatted_results

    return []


async def call_tako_explore(
    query: str,
    node_types: Optional[List[str]] = None,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Call Tako explore API to discover entities, metrics, cohorts.

    Args:
        query: Explore query
        node_types: Optional list of node types to filter (e.g. ["entity", "metric"])
        limit: Number of results to return per type

    Returns:
        Dict with keys: entities, metrics, cohorts, time_periods, total_matches
    """
    tako_api_token = os.getenv("TAKO_API_TOKEN", "")

    # Use direct MCP connection if enabled
    result = await _call_mcp_tool("explore_knowledge_graph", {
        "query": query,
        "api_token": tako_api_token,
        "node_types": node_types,
        "limit": limit
    })

    if result:
        return result

    return {"entities": [], "metrics": [], "cohorts": [], "time_periods": [], "total_matches": 0}

def format_explore_results(explore_data: Dict[str, Any]) -> str:
    """Format explore results for LLM context."""
    parts = []

    if explore_data.get("entities"):
        entities = [e.get("name", "") for e in explore_data["entities"][:5]]
        parts.append(f"Entities: {', '.join(entities)}")

    if explore_data.get("metrics"):
        metrics = [m.get("name", "") for m in explore_data["metrics"][:5]]
        parts.append(f"Metrics: {', '.join(metrics)}")

    if explore_data.get("cohorts"):
        cohorts = [c.get("name", "") for c in explore_data["cohorts"][:3]]
        parts.append(f"Cohorts: {', '.join(cohorts)}")

    if explore_data.get("time_periods"):
        periods = explore_data["time_periods"][:3]
        parts.append(f"Time Periods: {', '.join(periods)}")

    if not parts:
        return ""

    return "TAKO KNOWLEDGE BASE CONTEXT:\n" + "\n".join(f"  - {p}" for p in parts)


async def get_tako_chart_iframe(pub_id: str = None, embed_url: str = None) -> Optional[str]:
    """
    Get iframe HTML for a Tako chart with dynamic resizing.

    Args:
        pub_id: Tako card ID (when using MCP)
        embed_url: Direct embed URL (when using legacy mode)

    Returns:
        Iframe HTML string with resizing script or None if failed
    """
    # Use direct MCP connection if enabled and pub_id provided
    if pub_id:
        try:
            client = await _get_mcp_client()
            result = await client.call_tool("open_chart_ui", {
                "pub_id": pub_id,
                "dark_mode": True,
                "width": 900,
                "height": 600
            })

            # Extract content from MCP response
            # Result format: {"result": {"content": [{"type": "resource", "resource": {...}}]}}
            content = result.get("result", {}).get("content", [])
            if not content:
                return None

            # Find resource item with type "resource"
            resource_item = next((c for c in content if c.get("type") == "resource"), None)
            if not resource_item:
                return None

            resource = resource_item.get("resource", {})

            html_content = None
            if "htmlString" in resource:
                html_content = resource["htmlString"]
            elif isinstance(resource.get("content"), dict) and "htmlString" in resource["content"]:
                html_content = resource["content"]["htmlString"]
            elif "text" in resource:
                html_content = resource["text"]

            if html_content and html_content.strip():
                print(f"✅ Got chart iframe HTML from MCP for pub_id: {pub_id} ({len(html_content)} chars)")
                return html_content

            print(f"❌ No HTML content found in resource for pub_id: {pub_id}")
            return None

        except Exception as e:
            print(f"❌ Failed to get chart iframe from MCP: {e}")
            import traceback
            traceback.print_exc()
            # Fall through to embed_url fallback

    # Fallback: Generate iframe HTML with embed_url
    if embed_url:
        print(f"⚠️  Using embed_url fallback for chart")
        iframe_html = f'''<iframe
  width="100%"
  src="{embed_url}"
  scrolling="no"
  frameborder="0"
></iframe>

<script type="text/javascript">
!function() {{
  "use strict";
  window.addEventListener("message", function(e) {{
    const d = e.data;
    if (d.type !== "tako::resize") return;

    for (let iframe of document.querySelectorAll("iframe")) {{
      if (iframe.contentWindow !== e.source) continue;
      iframe.style.height = (d.height + 4) + "px";
    }}
  }});
}}();
</script>'''
        return iframe_html

    print(f"❌ No pub_id or embed_url provided for iframe generation")
    return None