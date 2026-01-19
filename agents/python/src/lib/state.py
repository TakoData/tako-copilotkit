"""
This is the state definition for the AI.
It defines the state of the agent and the state of the conversation.
"""

from typing import List, Literal, NotRequired, TypedDict
from langgraph.graph import MessagesState

class Resource(TypedDict):
    """
    Represents a resource. Give it a good title and a short description.
    Can be either a web resource or a Tako chart.
    """
    url: str
    title: str
    description: str
    resource_type: NotRequired[Literal["web", "tako_chart"]]
    pub_id: NotRequired[str]  # Tako card_id (kept as pub_id for compatibility)
    iframe_html: NotRequired[str]
    source: NotRequired[str]

class DataQuestion(TypedDict):
    """
    Represents a structured data question with search configuration.
    """
    question: str
    search_effort: Literal["fast", "deep"]
    query_type: Literal["basic", "complex", "prediction_market"]

class Log(TypedDict):
    """
    Represents a log of an action performed by the agent.
    """
    message: str
    done: bool

class AgentState(MessagesState):
    """
    This is the state of the agent.
    It is a subclass of the MessagesState class from langgraph.
    """
    model: str
    research_question: str
    report: str
    resources: List[Resource]
    logs: List[Log]
    data_questions: NotRequired[List[DataQuestion]]
