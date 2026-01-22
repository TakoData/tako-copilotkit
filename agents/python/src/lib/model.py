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


def get_model(state: AgentState) -> BaseChatModel:
    """
    Get a model based on the environment variable.
    """

    state_model = state.get("model", "openai")
    model = os.getenv("MODEL", state_model)

    print(f"Using model: {model}")

    if model == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        print(f"DEBUG: OPENAI_API_KEY from environment: {api_key[:10] if api_key else 'NOT SET'}...")
        print(f"DEBUG: All env vars starting with OPENAI: {[k for k in os.environ.keys() if 'OPENAI' in k]}")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        return ChatOpenAI(temperature=0, model="gpt-4o-mini", api_key=api_key)
    if model == "anthropic":

        return ChatAnthropic(
            temperature=0,
            model_name="claude-3-5-sonnet-20240620",
            timeout=None,
            stop=None,
        )
    if model == "google_genai":

        return ChatGoogleGenerativeAI(
            temperature=0,
            model="gemini-1.5-pro",
            api_key=cast(Any, os.getenv("GOOGLE_API_KEY")) or None,
        )

    raise ValueError("Invalid model specified")
