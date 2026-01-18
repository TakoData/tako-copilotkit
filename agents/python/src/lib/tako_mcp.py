"""Tako API Direct Integration - Bypasses MCP for simplicity"""

import os
from typing import Any, Dict, List, Optional

import httpx


async def call_tako_knowledge_search(
    query: str,
    count: int = 5,
    search_effort: str = "fast"  # Changed to "fast" for quicker responses
) -> List[Dict[str, Any]]:
    """
    Call Tako knowledge search API directly.

    Args:
        query: Search query
        count: Number of results to return
        search_effort: Search effort level ('fast', 'medium', or 'deep')

    Returns:
        List of search results with chart metadata
    """
    tako_api_url = os.getenv("TAKO_API_URL", "http://localhost:8000")
    tako_api_token = os.getenv("TAKO_API_TOKEN", "")

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


async def get_tako_chart_iframe(embed_url: str) -> Optional[str]:
    """
    Get iframe HTML for a Tako chart with dynamic resizing.

    Args:
        card_id: Tako card ID

    Returns:
        Iframe HTML string with resizing script or None if failed
    """
    # Generate iframe HTML with dynamic resizing script
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
      iframe.style.height = d.height + "px";
    }}
  }});
}}();
</script>'''

    return iframe_html
