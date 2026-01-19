"""
Vercel serverless function for knowledge search.
"""
import json
import os
from http.server import BaseHTTPRequestHandler

import httpx


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            request_data = json.loads(body)
            query = request_data.get('query', '')
            count = request_data.get('count', 5)
            search_effort = request_data.get('search_effort', 'deep')

            # Get environment variables
            mcp_url = os.environ.get('TAKO_MCP_URL', 'http://localhost:8001')
            api_token = os.environ.get('TAKO_API_TOKEN', '')

            # Call MCP server directly via HTTP
            import asyncio
            result = asyncio.run(self._call_mcp(mcp_url, api_token, query, count, search_effort))

            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    async def _call_mcp(self, mcp_url, api_token, query, count, search_effort):
        """Call MCP server and return results."""
        from .mcp_client import get_mcp_response

        result = await get_mcp_response(
            mcp_url,
            "knowledge_search",
            {
                "query": query,
                "api_token": api_token,
                "count": count,
                "search_effort": search_effort,
                "country_code": "US",
                "locale": "en-US",
            }
        )

        # Extract results
        content = result.get("result", {}).get("content", [])
        if not content:
            return {"results": [], "count": 0}

        data = json.loads(content[0].get("text", "{}"))
        return data
