"""
Shared LLM client — Claude primary, Ollama fallback.

Model routing:
  claude-haiku-4-5-20251001  → llama3:latest   (Agent 2: fast batch scoring)
  claude-sonnet-4-6           → llama3:latest   (Agents 3, 4, 5: reasoning/generation)
  claude-sonnet-4-6 [tailor] → deepseek-r1:8b  (Agent 7: LaTeX precision)

Usage:
    from agents.llm_client import call_llm

    text = call_llm(prompt, model="claude-sonnet-4-6", max_tokens=2000)
    text = call_llm(prompt, model="claude-sonnet-4-6", max_tokens=4000, agent_name="cv_tailor")
"""

import os
import re
import requests
import anthropic
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

# Claude model → Ollama fallback model
OLLAMA_MODEL_MAP = {
    "claude-haiku-4-5-20251001": "llama3:latest",
    "claude-sonnet-4-6": "llama3:latest",
}

# Agent-specific overrides (take priority over OLLAMA_MODEL_MAP)
AGENT_MODEL_OVERRIDES = {
    "cv_tailor": "deepseek-r1:8b",
}


def _strip_think_tags(text: str) -> str:
    """Remove <think>...</think> blocks from deepseek-r1 responses."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _strip_fences(text: str) -> str:
    """Strip markdown code fences (```json ... ``` or ``` ... ```) from any LLM response."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


def _call_ollama(model: str, prompt: str, max_tokens: int) -> str:
    """Call Ollama REST API and return response text."""
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "num_predict": max_tokens,
            "temperature": 0.1,
        },
    }
    resp = requests.post(url, json=payload, timeout=180)
    resp.raise_for_status()
    text = resp.json()["response"]

    # deepseek-r1 wraps reasoning in <think> blocks — strip them
    if "deepseek" in model:
        text = _strip_think_tags(text)

    return text.strip()


def call_llm(prompt: str, model: str, max_tokens: int, agent_name: str = None) -> str:
    """
    Call Claude with automatic Ollama fallback on rate limit / API errors.

    Args:
        prompt:      The user prompt text.
        model:       Claude model ID (claude-haiku-4-5-20251001 or claude-sonnet-4-6).
        max_tokens:  Max tokens to generate.
        agent_name:  Optional agent name for model overrides (e.g. 'cv_tailor').

    Returns:
        Response text string (stripped).

    Raises:
        RuntimeError: If both Claude and Ollama fail.
    """
    # --- Try Claude first ---
    claude_error = None
    try:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("[LLM] ANTHROPIC_API_KEY not set in environment")
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return _strip_fences(response.content[0].text)

    except anthropic.RateLimitError as e:
        claude_error = f"rate_limit: {e}"
        print(f"[LLM] Claude rate limit hit — falling back to Ollama. ({e})")
    except anthropic.APIStatusError as e:
        claude_error = f"api_status_{e.status_code}: {e.message}"
        print(f"[LLM] Claude API error {e.status_code} — falling back to Ollama. ({e.message})")
    except anthropic.APIConnectionError as e:
        claude_error = f"connection_error: {e}"
        print(f"[LLM] Claude connection error — falling back to Ollama. ({e})")
    except RuntimeError as e:
        raise  # propagate missing key immediately — no Ollama fallback makes sense

    # --- Ollama fallback ---
    if agent_name and agent_name in AGENT_MODEL_OVERRIDES:
        ollama_model = AGENT_MODEL_OVERRIDES[agent_name]
    else:
        ollama_model = OLLAMA_MODEL_MAP.get(model, "llama3:latest")

    print(f"[LLM] Ollama fallback → {ollama_model}")

    try:
        return _strip_fences(_call_ollama(ollama_model, prompt, max_tokens))
    except Exception as e:
        raise RuntimeError(f"[LLM] Both Claude and Ollama failed. Claude error: {claude_error}. Ollama error: {e}") from e
