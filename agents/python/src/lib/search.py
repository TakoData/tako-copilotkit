"""
The search node is responsible for searching the internet for information.
"""

import asyncio
import os
from typing import Any, Dict, List, cast

from copilotkit.langgraph import copilotkit_customize_config, copilotkit_emit_state
from langchain.tools import tool
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field
from tavily import TavilyClient

from src.lib.model import get_model
from src.lib.state import AgentState
from src.lib.tako_mcp import call_tako_knowledge_search, get_tako_chart_iframe


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

    # Find the last AIMessage (not ToolMessage) in the messages
    ai_message = None
    for msg in reversed(state["messages"]):
        if isinstance(msg, AIMessage):
            ai_message = msg
            break

    if not ai_message:
        raise ValueError("No AIMessage found in messages")

    state["resources"] = state.get("resources", [])
    state["logs"] = state.get("logs", [])

    # Handle both Search tool and GenerateDataQuestions routing
    if ai_message.tool_calls and ai_message.tool_calls[0]["name"] == "Search":
        queries = ai_message.tool_calls[0]["args"].get("queries", [])
    else:
        queries = []  # No web search queries when coming from GenerateDataQuestions

    data_questions = state.get("data_questions", [])

    # Add logs for both web and Tako searches
    for query in queries:
        state["logs"].append({"message": f"Web search for {query}", "done": False})

    for question in data_questions:
        state["logs"].append({"message": f"Tako search for {question}", "done": False})

    await copilotkit_emit_state(config, state)

    search_results = []
    tako_results = []

    # Run Tavily web search and Tako knowledge search in parallel
    tavily_tasks = [async_tavily_search(query) for query in queries]
    tako_tasks = [call_tako_knowledge_search(question) for question in data_questions]

    all_tasks = tavily_tasks + tako_tasks
    results = await asyncio.gather(*all_tasks, return_exceptions=True)

    # Split results back into Tavily and Tako
    num_tavily = len(tavily_tasks)
    tavily_results = results[:num_tavily]
    tako_search_results = results[num_tavily:]

    # Process Tavily results
    for i, result in enumerate(tavily_results):
        if isinstance(result, Exception):
            search_results.append({"error": str(result)})
        else:
            search_results.append(result)
        state["logs"][i]["done"] = True
        await copilotkit_emit_state(config, state)

    # Process Tako results
    for i, result in enumerate(tako_search_results):
        log_index = num_tavily + i
        if isinstance(result, Exception):
            tako_results.append({"error": str(result)})
        elif result:  # Tako returned results
            # Get iframe HTML for each Tako chart
            for chart in result:
                embed_url = chart.get("embed_url")
                if embed_url:
                    iframe_html = await get_tako_chart_iframe(embed_url)
                    chart["iframe_html"] = iframe_html
            tako_results.extend(result)
        state["logs"][log_index]["done"] = True
        await copilotkit_emit_state(config, state)

    # Deduplicate Tako charts by title (same chart may appear in multiple searches)
    seen_titles = {}
    deduped_tako = []
    for chart in tako_results:
        if isinstance(chart, dict):
            title = chart.get("title", "")
            if title and title not in seen_titles:
                seen_titles[title] = True
                deduped_tako.append(chart)
            elif not title:  # Keep charts without titles
                deduped_tako.append(chart)
    tako_results = deduped_tako
    print(f"Deduplicated Tako results: {len(deduped_tako)} unique charts")

    config = copilotkit_customize_config(
        config,
        emit_intermediate_state=[
            {
                "state_key": "resources",
                "tool": "ExtractResources",
                "tool_argument": "resources",
            }
        ],
    )

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

    # figure out which resources to use
    response = await model.bind_tools(
        [ExtractResources], tool_choice="ExtractResources", **ainvoke_kwargs
    ).ainvoke(extract_messages, config)

    state["logs"] = []
    await copilotkit_emit_state(config, state)

    ai_message_response = cast(AIMessage, response)
    resources = ai_message_response.tool_calls[0]["args"]["resources"]

    # Tag resources with resource_type
    for resource in resources:
        # Check if this resource is from Tako by matching URL or pub_id
        is_tako = False
        for tako_result in tako_results:
            if isinstance(tako_result, dict) and (
                resource.get("url") == tako_result.get("url") or
                (tako_result.get("pub_id") and resource.get("title") == tako_result.get("title"))
            ):
                is_tako = True
                resource["resource_type"] = "tako_chart"
                resource["source"] = "Tako"
                resource["pub_id"] = tako_result.get("pub_id")
                resource["iframe_html"] = tako_result.get("iframe_html")
                break

        if not is_tako:
            resource["resource_type"] = "web"
            resource["source"] = "Tavily Web Search"

    state["resources"].extend(resources)

    # Only add ToolMessage response if we came from a Search tool call
    # (GenerateDataQuestions already has its response added in chat_node)
    if ai_message.tool_calls and ai_message.tool_calls[0]["name"] == "Search":
        state["messages"].append(
            ToolMessage(
                tool_call_id=ai_message.tool_calls[0]["id"],
                content=f"Added the following resources: {resources}",
            )
        )

    # Clear data_questions after processing
    state["data_questions"] = []

    return state
