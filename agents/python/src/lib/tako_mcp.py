"""Tako API Direct Integration - MCP Protocol Implementation"""

import asyncio
import os
from typing import Any, Dict, List, Optional
import json

import httpx

# Feature flag: Use direct MCP connection (True) or legacy proxy (False)
USE_DIRECT_MCP = True


class SimpleMCPClient:
    """Minimal MCP client for Tako server following proper MCP protocol."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session_id = None
        self.message_id = 0
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0))
        self._sse_task = None
        self._connected = False

    async def connect(self):
        """Connect to MCP server and get session ID via SSE."""
        if self._connected and self.session_id:
            return True

        print(f"🔗 Connecting to MCP server: {self.base_url}/sse")
        self._sse_task = asyncio.create_task(self._sse_reader())

        # Wait for session_id to be established
        for _ in range(50):
            if self.session_id:
                await asyncio.sleep(0.2)
                self._connected = True
                print(f"✅ Connected to MCP server (session: {self.session_id[:8]}...)")
                return True
            await asyncio.sleep(0.1)

        print(f"❌ Failed to connect to MCP server (timeout)")
        return False

    async def _sse_reader(self):
        """Read SSE events from server to get session_id."""
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
                            # Keep connection alive for proper MCP protocol
                            # but don't block - return after getting session_id
                            return
                        event_type = None
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"❌ SSE reader error: {e}")

    async def initialize(self):
        """Initialize MCP connection."""
        if not self.session_id:
            raise RuntimeError("Not connected. Call connect() first.")

        self.message_id += 1
        msg = {
            "jsonrpc": "2.0",
            "id": self.message_id,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "tako-copilotkit-agent", "version": "1.0.0"},
            },
        }

        try:
            print(f"📤 Sending initialize request to {self.base_url}/messages/?session_id={self.session_id}")
            response = await self._client.post(
                f"{self.base_url}/messages/?session_id={self.session_id}",
                json=msg,
            )

            print(f"📥 Initialize response status: {response.status_code}")
            if response.status_code == 200:
                result = response.json()
                print(f"📥 Initialize response: {json.dumps(result, indent=2)[:500]}")
                print(f"✅ MCP session initialized")
                return True

            print(f"❌ MCP initialization failed: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False

        except Exception as e:
            print(f"❌ MCP initialization error: {e}")
            import traceback
            traceback.print_exc()
            return False

    async def call_tool(self, name: str, args: dict):
        """Call an MCP tool."""
        if not self.session_id:
            raise RuntimeError("Not connected. Call connect() first.")

        self.message_id += 1
        msg = {
            "jsonrpc": "2.0",
            "id": self.message_id,
            "method": "tools/call",
            "params": {"name": name, "arguments": args},
        }

        response = await self._client.post(
            f"{self.base_url}/messages/?session_id={self.session_id}",
            json=msg,
        )

        if response.status_code >= 400:
            raise RuntimeError(f"HTTP {response.status_code}: {response.text}")

        return response.json()

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

    # Create new client if needed
    if _mcp_client is None:
        _mcp_client = SimpleMCPClient(mcp_url)

    # Connect and initialize if not already connected
    if not _mcp_client._connected or _mcp_client.session_id is None:
        if not await _mcp_client.connect():
            raise RuntimeError("Failed to connect to MCP server")
        if not await _mcp_client.initialize():
            raise RuntimeError("Failed to initialize MCP session")

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

        # MCP protocol returns results in result.content array
        if "result" in result and "content" in result["result"]:
            content = result["result"]["content"]
            # Content is typically an array of content blocks
            if isinstance(content, list) and len(content) > 0:
                # Get the text from the first content block
                first_content = content[0]
                if isinstance(first_content, dict) and "text" in first_content:
                    return json.loads(first_content["text"])
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
    if USE_DIRECT_MCP:
        result = await _call_mcp_tool("knowledge_search", {
            "query": query,
            "api_token": tako_api_token,
            "count": count,
            "search_effort": search_effort,
            "country_code": "US",
            "locale": "en-US"
        })

        if result and "results" in result:
            # Convert MCP result format to expected format
            formatted_results = []
            for card in result["results"]:
                pub_id = card.get("card_id")
                title = card.get("title", "")
                description = card.get("description", "")
                url = card.get("url", "")

                formatted_results.append({
                    "type": "tako_chart",
                    "content": description,
                    "pub_id": pub_id,
                    "embed_url": url,
                    "title": title,
                    "description": description,
                    "url": url
                })

            print(f"✅ Tako MCP search succeeded for '{query}': {len(formatted_results)} results")
            if formatted_results:
                for i, r in enumerate(formatted_results[:2]):
                    print(f"  [{i+1}] {r['title'][:60]} (pub_id: {r['pub_id']})")
            return formatted_results

        print(f"❌ Tako MCP search failed or returned no results")
        return []

    # Legacy: Direct API call (when USE_DIRECT_MCP=False)
    tako_api_url = os.getenv("TAKO_API_URL", "http://localhost:8000")

    # Add protocol if missing
    if tako_api_url and not tako_api_url.startswith(("http://", "https://")):
        tako_api_url = f"https://{tako_api_url}"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:  # Increased timeout for Tako searches
            # Call Tako backend API directly
            response = await client.post(
                f"{tako_api_url}/api/v1/knowledge_search/",
                json={
                    "inputs": {"text": query},  # Correct format for Tako API
                    "count": count,
                    "search_effort": search_effort,
                    "country_code": "US",
                    "locale": "en-US",
                    "source_indexes": ["tako"]
                },
                headers={
                    "X-API-Key": tako_api_token,
                    "Content-Type": "application/json"
                }
            )

            if response.status_code == 200:
                data = response.json()
                knowledge_cards = data.get("outputs", {}).get("knowledge_cards", [])
                formatted_results = []
                for card in knowledge_cards:
                    card_id = card.get("card_id")
                    title = card.get("title", "")
                    description = card.get("description", "")
                    embed_url = card.get("embed_url", "")
                    print(f"  DEBUG: card_id={card_id}, embed_url={embed_url}, title={title[:50]}...")

                    formatted_results.append({
                        "type": "tako_chart",
                        "content": description,
                        "pub_id": card_id,
                        "embed_url": embed_url,
                        "title": title,
                        "description": description,
                        "url": embed_url
                    })

                print(f"✓ Tako search succeeded for '{query}': {len(formatted_results)} results")
                if formatted_results:
                    for i, r in enumerate(formatted_results[:2]):
                        print(f"  [{i+1}] {r['title'][:60]} (pub_id: {r['pub_id']})")
                return formatted_results

            print(f"✗ Tako knowledge search failed: {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return []

    except Exception as e:
        print(f"Failed to call Tako knowledge search: {e}")
        import traceback
        traceback.print_exc()
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
    if USE_DIRECT_MCP:
        result = await _call_mcp_tool("explore_knowledge_graph", {
            "query": query,
            "api_token": tako_api_token,
            "node_types": node_types,
            "limit": limit
        })

        if result:
            print(f"✅ Tako MCP explore succeeded: {result.get('total_matches', 0)} matches")
            return result

        print(f"❌ Tako MCP explore failed or returned no results")
        return {"entities": [], "metrics": [], "cohorts": [], "time_periods": [], "total_matches": 0}

    # Legacy: Direct API call (when USE_DIRECT_MCP=False)
    tako_api_url = os.getenv("TAKO_API_URL", "http://localhost:8000")

    if tako_api_url and not tako_api_url.startswith(("http://", "https://")):
        tako_api_url = f"https://{tako_api_url}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{tako_api_url}/api/v1/explore/",
                json={
                    "query": query,
                    "node_types": node_types,
                    "limit": limit
                },
                headers={
                    "X-API-Key": tako_api_token,
                    "Content-Type": "application/json"
                }
            )

            if response.status_code == 200:
                data = response.json()
                print(f"✓ Tako explore succeeded: {data.get('total_matches', 0)} matches")
                return data

            print(f"✗ Tako explore failed: {response.status_code}")
            return {"entities": [], "metrics": [], "cohorts": [], "time_periods": [], "total_matches": 0}

    except Exception as e:
        print(f"Failed to call Tako explore: {e}")
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
    if USE_DIRECT_MCP and pub_id:
        result = await _call_mcp_tool("open_chart_ui", {
            "pub_id": pub_id,
            "dark_mode": True,
            "width": 900,
            "height": 600
        })

        if result and isinstance(result, list) and len(result) > 0:
            # MCP returns UIResource objects
            ui_resource = result[0]
            if isinstance(ui_resource, dict) and "content" in ui_resource:
                content = ui_resource["content"]
                if isinstance(content, dict) and "htmlString" in content:
                    print(f"✅ Got chart iframe HTML from MCP for pub_id: {pub_id}")
                    return content["htmlString"]

        print(f"❌ Failed to get chart iframe from MCP")
        return None

    # Legacy: Generate iframe HTML with dynamic resizing script
    if not embed_url:
        print(f"❌ No embed_url provided for iframe generation")
        return None

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
