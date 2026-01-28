"""
The search node is responsible for searching the internet for information.
"""

import asyncio
import logging
import os
from typing import Any, Dict, List, cast

from copilotkit.langgraph import copilotkit_emit_state
from langchain.tools import tool
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field
from tavily import TavilyClient

from src.lib.model import get_model
from src.lib.state import AgentState
from src.lib.mcp_integration import search_knowledge_base, get_visualization_iframe

logger = logging.getLogger(__name__)


# Configuration
MAX_WEB_SEARCHES = 1
MAX_TOTAL_RESOURCES = 10  # Maximum total resources to prevent context bloat

class ResourceInput(BaseModel):
    """A resource with a short description"""

    url: str = Field(description="The URL of the resource")
    title: str = Field(description="The title of the resource")
    description: str = Field(description="A short description of the resource")


@tool
def ExtractResources(resources: List[ResourceInput]):  # pylint: disable=invalid-name,unused-argument
    """Extract the 3-5 most relevant resources from a search result."""


# Lazy-initialize Tavily client
_tavily_client = None

def get_tavily_client():
    global _tavily_client
    if _tavily_client is None:
        tavily_api_key = os.getenv("TAVILY_API_KEY")
        if not tavily_api_key:
            raise ValueError("TAVILY_API_KEY environment variable is not set")
        _tavily_client = TavilyClient(api_key=tavily_api_key)
    return _tavily_client


# Async version of Tavily search that runs the synchronous client in a thread pool
async def async_tavily_search(query: str) -> Dict[str, Any]:
    """Asynchronous wrapper for Tavily search API"""
    loop = asyncio.get_event_loop()
    try:
        # Run the synchronous tavily_client.search in a thread pool
        return await loop.run_in_executor(
            None,
            lambda: get_tavily_client().search(
                query=query,
                search_depth="advanced",
                include_answer=True,
                max_results=10,
            ),
        )
    except Exception as e:
        raise Exception(f"Tavily search failed: {str(e)}")


async def search_node(state: AgentState, config: RunnableConfig):
    """
    The search node is responsible for searching the internet for resources.
    Performs both Tavily web search and Tako knowledge search in parallel.
    """
    logger.info("=== SEARCH_NODE: Starting execution ===")
    logger.info(f"State keys: {list(state.keys())}")
    logger.info(f"Messages count: {len(state.get('messages', []))}")

    try:
        # Find the last AIMessage (not ToolMessage) in the messages
        ai_message = None
        for msg in reversed(state["messages"]):
            if isinstance(msg, AIMessage):
                ai_message = msg
                break

        if not ai_message:
            logger.warning("No AIMessage found in search_node - returning state unchanged")
            # Return state unchanged to allow graph to continue
            return state

        state["resources"] = state.get("resources", [])
        state["logs"] = state.get("logs", [])

        # Handle both Search tool and GenerateDataQuestions routing
        if ai_message.tool_calls and ai_message.tool_calls[0]["name"] == "Search":
            queries = ai_message.tool_calls[0]["args"].get("queries", [])[:MAX_WEB_SEARCHES]
        else:
            queries = []  # No web search queries when coming from GenerateDataQuestions

        data_questions = state.get("data_questions", [])

        # Separate fast and prediction market questions
        fast_questions = [q for q in data_questions if isinstance(q, dict) and q.get("search_effort") == "fast"]
        prediction_market_questions = [q for q in data_questions if isinstance(q, dict) and q.get("query_type") == "prediction_market"]

        # All Tako questions run as fast in Phase 1
        all_tako_questions = fast_questions + prediction_market_questions

        search_results = []
        tako_results = []

        # PHASE 1: Run all Tako searches (as fast) and Tavily web searches in parallel
        # Add logs for all searches
        for query in queries:
            state["logs"].append({"message": f"Web search: {query}", "done": False})
        for q_obj in all_tako_questions:
            state["logs"].append({"message": f"Tako search: {q_obj['question']}", "done": False})
        if queries or all_tako_questions:
            await copilotkit_emit_state(config, state)

        # Build all tasks - all Tako searches run as "fast" in Phase 1
        tavily_tasks = [async_tavily_search(query) for query in queries]
        tako_tasks = [
            search_knowledge_base(q["question"], search_effort="fast")
            for q in all_tako_questions
        ]

        all_tasks = tavily_tasks + tako_tasks
        if all_tasks:
            all_results = await asyncio.gather(*all_tasks, return_exceptions=True)

            # Split results back into tavily and tako
            num_tavily = len(tavily_tasks)
            tavily_results = all_results[:num_tavily]
            tako_fast_results = all_results[num_tavily:]

            # Process Tavily results
            for i, result in enumerate(tavily_results):
                if isinstance(result, Exception):
                    search_results.append({"error": str(result)})
                else:
                    search_results.append(result)
                state["logs"][i]["done"] = True
                await copilotkit_emit_state(config, state)

            # Process Tako results
            tako_log_offset = num_tavily
            for i, result in enumerate(tako_fast_results):
                if isinstance(result, Exception):
                    tako_results.append({"error": str(result)})
                elif result:
                    tako_results.extend(result)
                state["logs"][tako_log_offset + i]["done"] = True
                await copilotkit_emit_state(config, state)

            logger.info(f"Phase 1 completed: {len(search_results)} web results, {len(tako_results)} Tako results")

        # PHASE 2: If Tako returned no results, run fallbacks
        if not tako_results:
            fallback_tasks = []
            fallback_logs = []

            # Fallback web searches for fast questions
            if fast_questions:
                logger.info("No Tako results found, falling back to web searches for Tako questions")
                fallback_web_queries = [q["question"] for q in fast_questions[:2]]
                for query in fallback_web_queries:
                    fallback_logs.append(("web", query))
                    state["logs"].append({"message": f"Fallback web search: {query}", "done": False})
                fallback_tasks.extend([async_tavily_search(query) for query in fallback_web_queries])

            # Deep search for prediction market questions
            if prediction_market_questions:
                logger.info("Re-running prediction market queries with deep search")
                for q_obj in prediction_market_questions:
                    fallback_logs.append(("deep", q_obj["question"]))
                    state["logs"].append({"message": f"Tako deep search: {q_obj['question']}", "done": False})
                fallback_tasks.extend([
                    search_knowledge_base(q["question"], search_effort="deep")
                    for q in prediction_market_questions
                ])

            if fallback_tasks:
                await copilotkit_emit_state(config, state)
                fallback_results = await asyncio.gather(*fallback_tasks, return_exceptions=True)

                log_offset = len(state["logs"]) - len(fallback_tasks)
                for i, result in enumerate(fallback_results):
                    task_type, _ = fallback_logs[i]
                    if isinstance(result, Exception):
                        if task_type == "web":
                            search_results.append({"error": str(result)})
                        else:
                            tako_results.append({"error": str(result)})
                    elif task_type == "web":
                        search_results.append(result)
                    elif result:  # deep Tako result
                        # Add resources immediately for streaming
                        existing_urls = {r.get("url") for r in state["resources"]}
                        existing_titles = {r.get("title", "").lower() for r in state["resources"] if r.get("resource_type") == "tako_chart"}
                        for chart in result:
                            chart_title_lower = chart.get("title", "").lower()
                            if chart.get("url") not in existing_urls and chart_title_lower not in existing_titles:
                                iframe_html = await get_visualization_iframe(
                                    item_id=chart.get("id"),
                                    embed_url=chart.get("embed_url")
                                )
                                state["resources"].append({
                                    "url": chart["url"],
                                    "title": chart["title"],
                                    "description": chart["description"],
                                    "content": chart["description"],
                                    "resource_type": "tako_chart",
                                    "source": "Tako",
                                    "card_id": chart.get("id"),
                                    "embed_url": chart.get("embed_url"),
                                    "iframe_html": iframe_html,
                                })
                                existing_urls.add(chart["url"])
                                existing_titles.add(chart_title_lower)
                        tako_results.extend(result)
                    state["logs"][log_offset + i]["done"] = True
                    await copilotkit_emit_state(config, state)

                logger.info("Phase 2 fallback completed")

        # Deduplicate Tako charts by title (same chart may appear in multiple searches)
        seen_titles = {}
        deduped_tako = []
        duplicates_removed = 0
        for chart in tako_results:
            if isinstance(chart, dict):
                title = chart.get("title", "")
                if title and title not in seen_titles:
                    seen_titles[title] = True
                    deduped_tako.append(chart)
                elif not title:  # Keep charts without titles
                    deduped_tako.append(chart)
                elif title:
                    duplicates_removed += 1
        tako_results = deduped_tako
        if duplicates_removed > 0:
            logger.info(f"Removed {duplicates_removed} duplicate Tako charts by title")

        # Note: We don't use emit_intermediate_state for resources here because
        # we manually manage and emit resources throughout the search process.
        # Using emit_intermediate_state would replace accumulated resources with
        # just the newly selected ones, causing flicker.

        model = get_model(state)
        ainvoke_kwargs = {}
        if model.__class__.__name__ in ["ChatOpenAI"]:
            ainvoke_kwargs["parallel_tool_calls"] = False

        # Prepare search results message including Tako charts
        search_message = f"Web search results: {search_results}"
        if tako_results:
            search_message += f"\n\nTako chart results (data visualizations): {tako_results}"

        # Prepare messages for ExtractResources call
        # If coming from Search tool, add search results as ToolMessage
        # Otherwise (from GenerateDataQuestions), add as SystemMessage
        extract_messages = [
            SystemMessage(
                content="""
            You need to extract the 3-5 most relevant resources from the following search results.
            This includes both web resources and Tako chart visualizations.
            Tako charts are valuable data visualizations that should be prioritized when relevant.
            """
            ),
            *state["messages"],
        ]

        if ai_message.tool_calls and ai_message.tool_calls[0]["name"] == "Search":
            # Add search results as ToolMessage response to Search tool call
            extract_messages.append(
                ToolMessage(
                    tool_call_id=ai_message.tool_calls[0]["id"],
                    content=search_message,
                )
            )
        else:
            # Add search results as SystemMessage (no tool_call to respond to)
            extract_messages.append(
                SystemMessage(content=f"Search results:\n{search_message}")
            )

        # Add status update for resource extraction
        state["logs"].append({"message": "Selecting most relevant resources...", "done": False})
        await copilotkit_emit_state(config, state)

        # figure out which resources to use
        response = await model.bind_tools(
            [ExtractResources], tool_choice="ExtractResources", **ainvoke_kwargs
        ).ainvoke(extract_messages, config)

        # Mark resource extraction as complete (cleared immediately after)
        state["logs"][-1]["done"] = True

        state["logs"] = []
        await copilotkit_emit_state(config, state)

        ai_message_response = cast(AIMessage, response)
        resources = ai_message_response.tool_calls[0]["args"]["resources"]

        # Tag resources with resource_type and attach content
        for resource in resources:
            # Check if this resource is from Tako by matching URL or card_id
            is_tako = False
            for tako_result in tako_results:
                if isinstance(tako_result, dict) and (
                    resource.get("url") == tako_result.get("url") or
                    (tako_result.get("id") and resource.get("title") == tako_result.get("title"))
                ):
                    is_tako = True
                    resource["resource_type"] = "tako_chart"
                    resource["source"] = "Tako"
                    resource["card_id"] = tako_result.get("id")  # Changed from pub_id to card_id
                    resource["embed_url"] = tako_result.get("embed_url")  # Add embed_url
                    # Store truncated description as content (no iframe HTML)
                    resource["content"] = tako_result.get("description", "")
                    break

            if not is_tako:
                resource["resource_type"] = "web"
                resource["source"] = "Tavily Web Search"
                # Find matching Tavily result and use its content field (summary)
                for search_result in search_results:
                    if isinstance(search_result, dict) and "results" in search_result:
                        for tavily_item in search_result["results"]:
                            if tavily_item.get("url") == resource.get("url"):
                                # Use Tavily's content summary directly
                                resource["content"] = tavily_item.get("content", "")
                                break

        # Generate iframe HTML for Tako charts that don't have it yet
        for resource in resources:
            if resource.get("resource_type") == "tako_chart" and not resource.get("iframe_html"):
                card_id = resource.get("card_id")
                embed_url = resource.get("embed_url")
                if card_id or embed_url:
                    iframe_html = await get_visualization_iframe(
                        item_id=card_id,
                        embed_url=embed_url
                    )
                    if iframe_html:
                        resource["iframe_html"] = iframe_html

        # Enforce resource limit to prevent context bloat
        current_count = len(state["resources"])
        remaining_slots = MAX_TOTAL_RESOURCES - current_count

        # Deduplicate by both URL and title (for Tako charts)
        existing_urls = {r.get("url") for r in state["resources"]}
        existing_titles = {r.get("title", "").lower() for r in state["resources"] if r.get("resource_type") == "tako_chart"}

        unique_resources = []
        for r in resources:
            r_title_lower = r.get("title", "").lower()
            is_tako = r.get("resource_type") == "tako_chart"

            # For Tako charts, check both URL and title; for web resources, just URL
            if is_tako:
                if r.get("url") not in existing_urls and r_title_lower not in existing_titles:
                    unique_resources.append(r)
                    existing_urls.add(r.get("url"))
                    existing_titles.add(r_title_lower)
            else:
                if r.get("url") not in existing_urls:
                    unique_resources.append(r)
                    existing_urls.add(r.get("url"))

        if remaining_slots > 0:
            resources_to_add = unique_resources[:remaining_slots]
            state["resources"].extend(resources_to_add)
        else:
            resources_to_add = []

        # Only add ToolMessage response if we came from a Search tool call
        # (GenerateDataQuestions already has its response added in chat_node)
        if ai_message.tool_calls and ai_message.tool_calls[0]["name"] == "Search":
            state["messages"].append(
                ToolMessage(
                    tool_call_id=ai_message.tool_calls[0]["id"],
                    content=f"Added the following resources: {resources_to_add}",
                )
            )

            # Clear data_questions after processing
            state["data_questions"] = []

            logger.info("=== SEARCH_NODE: Completed successfully ===")
        return state

    except Exception as e:
        # Catch any unexpected errors to ensure node completes properly
        logger.error(f"Error in search_node: {e}", exc_info=True)

        # Add error log for user visibility
        state["logs"] = state.get("logs", [])
        state["logs"].append({
            "message": f"Search encountered an error: {str(e)}",
            "done": True
        })
        await copilotkit_emit_state(config, state)

        # Clear data_questions to prevent retry loops
        state["data_questions"] = []

        # Return state to allow graph to continue
        logger.info("=== SEARCH_NODE: Completed with errors ===")
        return state
