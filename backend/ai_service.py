"""
ai_service.py - Pluggable AI backend so the app isn't locked to one provider.

Set AI_PROVIDER in your .env to one of: "gemini", "groq", "mock"
- "gemini": uses Google Gemini (needs GEMINI_API_KEY). Free tier ~1500 req/day.
- "groq":   fallback if you hit Gemini's rate limit (needs GROQ_API_KEY).
- "mock":   no API key needed at all - returns a canned in-character-ish
            reply so you can build/test the whole app before wiring up a
            real key. This is also the default if nothing is configured.
"""
import os
from abc import ABC, abstractmethod


class AIProvider(ABC):
    @abstractmethod
    def generate_reply(self, system_prompt: str, history: list[dict], user_message: str) -> str:
        """
        history: list of {"role": "user"|"assistant", "content": str}, oldest first.
        Returns the assistant's reply text.
        """
        raise NotImplementedError


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str, model_name: str = "gemini-flash-latest"):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self._genai = genai
        self._model_name = model_name

    def generate_reply(self, system_prompt, history, user_message):
        model = self._genai.GenerativeModel(
            self._model_name, system_instruction=system_prompt
        )
        gemini_history = [
            {"role": "user" if m["role"] == "user" else "model", "parts": [m["content"]]}
            for m in history
        ]
        chat_session = model.start_chat(history=gemini_history)
        response = chat_session.send_message(user_message)
        return response.text


class GroqProvider(AIProvider):
    def __init__(self, api_key: str, model_name: str = "llama-3.1-8b-instant"):
        from groq import Groq
        self._client = Groq(api_key=api_key)
        self._model_name = model_name

    def generate_reply(self, system_prompt, history, user_message):
        messages = [{"role": "system", "content": system_prompt}]
        for m in history:
            messages.append({"role": m["role"], "content": m["content"]})
        messages.append({"role": "user", "content": user_message})

        completion = self._client.chat.completions.create(
            model=self._model_name, messages=messages,
        )
        return completion.choices[0].message.content


class MockProvider(AIProvider):
    """No network calls at all - lets you run and click through the entire
    app locally before you've set up any API key."""

    def generate_reply(self, system_prompt, history, user_message):
        first_line = system_prompt.strip().splitlines()[0] if system_prompt.strip() else "a character"
        return (
            f"[mock reply - set AI_PROVIDER=gemini or groq in .env for real replies]\n"
            f"({first_line[:80]}...)\n"
            f'You said: "{user_message}" - and that\'s about all the "thinking" '
            f"I can do without a real API key plugged in!"
        )


_provider_instance = None


def get_ai_provider() -> AIProvider:
    """Cached provider instance, selected via the AI_PROVIDER env var."""
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    provider_name = os.getenv("AI_PROVIDER", "mock").lower()

    if provider_name == "gemini":
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("AI_PROVIDER=gemini but GEMINI_API_KEY is not set in .env")
        _provider_instance = GeminiProvider(api_key)
    elif provider_name == "groq":
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("AI_PROVIDER=groq but GROQ_API_KEY is not set in .env")
        _provider_instance = GroqProvider(api_key)
    else:
        _provider_instance = MockProvider()

    return _provider_instance
