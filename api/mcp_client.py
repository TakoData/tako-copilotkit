"""
Shared MCP client for Vercel serverless functions.
This is a simplified version that doesn't maintain persistent connections.
"""
import asyncio
import json
import os
from typing import Optional

import httpx


class SimpleMCPClient:
    """Minimal MCP client for Tako server - stateless for serverless."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session_id = None
        self.message_id = 0
        self._responses = {}

    async def connect(self):
        """Connect to MCP server and get session ID via SSE."""
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            try:
                async with client.stream("GET", f"{self.base_url}/sse") as resp:
                    if resp.status_code != 200:
                        return False

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
                                return True

                        # Only wait for first message
                        if self.session_id:
                            return True
            except Exception as e:
                print(f"Connection error: {e}")
                return False

        return False

    async def initialize(self):
        """Initialize MCP connection."""
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            msg = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "tako-vercel", "version": "1.0.0"},
                },
            }
            resp = await client.post(
                f"{self.base_url}/messages/?session_id={self.session_id}",
                json=msg,
            )
            return resp.status_code == 200

    async def call_tool(self, name: str, args: dict):
        """Call an MCP tool."""
        self.message_id += 1
        msg = {
            "jsonrpc": "2.0",
            "id": self.message_id,
            "method": "tools/call",
            "params": {"name": name, "arguments": args},
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            resp = await client.post(
                f"{self.base_url}/messages/?session_id={self.session_id}",
                json=msg,
            )

            if resp.status_code >= 400:
                raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")

            # For Vercel serverless, we need to poll or wait for response differently
            # Simplified: return the immediate response
            return resp.json()


async def get_mcp_response(base_url: str, tool_name: str, tool_args: dict):
    """Helper to get MCP response in a serverless context."""
    client = SimpleMCPClient(base_url)

    if not await client.connect():
        raise RuntimeError("Failed to connect to MCP server")

    if not await client.initialize():
        raise RuntimeError("Failed to initialize MCP client")

    return await client.call_tool(tool_name, tool_args)
