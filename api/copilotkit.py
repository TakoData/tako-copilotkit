"""
CopilotKit runtime endpoint for Vercel serverless functions.
This proxies requests to the LangGraph agent.
"""
from http.server import BaseHTTPRequestHandler
import json
import os
import httpx

# For local development, use langgraph server
# For production, you'd deploy the agent and point here
AGENT_URL = os.environ.get("AGENT_URL", "http://localhost:8000")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests to CopilotKit runtime."""
        try:
            # Read request body
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")

            # Forward to LangGraph agent
            with httpx.Client() as client:
                response = client.post(
                    f"{AGENT_URL}/invoke",
                    content=body,
                    headers={
                        "Content-Type": "application/json",
                    },
                    timeout=60.0,
                )

                # Return agent response
                self.send_response(response.status_code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(response.content)

        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            error_response = json.dumps({"error": str(e)})
            self.wfile.write(error_response.encode())

    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
