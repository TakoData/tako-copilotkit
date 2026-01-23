"""Chat Node"""

import logging
from typing import List, Literal, cast

from copilotkit.langgraph import copilotkit_customize_config, copilotkit_emit_state
from langchain.tools import tool
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command

from src.lib.download import get_resource
from src.lib.model import get_model
from src.lib.state import AgentState, DataQuestion
from src.lib.mcp_integration import (
    get_visualization_iframe
)

logger = logging.getLogger(__name__)


# Feature toggles
ENABLE_DEEP_QUERIES = False


@tool
def Search(queries: List[str]):  # pylint: disable=invalid-name,unused-argument
    """A list of one or more search queries to find good resources to support the research."""


@tool
def WriteReport(report: str):  # pylint: disable=invalid-name,unused-argument
    """Write the research report."""


@tool
def WriteResearchQuestion(research_question: str):  # pylint: disable=invalid-name,unused-argument
    """Write the research question."""


@tool
def DeleteResources(urls: List[str]):  # pylint: disable=invalid-name,unused-argument
    """Delete the URLs from the resources."""


@tool
def GenerateDataQuestions(questions: List[DataQuestion]):  # pylint: disable=invalid-name,unused-argument
    """
    Generate 3-6 data-focused questions to search Tako's knowledge base.

    Create a diverse set of questions with different complexity levels:
    - 2-3 basic questions (search_effort='fast') for straightforward data lookups
    - 1-2 complex questions (search_effort='deep') for in-depth analysis
    - 0-1 prediction market questions (search_effort='deep') about forecasts, probabilities, or future outcomes

    Example:
    [
        {"question": "China GDP since 1960", "search_effort": "fast", "query_type": "basic"},
        {"question": "Compare year-over-year growth in exports for east asian countries", "search_effort": "deep", "query_type": "complex"},
        {"question": "What are prediction market odds for China invading Taiwan in 2025?", "search_effort": "deep", "query_type": "prediction_market"}
    ]
    """


async def chat_node(
    state: AgentState, config: RunnableConfig
) -> Command[Literal["search_node", "chat_node", "delete_node", "__end__"]]:
    """
    Chat Node
    """
    logger.info("=== CHAT_NODE: Starting execution ===")

    config = copilotkit_customize_config(
        config,
        emit_intermediate_state=[
            {
                "state_key": "report",
                "tool": "WriteReport",
                "tool_argument": "report",
            },
            {
                "state_key": "research_question",
                "tool": "WriteResearchQuestion",
                "tool_argument": "research_question",
            },
            {
                "state_key": "data_questions",
                "tool": "GenerateDataQuestions",
                "tool_argument": "questions",
            },
        ],
    )

    state["resources"] = state.get("resources", [])
    research_question = state.get("research_question", "")
    report = state.get("report", "")

    resources = []
    tako_charts_map = {}
    available_tako_charts = []

    for resource in state["resources"]:
        # Tako charts - use stored description as content
        if resource.get("resource_type") == "tako_chart":
            title = resource.get("title", "")
            card_id = resource.get("card_id")  # Changed from pub_id
            embed_url = resource.get("embed_url")
            description = resource.get("description", "")

            # Add to resources with description as content
            resources.append({
                **resource,
                "content": description
            })

            # Build Tako charts map for post-processing (generate iframe on demand)
            if title and (card_id or embed_url):
                # Store card_id/embed_url for later iframe generation
                tako_charts_map[title] = {"card_id": card_id, "embed_url": embed_url}
                available_tako_charts.append(f"  - **{title}**\n    Description: {description}")
        else:
            # Web resources: use pre-stored Tavily summary (no download needed)
            content = resource.get("content", "")
            if not content:
                # Fallback: download if content is missing (shouldn't happen normally)
                content = get_resource(resource["url"])
                if content == "ERROR":
                    continue
            resources.append({**resource, "content": content})

    available_tako_charts_str = "\n".join(available_tako_charts) if available_tako_charts else "  (No Tako charts available yet)"

    logger.info(f"Built tako_charts_map with {len(tako_charts_map)} charts")
    logger.info(f"Chart titles: {list(tako_charts_map.keys())}")

    model = get_model(state)
    # Prepare the kwargs for the ainvoke method
    ainvoke_kwargs = {}
    if model.__class__.__name__ in ["ChatOpenAI"]:
        ainvoke_kwargs["parallel_tool_calls"] = False

    # Build dynamic prompt based on feature toggles
    if ENABLE_DEEP_QUERIES:
        data_questions_instructions = """2. THEN: Use GenerateDataQuestions to create 3-6 data-focused questions with varied complexity:
               - 2-3 BASIC questions (fast search) for straightforward data: "Country X GDP 2020-2024"
               - 1-2 COMPLEX questions (deep search) for analytical insights: "What factors drove X's growth?"
               - 0-1 PREDICTION MARKET question (deep search) if relevant: "What are odds for X in 2025?"
               - Use the entities, metrics, cohorts, and time periods listed in the knowledge base context above when available
               - Prefer exact entity/metric names from the knowledge base context for better search results"""
    else:
        data_questions_instructions = """2. THEN: Use GenerateDataQuestions to create 2-4 BASIC data-focused questions (fast search only):
               - Focus on straightforward data lookups: "Country X GDP 2020-2024"
               - Use the entities, metrics, cohorts, and time periods listed in the knowledge base context above when available
               - Prefer exact entity/metric names from the knowledge base context for better search results
               - 0-1 PREDICTION MARKET question if relevant: "What are prediction market odds for X in 2025?"
               - Note: Deep/complex queries are currently disabled"""

    # Add status update for query analysis
    state["logs"] = state.get("logs", [])
    state["logs"].append({"message": "Analyzing your research query...", "done": False})
    await copilotkit_emit_state(config, state)

    response = await model.bind_tools(
        [
            Search,
            WriteReport,
            WriteResearchQuestion,
            DeleteResources,
            GenerateDataQuestions,
        ],
        **ainvoke_kwargs,  # Pass the kwargs conditionally
    ).ainvoke(
        [
            SystemMessage(
                content=f"""
            You are a research assistant. You help the user with writing a research report.
            Do not recite the resources, instead use them to answer the user's question.

            {state.get("explore_context", "")}

            RESEARCH WORKFLOW:
            1. FIRST: When you receive a user's query, use WriteResearchQuestion to extract/formulate the core research question
            {data_questions_instructions}
            3. These questions will search Tako for relevant charts and visualizations
            4. Use the Search tool for web resources
            5. When writing the report, err on the side of using Tako charts wherever relevant and include [TAKO_CHART:title] markers
            6. Combine insights from both Tako charts and web resources in your report

            IMPORTANT ABOUT RESEARCH QUESTION:
            - Always start by using WriteResearchQuestion to capture the user's research intent
            - This creates a clear, focused question from their natural language query
            - If a research question is already provided, YOU MUST NOT ASK FOR IT AGAIN

            CRITICAL - EMBEDDING TAKO CHARTS IN REPORT:
            When writing your report, you can embed Tako chart visualizations using special markers.

            SYNTAX: [TAKO_CHART:exact_title_of_chart]

            AVAILABLE TAKO CHARTS ({len(tako_charts_map)} total):
{available_tako_charts_str}

            **Remember: You have {len(tako_charts_map)} charts available above. They are already fetched and ready to embed. Include at least 3-5 charts in your report!**

            IMPORTANT RULES:
            - DO NOT use markdown image syntax like ![title](url) - this will NOT work
            - DO NOT use HTML img tags - this will NOT work
            - ONLY use the [TAKO_CHART:title] marker syntax
            - DO NOT include external links like tradingeconomics.com
            - ONLY use charts from the AVAILABLE TAKO CHARTS list above

            EXAMPLE (CORRECT):
            ## Economic Growth Analysis

            China's economy has shown significant growth over the past decade...

            [TAKO_CHART:China GDP]

            The data visualization above shows the dramatic increase in GDP...

            RULES FOR EMBEDDING CHARTS (MANDATORY):
            - **MINIMUM REQUIREMENT**: Include at least 3-5 relevant charts in your report (more if appropriate)
            - **CRITICAL**: Err on the side of INCLUDING charts - if a chart is relevant, embed it!
            - Use [TAKO_CHART:exact_title] syntax to embed charts
            - The title must EXACTLY match one of the available charts listed above (copy the title from the bold text)
            - Position markers where you want the interactive chart to appear
            - Add a brief explanatory sentence before and after each chart
            - Charts are PRIMARY evidence - your report should include multiple charts with supporting text
            - Distribute charts throughout your report in relevant sections
            - Only skip a chart if it has no relevance to the research question
            - The chart will be automatically rendered as an interactive visualization

            **IMPORTANT**: Aim to include at least 3-5 charts from the list above to provide strong data-driven evidence!

            You should use the search tool to get resources before answering the user's question.
            Use the content and descriptions from both Tako charts and web resources to inform your report.
            If you finished writing the report, ask the user proactively for next steps, changes etc, make it engaging.
            To write the report, you should use the WriteReport tool. Never EVER respond with the report, only use the tool.

            This is the research question:
            {research_question}

            This is the research report:
            {report}

            Here are the resources that you have available:
            {resources}
            """
            ),
            *state["messages"],
        ],
        config,
    )

    # Mark query analysis as complete
    state["logs"][-1]["done"] = True
    await copilotkit_emit_state(config, state)

    ai_message = cast(AIMessage, response)
    if ai_message.tool_calls:
        if ai_message.tool_calls[0]["name"] == "WriteReport":
            report = ai_message.tool_calls[0]["args"].get("report", "")

            # Clean up: Remove any markdown image links that the LLM incorrectly added
            # Pattern: ![title](url) where url contains tradingeconomics, worldbank, etc.
            import re
            external_domains = r'(tradingeconomics|worldbank|imf|fred|ourworldindata|statista)'
            report = re.sub(rf'!\[([^\]]+)\]\(https?://[^)]*{external_domains}[^)]*\)',
                          r'', report, flags=re.IGNORECASE)

            # Remove any other markdown images that aren't Tako charts
            report = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', report)

            # Post-process: Replace Tako chart markers with actual iframe HTML
            embedded_charts = []
            async def replace_chart_marker_async(match):
                chart_title = match.group(1).strip()

                # Try exact match first
                chart_info = None
                if chart_title in tako_charts_map:
                    chart_info = tako_charts_map[chart_title]
                # Try case-insensitive match
                elif any(title.lower() == chart_title.lower() for title in tako_charts_map.keys()):
                    # Find the matching title (case-insensitive)
                    matching_title = next(title for title in tako_charts_map.keys() if title.lower() == chart_title.lower())
                    chart_info = tako_charts_map[matching_title]
                    logger.warning(f"Chart title case mismatch: '{chart_title}' matched to '{matching_title}'")
                else:
                    logger.error(f"Chart not found: '{chart_title}'. Available: {list(tako_charts_map.keys())}")
                    return f"\n\n[Chart not found: {chart_title}]\n\n"

                embedded_charts.append(chart_title)
                # Generate iframe HTML on demand
                iframe_html = await get_visualization_iframe(
                    item_id=chart_info.get("card_id"),
                    embed_url=chart_info.get("embed_url")
                )
                if iframe_html:
                    # Remove script tags - resize listener is handled in React component
                    iframe_only = re.sub(r'<script.*?</script>', '', iframe_html, flags=re.DOTALL)
                    # Strip any extra whitespace and return with minimal spacing
                    return "\n" + iframe_only.strip() + "\n"
                else:
                    logger.error(f"Failed to generate iframe for: '{chart_title}'")
                    return f"\n\n[Chart iframe generation failed: {chart_title}]\n\n"

            # Find all chart markers and replace them asynchronously
            chart_markers = list(re.finditer(r'\[TAKO_CHART:([^\]]+)\]', report))
            logger.info(f"Found {len(chart_markers)} chart markers in report")
            for marker in chart_markers:
                logger.info(f"  Marker: [TAKO_CHART:{marker.group(1)}]")

            replacements = []
            for match in chart_markers:
                replacement = await replace_chart_marker_async(match)
                replacements.append((match.start(), match.end(), replacement))

            # Apply replacements in reverse order to preserve positions
            processed_report = report
            for start, end, replacement in reversed(replacements):
                processed_report = processed_report[:start] + replacement + processed_report[end:]

            logger.info(f"Report processing complete. Embedded {len([r for r in replacements if '<iframe' in r[2]])} charts")

            return Command(
                goto="chat_node",
                update={
                    "report": processed_report,
                    "resources": state.get("resources", []),  # Preserve resources
                    "messages": [
                        ai_message,
                        ToolMessage(
                            tool_call_id=ai_message.tool_calls[0]["id"],
                            content="Report written.",
                        ),
                    ],
                },
            )
        if ai_message.tool_calls[0]["name"] == "WriteResearchQuestion":
            research_question = ai_message.tool_calls[0]["args"]["research_question"]
            return Command(
                goto="chat_node",
                update={
                    "research_question": research_question,
                    "messages": [
                        ai_message,
                        ToolMessage(
                            tool_call_id=ai_message.tool_calls[0]["id"],
                            content="Research question written.",
                        ),
                    ],
                },
            )

    goto = "__end__"
    if ai_message.tool_calls:
        tool_name = ai_message.tool_calls[0]["name"]
        if tool_name == "Search":
            goto = "search_node"
        elif tool_name == "DeleteResources":
            goto = "delete_node"
        elif tool_name == "GenerateDataQuestions":
            # Store data questions and route to search
            data_questions = ai_message.tool_calls[0]["args"].get("questions", [])

            # Add status update for generated questions
            if data_questions:
                state["logs"].append({
                    "message": f"Generated {len(data_questions)} search questions",
                    "done": True
                })
                await copilotkit_emit_state(config, state)

            logger.info(f"GenerateDataQuestions: Routing to search_node with {len(data_questions)} questions")
            return Command(
                goto="search_node",
                update={
                    "data_questions": data_questions,
                    "messages": [
                        ai_message,
                        ToolMessage(
                            tool_call_id=ai_message.tool_calls[0]["id"],
                            content=f"Generated {len(data_questions)} data questions for Tako search.",
                        ),
                    ],
                },
            )

    logger.info(f"=== CHAT_NODE: Routing to {goto} ===")
    return Command(goto=goto, update={"messages": response})
