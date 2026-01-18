"""Chat Node"""

from typing import List, Literal, cast

from copilotkit.langgraph import copilotkit_customize_config
from langchain.tools import tool
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command

from src.lib.download import get_resource
from src.lib.model import get_model
from src.lib.state import AgentState


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
def GenerateDataQuestions(questions: List[str]):  # pylint: disable=invalid-name,unused-argument
    """Generate 3-5 data-focused questions to search Tako's knowledge base for relevant charts and visualizations."""


async def chat_node(
    state: AgentState, config: RunnableConfig
) -> Command[Literal["search_node", "chat_node", "delete_node", "__end__"]]:
    """
    Chat Node
    """

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

    for resource in state["resources"]:
        content = get_resource(resource["url"])
        if content == "ERROR":
            continue
        resources.append({**resource, "content": content})

    model = get_model(state)
    # Prepare the kwargs for the ainvoke method
    ainvoke_kwargs = {}
    if model.__class__.__name__ in ["ChatOpenAI"]:
        ainvoke_kwargs["parallel_tool_calls"] = False

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

            RESEARCH WORKFLOW:
            1. FIRST: When you receive a user's query, use WriteResearchQuestion to extract/formulate the core research question
            2. THEN: Use GenerateDataQuestions to create 3-5 data-focused questions for Tako's knowledge base
            3. These questions will search Tako for relevant charts and visualizations
            4. Use the Search tool for web resources
            5. Combine insights from both Tako charts and web resources in your report

            IMPORTANT ABOUT RESEARCH QUESTION:
            - Always start by using WriteResearchQuestion to capture the user's research intent
            - This creates a clear, focused question from their natural language query
            - If a research question is already provided, YOU MUST NOT ASK FOR IT AGAIN

            CRITICAL - EMBEDDING TAKO CHARTS IN REPORT:
            When writing your report with the WriteReport tool, you MUST embed Tako chart visualizations directly.
            For each Tako chart resource (resource_type='tako_chart'), include its iframe_html in the report where relevant.

            Format example:
            ## Economic Growth Analysis

            China's economy has shown significant growth over the past decade...

            {{resource['iframe_html']}}

            The data visualization above shows...

            Rules for embedding charts:
            - Place the raw iframe_html HTML directly in the markdown (it will be rendered)
            - Position charts strategically where they support your narrative
            - Reference the chart in text before or after embedding it
            - Each Tako resource has an 'iframe_html' field containing the full <iframe> tag and resizing script
            - Include 2-3 charts if available to make the report more engaging

            You should use the search tool to get resources before answering the user's question.
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

    ai_message = cast(AIMessage, response)

    if ai_message.tool_calls:
        if ai_message.tool_calls[0]["name"] == "WriteReport":
            report = ai_message.tool_calls[0]["args"].get("report", "")
            return Command(
                goto="chat_node",
                update={
                    "report": report,
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
            return Command(
                goto="chat_node",
                update={
                    "research_question": ai_message.tool_calls[0]["args"][
                        "research_question"
                    ],
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

    return Command(goto=goto, update={"messages": response})
