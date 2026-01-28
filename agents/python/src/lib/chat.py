"""Chat Node"""

import logging
from typing import List, Literal, cast

from copilotkit.langgraph import copilotkit_customize_config, copilotkit_emit_state
from langchain.tools import tool
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
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

    Create a diverse set of questions:
    - 2-4 basic questions (search_effort='fast') for straightforward data lookups AND superlative/ranking queries
    - 0-1 prediction market questions (search_effort='deep') about forecasts, probabilities, or future outcomes

    IMPORTANT - Include superlative/ranking queries (use fast search):
    - "Which countries have the highest GDP per capita?"
    - "Which cities have the highest rent?"
    - "What are the top 10 companies by market cap?"

    Example:
    [
        {"question": "China GDP since 1960", "search_effort": "fast", "query_type": "basic"},
        {"question": "Which countries have the highest inflation rates in 2024?", "search_effort": "fast", "query_type": "basic"},
        {"question": "Compare exports for east asian countries", "search_effort": "fast", "query_type": "basic"},
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

    # Note: report is NOT in emit_intermediate_state to prevent flicker
    # The report is only emitted once charts are injected
    config = copilotkit_customize_config(
        config,
        emit_intermediate_state=[
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
               - 1-2 COMPLEX questions (deep search) for analytical insights
               - 0-1 PREDICTION MARKET question (deep search) if relevant: "What are prediction market odds for X in 2025?"
               - Use the entities, metrics, cohorts, and time periods listed in the knowledge base context above when available
               - Prefer exact entity/metric names from the knowledge base context for better search results"""
    else:
        data_questions_instructions = """2. THEN: Use GenerateDataQuestions to create 3-5 data-focused questions:
               - 2-4 BASIC questions (fast search) for data lookups, comparisons, AND superlative/ranking queries:
                 * Data lookups: "Country X GDP 2020-2024"
                 * Superlatives: "Which cities have the highest rent?", "Which countries have the lowest unemployment?"
                 * Rankings: "Top 10 companies by market cap"
                 * Comparisons: "Compare GDP growth of X vs Y"
               - 0-1 PREDICTION MARKET question (deep search) if relevant: "What are prediction market odds for X in 2025?"
               - Use the entities, metrics, cohorts, and time periods listed in the knowledge base context above when available
               - Prefer exact entity/metric names from the knowledge base context for better search results"""

    # Add status update for query analysis
    state["logs"] = state.get("logs", [])
    state["logs"].append({"message": "Analyzing your research query...", "done": False})
    await copilotkit_emit_state(config, state)

    response = await model.bind_tools(
        [
            Search,
            WriteReport,
            WriteResearchQuestion,
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
            5. Write a clear, well-structured report using the data from your searches
            6. Combine insights from both Tako charts and web resources in your report

            IMPORTANT ABOUT RESEARCH QUESTION:
            - Always start by using WriteResearchQuestion to capture the user's research intent
            - This creates a clear, focused question from their natural language query
            - If a research question is already provided, YOU MUST NOT ASK FOR IT AGAIN

            AVAILABLE DATA VISUALIZATIONS ({len(tako_charts_map)} charts):
{available_tako_charts_str}

            WRITING GUIDELINES:
            - Write clear, informative prose that references the data from the charts
            - DO NOT include any chart markers, image syntax, or embed codes - charts will be automatically appended
            - DO NOT use markdown image syntax like ![title](url)
            - DO NOT include external links like tradingeconomics.com
            - Focus on analysis and insights from the data
            - Reference specific data points and trends from the chart descriptions above

            You should use the search tool to get resources before answering the user's question.
            Use the content and descriptions from both Tako charts and web resources to inform your report.
            To write the report, you should use the WriteReport tool. Never EVER respond with the report content, only use the tool.
            After writing the report, send a brief (1-2 sentence) follow-up asking if the user wants any changes or has questions. Do NOT summarize or repeat the report content in the chat.

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
            # Add progress indicator for report generation
            state["logs"].append({"message": "Writing research report...", "done": False})
            await copilotkit_emit_state(config, state)

            report = ai_message.tool_calls[0]["args"].get("report", "")

            # Mark report writing as done
            state["logs"][-1]["done"] = True
            await copilotkit_emit_state(config, state)

            # Clean up: Remove any markdown image links that the LLM incorrectly added
            import re
            external_domains = r'(tradingeconomics|worldbank|imf|fred|ourworldindata|statista)'
            report = re.sub(rf'!\[([^\]]+)\]\(https?://[^)]*{external_domains}[^)]*\)',
                          r'', report, flags=re.IGNORECASE)

            # Remove any markdown images
            report = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', report)

            # Remove any leftover chart markers (in case model still added them)
            report = re.sub(r'\[TAKO_CHART:[^\]]+\]', '', report)

            # Second pass: Inject charts at appropriate positions
            processed_report = report
            if tako_charts_map:
                state["logs"].append({"message": "Inserting data visualizations...", "done": False})
                await copilotkit_emit_state(config, state)
                # Build chart list for injection prompt
                chart_list = "\n".join([f"- {title}" for title in tako_charts_map.keys()])

                # Ask model to insert chart markers at appropriate positions
                inject_response = await model.ainvoke(
                    [
                        SystemMessage(content=f"""You are a report editor. Your task is to insert chart markers into the report at appropriate positions.

AVAILABLE CHARTS:
{chart_list}

RULES:
1. Insert [CHART:exact_title] markers where each chart would best support the text
2. Place markers AFTER the relevant paragraph (not in the middle of text)
3. Each chart should be used exactly once
4. Only use charts from the AVAILABLE CHARTS list above
5. Return the COMPLETE report with markers inserted
6. Do not modify the text content, only add markers
7. Add a blank line before and after each marker

Example:
The economy grew significantly in 2023...

[CHART:GDP Growth 2023]

This growth was driven by...
"""),
                        HumanMessage(content=f"Insert chart markers into this report:\n\n{report}")
                    ],
                    config
                )

                report_with_markers = inject_response.content if hasattr(inject_response, 'content') else str(inject_response)

                # Replace chart markers with actual iframe HTML
                async def replace_marker(match):
                    chart_title = match.group(1).strip()
                    chart_info = tako_charts_map.get(chart_title)

                    # Try case-insensitive match if exact match fails
                    if not chart_info:
                        for title, info in tako_charts_map.items():
                            if title.lower() == chart_title.lower():
                                chart_info = info
                                break

                    if not chart_info:
                        logger.warning(f"Chart not found: {chart_title}")
                        return ""

                    iframe_html = await get_visualization_iframe(
                        item_id=chart_info.get("card_id"),
                        embed_url=chart_info.get("embed_url")
                    )

                    if iframe_html:
                        iframe_only = re.sub(r'<script.*?</script>', '', iframe_html, flags=re.DOTALL)
                        return "\n" + iframe_only.strip() + "\n"
                    return ""

                # Find and replace all markers
                markers = list(re.finditer(r'\[CHART:([^\]]+)\]', report_with_markers))
                replacements = []
                for match in markers:
                    replacement = await replace_marker(match)
                    replacements.append((match.start(), match.end(), replacement))

                # Apply replacements in reverse order
                processed_report = report_with_markers
                for start, end, replacement in reversed(replacements):
                    processed_report = processed_report[:start] + replacement + processed_report[end:]

                logger.info(f"Injected {len([r for r in replacements if r[2]])} charts into report")

                # Mark chart injection as done
                state["logs"][-1]["done"] = True
                await copilotkit_emit_state(config, state)

            # Clear logs before showing final report
            state["logs"] = []
            await copilotkit_emit_state(config, state)

            return Command(
                goto="chat_node",
                update={
                    "report": processed_report,
                    "resources": state.get("resources", []),  # Preserve resources
                    "messages": [
                        ai_message,
                        ToolMessage(
                            tool_call_id=ai_message.tool_calls[0]["id"],
                            content="Report written successfully. Now send a brief follow-up message asking if the user wants any changes or has questions. Do NOT repeat the report content.",
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
