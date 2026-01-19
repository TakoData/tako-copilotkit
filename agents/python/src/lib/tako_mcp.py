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
    tako_api_url = os.getenv("TAKO_API_URL", "http://localhost:8000")
    tako_api_token = os.getenv("TAKO_API_TOKEN", "")

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
      iframe.style.height = (d.height + 4) + "px";
    }}
  }});
}}();
</script>'''

    return iframe_html
