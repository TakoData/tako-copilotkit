#!/usr/bin/env python3
"""
FastAPI backend that proxies requests to Tako's MCP server.
This provides a simple HTTP API for the CopilotKit frontend to interact with Tako's MCP tools.
"""
import asyncio
import json
import os
from typing import Any, Dict, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configuration
MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "http://localhost:8001")
TAKO_API_TOKEN = os.environ.get("TAKO_API_TOKEN", "")

app = FastAPI(title="Tako MCP Proxy for CopilotKit")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimpleMCPClient:
    """Minimal MCP client for Tako server."""

    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url.rstrip("/")
        self.session_id = None
        self.message_id = 0
        self._responses = {}
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0))
        self._sse_task = None

    async def connect(self):
        """Connect to MCP server and get session ID."""
        self._sse_task = asyncio.create_task(self._sse_reader())
        for _ in range(50):
            if self.session_id:
                await asyncio.sleep(0.2)
                return True
            await asyncio.sleep(0.1)
        return False

    async def _sse_reader(self):
        """Read SSE events from server."""
        try:
            print(f"Attempting SSE connection to {self.base_url}/sse")
            async with self._client.stream("GET", f"{self.base_url}/sse") as resp:
                print(f"SSE response status: {resp.status_code}")
                if resp.status_code != 200:
                    print(f"SSE connection failed: {resp.status_code}")
                    print(f"Response text: {await resp.aread()}")
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
                            print(f"✓ Connected to MCP server (session: {self.session_id[:8]}...)")
                        elif event_type == "message":
                            try:
                                msg = json.loads(data)
                                msg_id = msg.get("id")
                                if msg_id in self._responses:
                                    self._responses[msg_id].set_result(msg)
                            except Exception as e:
                                print(f"Error parsing message: {e}")
                        event_type = None
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"SSE error: {type(e).__name__}: {e}")
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
        """Send JSON-RPC message to server."""
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
                raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"HTTP error: {e.response.status_code}")

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
                "clientInfo": {"name": "tako-copilotkit-proxy", "version": "1.0.0"},
            },
        )

    async def call_tool(self, name: str, args: dict):
        """Call an MCP tool."""
        return await self._send("tools/call", {"name": name, "arguments": args})


# Global MCP client instance (reused across requests)
mcp_client: Optional[SimpleMCPClient] = None


async def get_mcp_client() -> SimpleMCPClient:
    """Get or create MCP client."""
    global mcp_client
    if mcp_client is None or mcp_client.session_id is None:
        mcp_client = SimpleMCPClient(MCP_SERVER_URL)
        if not await mcp_client.connect():
            raise HTTPException(status_code=500, detail="Failed to connect to MCP server")
        await mcp_client.initialize()
    return mcp_client


# Request/Response models
class KnowledgeSearchRequest(BaseModel):
    query: str
    count: int = 5
    search_effort: str = "deep"
    country_code: str = "US"
    locale: str = "en-US"


class OpenChartUIRequest(BaseModel):
    pub_id: str
    dark_mode: bool = True
    width: int = 900
    height: int = 600


class GetChartInsightsRequest(BaseModel):
    pub_id: str
    effort: str = "medium"


class GetChartImageRequest(BaseModel):
    pub_id: str
    dark_mode: bool = True


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/api/mcp/knowledge_search")
async def knowledge_search(request: KnowledgeSearchRequest):
    """
    Search Tako's knowledge base for charts.
    Proxies to the MCP server's knowledge_search tool.
    """
    client = await get_mcp_client()

    try:
        result = await client.call_tool(
            "knowledge_search",
            {
                "query": request.query,
                "api_token": TAKO_API_TOKEN,
                "count": request.count,
                "search_effort": request.search_effort,
                "country_code": request.country_code,
                "locale": request.locale,
            },
        )

        print(f"MCP result: {json.dumps(result, indent=2)[:500]}")
        content = result.get("result", {}).get("content", [])
        print(f"Content: {content}")
        if not content:
            return {"results": [], "count": 0}

        text_content = content[0].get("text", "{}")
        print(f"Text content: {text_content[:200]}")
        data = json.loads(text_content)
        return data

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mcp/open_chart_ui")
async def open_chart_ui(request: OpenChartUIRequest):
    """
    Open an interactive chart UI.
    Proxies to the MCP server's open_chart_ui tool and extracts the HTML.
    """
    client = await get_mcp_client()

    try:
        result = await client.call_tool(
            "open_chart_ui",
            {
                "pub_id": request.pub_id,
                "dark_mode": request.dark_mode,
                "width": request.width,
                "height": request.height,
            },
        )

        # Extract UI resource
        ui_content = result.get("result", {}).get("content", [])
        resource_item = next((c for c in ui_content if c.get("type") == "resource"), None)

        if not resource_item:
            raise HTTPException(status_code=404, detail="No UI resource returned")

        resource = resource_item.get("resource", {})

        # Extract HTML content
        html_content = resource.get("htmlString")
        if not html_content:
            content_obj = resource.get("content")
            if isinstance(content_obj, dict):
                html_content = content_obj.get("htmlString")

        if not html_content:
            html_content = resource.get("text")

        if not html_content:
            raise HTTPException(status_code=404, detail="Could not extract HTML from UI resource")

        return {
            "html": html_content,
            "pub_id": request.pub_id,
            "uri": resource.get("uri", ""),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mcp/get_card_insights")
async def get_card_insights(request: GetChartInsightsRequest):
    """
    Get AI-generated insights for a chart.
    Proxies to the MCP server's get_card_insights tool.
    """
    client = await get_mcp_client()

    try:
        result = await client.call_tool(
            "get_card_insights",
            {
                "pub_id": request.pub_id,
                "api_token": TAKO_API_TOKEN,
                "effort": request.effort,
            },
        )

        content = result.get("result", {}).get("content", [])
        if not content:
            return {"error": "No insights returned"}

        data = json.loads(content[0].get("text", "{}"))
        return data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mcp/get_chart_image")
async def get_chart_image(request: GetChartImageRequest):
    """
    Get the preview image URL for a chart.
    Proxies to the MCP server's get_chart_image tool.
    """
    client = await get_mcp_client()

    try:
        result = await client.call_tool(
            "get_chart_image",
            {
                "pub_id": request.pub_id,
                "api_token": TAKO_API_TOKEN,
                "dark_mode": request.dark_mode,
            },
        )

        content = result.get("result", {}).get("content", [])
        if not content:
            return {"error": "No image data returned"}

        data = json.loads(content[0].get("text", "{}"))
        return data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up MCP client on shutdown."""
    global mcp_client
    if mcp_client:
        await mcp_client.close()


if __name__ == "__main__":
    import uvicorn

    print("Starting Tako MCP Proxy Server...")
    print(f"MCP Server URL: {MCP_SERVER_URL}")
    print(f"API Token: {'Set' if TAKO_API_TOKEN else 'Not set (will use empty string)'}")

    uvicorn.run(app, host="0.0.0.0", port=8002)
