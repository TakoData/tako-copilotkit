"""
This module provides a function to get a model based on the configuration.
"""

import os
from typing import Any, cast

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI


from src.lib.state import AgentState

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def get_model(state: AgentState) -> BaseChatModel:
    """
    Get a model based on the environment variable.
    """

    state_model = state.get("model", "openai")
    model = os.getenv("MODEL", state_model)

    if model == "openai":
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        return ChatOpenAI(temperature=0, model="gpt-4o-mini", api_key=OPENAI_API_KEY)
    if model == "anthropic":
        if not ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        return ChatAnthropic(
            temperature=0,
            model_name="claude-3-5-sonnet-20240620",
            timeout=None,
            stop=None,
        )
    if model == "google_genai":
        if not GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY environment variable is not set")
        return ChatGoogleGenerativeAI(
            temperature=0,
            model="gemini-1.5-pro",
            api_key=GOOGLE_API_KEY,
        )

    raise ValueError("Invalid model specified")
