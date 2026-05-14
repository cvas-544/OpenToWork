"""
Shared LLM client — Claude primary, Ollama fallback.

Model routing:
  claude-haiku-4-5-20251001  → gemma2:9b  (Agent 2: fast batch scoring)
  claude-sonnet-4-6           → gemma2:9b  (Agents 3, 4, 5, 7, 8)

Mode (runtime-switchable via dashboard toggle):
  "online" → Claude API first, gemma2:9b fallback on error
  "cc"     → Claude Code CLI (OAuth subscription, Sonnet 4.6), gemma2:9b fallback
  "local"  → skip Claude entirely, go straight to gemma2:9b

Usage:
    from agents.llm_client import call_llm

    text = call_llm(prompt, model="claude-sonnet-4-6", max_tokens=2000)
"""

import os
import re
import subprocess
from pathlib import Path
import requests
import anthropic
from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

_SETTINGS_FILE = Path(__file__).parent.parent / "data" / "llm_mode.txt"


def _load_persisted_mode() -> str:
    """Read mode from disk; default 'cc' if file missing or invalid."""
    if os.environ.get("USE_LOCAL_LLM", "").strip() in ("1", "true", "yes"):
        return "local"
    try:
        mode = _SETTINGS_FILE.read_text().strip()
        if mode in ("online", "cc", "local"):
            return mode
    except Exception:
        pass
    return "cc"


# Runtime mode — persisted to data/llm_mode.txt; defaults to "cc"
_llm_mode: str = _load_persisted_mode()

# Claude model → Ollama fallback model
OLLAMA_MODEL_MAP = {
    "claude-haiku-4-5-20251001": "gemma2:9b",
    "claude-sonnet-4-6": "gemma2:9b",
}


def get_llm_mode() -> str:
    """Return current LLM mode: 'online' or 'local'."""
    return _llm_mode


def set_llm_mode(mode: str) -> None:
    """Set LLM mode at runtime. Called by /settings/llm-mode API endpoint."""
    global _llm_mode
    if mode not in ("online", "cc", "local"):
        raise ValueError(f"Invalid LLM mode: {mode!r}. Must be 'online', 'cc', or 'local'.")
    _llm_mode = mode
    try:
        _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _SETTINGS_FILE.write_text(mode)
    except Exception as e:
        print(f"[LLM] Warning: could not persist mode to disk: {e}")
    print(f"[LLM] Mode switched → {mode}")


def _strip_think_tags(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


def _call_claude_code(prompt: str, model: str = "claude-sonnet-4-6") -> str:
    """
    Call Claude Code CLI with a raw prompt (OAuth subscription — no API key needed).
    Strips ANTHROPIC_API_KEY from env so CLI uses OAuth, not API key auth.
    """
    claude_bin = _find_claude_bin()
    env = _cc_env()
    result = subprocess.run(
        [claude_bin, "-p", prompt, "--model", model],
        capture_output=True,
        text=True,
        env=env,
        timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(f"[LLM] claude CLI error: {result.stderr.strip()}")
    return result.stdout.strip()


def _find_claude_bin() -> str:
    """Locate the claude CLI binary — handles NVM/Homebrew installs not on uvicorn's PATH."""
    import shutil
    # 1. Already on PATH
    found = shutil.which("claude")
    if found:
        return found
    # 2. Common NVM location
    nvm_bin = os.path.expanduser("~/.nvm/versions/node/v22.18.0/bin/claude")
    if os.path.exists(nvm_bin):
        return nvm_bin
    # 3. Scan all NVM node versions
    nvm_dir = os.path.expanduser("~/.nvm/versions/node")
    if os.path.isdir(nvm_dir):
        for version in sorted(os.listdir(nvm_dir), reverse=True):
            candidate = os.path.join(nvm_dir, version, "bin", "claude")
            if os.path.exists(candidate):
                return candidate
    # 4. Common global installs
    for path in ["/usr/local/bin/claude", "/opt/homebrew/bin/claude"]:
        if os.path.exists(path):
            return path
    raise RuntimeError("[LLM] claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code")


def _cc_env() -> dict:
    """Build env for claude CLI subprocess: strip API key, inject NVM node path."""
    env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
    # Inject NVM node bin so the claude Node.js binary can find `node`
    claude_bin = _find_claude_bin()
    node_bin_dir = os.path.dirname(claude_bin)
    existing_path = env.get("PATH", "")
    if node_bin_dir not in existing_path:
        env["PATH"] = f"{node_bin_dir}:{existing_path}"
    return env


def call_claude_code_skill(skill_name: str, args: str) -> str:
    """
    Invoke a Claude Code skill via: claude -p "/{skill_name} {args}"
    Uses OAuth subscription — ANTHROPIC_API_KEY stripped so it doesn't override OAuth.
    Skill files live at ~/.claude/skills/{skill_name}/SKILL.md
    """
    claude_bin = _find_claude_bin()
    env = _cc_env()
    invocation = f"/{skill_name} {args}".strip()
    print(f"[LLM] CC skill → {invocation[:80]}")
    result = subprocess.run(
        [claude_bin, "-p", invocation],
        capture_output=True,
        text=True,
        env=env,
        timeout=600,
    )
    if result.returncode != 0:
        raise RuntimeError(f"[LLM] claude skill '{skill_name}' error: {result.stderr.strip()}")
    return result.stdout.strip()


def _call_ollama(model: str, prompt: str, max_tokens: int) -> str:
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
    if "deepseek" in model:
        text = _strip_think_tags(text)
    return text.strip()


def call_llm(prompt: str, model: str, max_tokens: int, agent_name: str = None) -> str:
    """
    Call LLM based on current mode.

    online: Claude first → gemma2:9b fallback on error
    local:  gemma2:9b directly, Claude never called
    """
    ollama_model = OLLAMA_MODEL_MAP.get(model, "gemma2:9b")

    # ── Local mode: skip Claude ──
    if _llm_mode == "local":
        print(f"[LLM] local mode → {ollama_model}")
        return _strip_fences(_call_ollama(ollama_model, prompt, max_tokens))

    # ── CC mode: Claude Code CLI (OAuth subscription) ──
    if _llm_mode == "cc":
        print(f"[LLM] cc mode → claude CLI ({model})")
        try:
            return _strip_fences(_call_claude_code(prompt, model))
        except Exception as e:
            print(f"[LLM] claude CLI failed → falling back to {ollama_model}. ({e})")
            return _strip_fences(_call_ollama(ollama_model, prompt, max_tokens))

    # ── Online mode: Claude API first ──
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
        print(f"[LLM] Claude rate limit → falling back to {ollama_model}. ({e})")
    except anthropic.APIStatusError as e:
        claude_error = f"api_status_{e.status_code}: {e.message}"
        print(f"[LLM] Claude API error {e.status_code} → falling back to {ollama_model}. ({e.message})")
    except anthropic.APIConnectionError as e:
        claude_error = f"connection_error: {e}"
        print(f"[LLM] Claude connection error → falling back to {ollama_model}. ({e})")
    except RuntimeError:
        raise

    # ── Fallback to Ollama ──
    print(f"[LLM] Ollama fallback → {ollama_model}")
    try:
        return _strip_fences(_call_ollama(ollama_model, prompt, max_tokens))
    except Exception as e:
        raise RuntimeError(
            f"[LLM] Both Claude and Ollama failed. Claude: {claude_error}. Ollama: {e}"
        ) from e
