"""
Vercel serverless function for opening chart UI.
"""
import json
import os
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            request_data = json.loads(body)
            pub_id = request_data.get('pub_id', '')
            dark_mode = request_data.get('dark_mode', True)
            width = request_data.get('width', 900)
            height = request_data.get('height', 600)

            # Get environment variables
            mcp_url = os.environ.get('TAKO_MCP_URL', 'http://localhost:8001')

            # Call MCP server
            import asyncio
            result = asyncio.run(self._call_mcp(mcp_url, pub_id, dark_mode, width, height))

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

    async def _call_mcp(self, mcp_url, pub_id, dark_mode, width, height):
        """Call MCP server and return chart UI HTML."""
        from .mcp_client import get_mcp_response

        result = await get_mcp_response(
            mcp_url,
            "open_chart_ui",
            {
                "pub_id": pub_id,
                "dark_mode": dark_mode,
                "width": width,
                "height": height,
            }
        )

        # Extract UI resource
        ui_content = result.get("result", {}).get("content", [])
        resource_item = next((c for c in ui_content if c.get("type") == "resource"), None)

        if not resource_item:
            return {"error": "No UI resource returned"}

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
            return {"error": "Could not extract HTML from UI resource"}

        return {
            "html": html_content,
            "pub_id": pub_id,
            "uri": resource.get("uri", ""),
        }
