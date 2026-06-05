"""
OpenToWork — LLM client (provider-agnostic, per-user)

Providers: anthropic | openai | nvidia | ollama
Usage:
    from agents.llm_client import call_llm

    text = call_llm(prompt, max_tokens=2000, user_id=1, speed="smart")
    text = call_llm(prompt, max_tokens=512,  user_id=1, speed="fast")
    text = call_llm(prompt, max_tokens=2000)          # legacy: env key + _llm_mode
"""

import os
import re
import subprocess
from pathlib import Path
import requests
from dotenv import load_dotenv
from langfuse.decorators import observe, langfuse_context

load_dotenv()

# ── Langfuse init (reads LANGFUSE_* env vars automatically) ───────────────────
_LANGFUSE_ENABLED = bool(
    os.environ.get("LANGFUSE_SECRET_KEY") and
    os.environ.get("LANGFUSE_PUBLIC_KEY")
)

# ── AgentOps init ─────────────────────────────────────────────────────────────
_AGENTOPS_ENABLED = bool(os.environ.get("AGENTOPS_API_KEY"))
if _AGENTOPS_ENABLED:
    try:
        import agentops
        agentops.init(
            api_key=os.environ["AGENTOPS_API_KEY"],
            auto_start_session=False,
            skip_auto_end_session=True,
        )
        print("[AgentOps] Initialized")
    except Exception as _ao_err:
        print(f"[AgentOps] Init failed: {_ao_err}")
        _AGENTOPS_ENABLED = False

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

DEFAULT_MODELS = {
    "anthropic": {"fast": "claude-haiku-4-5-20251001",        "smart": "claude-sonnet-4-6"},
    "openai":    {"fast": "gpt-4o-mini",                      "smart": "gpt-4o"},
    "ollama":    {"fast": "gemma2:9b",                        "smart": "gemma2:9b"},
    "nvidia":    {"fast": "deepseek-ai/deepseek-v4-flash",    "smart": "deepseek-ai/deepseek-v4-flash"},
}

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

# ── Legacy local-mode support (dashboard toggle) ───────────────────────────────
_SETTINGS_FILE = Path(__file__).parent.parent / "data" / "llm_mode.txt"

def _load_persisted_mode() -> str:
    if os.environ.get("USE_LOCAL_LLM", "").strip() in ("1", "true", "yes"):
        return "local"
    try:
        mode = _SETTINGS_FILE.read_text().strip()
        if mode in ("online", "cc", "local"):
            return mode
    except Exception:
        pass
    return "online"

_llm_mode: str = _load_persisted_mode()

def get_llm_mode() -> str:
    return _llm_mode

def set_llm_mode(mode: str) -> None:
    global _llm_mode
    if mode not in ("online", "cc", "local"):
        raise ValueError(f"Invalid LLM mode: {mode!r}")
    _llm_mode = mode
    try:
        _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        _SETTINGS_FILE.write_text(mode)
    except Exception as e:
        print(f"[LLM] Warning: could not persist mode: {e}")
    print(f"[LLM] Mode switched → {mode}")


# ── User settings loader ───────────────────────────────────────────────────────
def _load_user_settings(user_id: int) -> dict:
    try:
        import psycopg2, psycopg2.extras
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT llm_provider, llm_api_key, llm_model_fast, llm_model_smart FROM user_settings WHERE user_id = %s",
            (user_id,)
        )
        row = cur.fetchone()
        cur.close(); conn.close()
        if row:
            return dict(row)
    except Exception as e:
        print(f"[LLM] Could not load user settings for user_id={user_id}: {e}")
    return {}


# ── Helpers ────────────────────────────────────────────────────────────────────
def _strip_think_tags(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


# ── Providers ──────────────────────────────────────────────────────────────────
def _call_anthropic(prompt: str, model: str, max_tokens: int, api_key: str) -> str:
    # Use Langfuse-instrumented Anthropic client when enabled — auto-captures model/tokens/cost
    if _LANGFUSE_ENABLED:
        try:
            from langfuse.anthropic import anthropic as _lf_anthropic
            client = _lf_anthropic.Anthropic(api_key=api_key)
        except Exception:
            import anthropic as _anthropic
            client = _anthropic.Anthropic(api_key=api_key)
    else:
        import anthropic as _anthropic
        client = _anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model, max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


def _call_openai(prompt: str, model: str, max_tokens: int, api_key: str, base_url: str = None) -> str:
    try:
        # Use Langfuse-instrumented OpenAI client when enabled — auto-captures model/tokens/cost
        if _LANGFUSE_ENABLED and not base_url:
            try:
                from langfuse.openai import OpenAI as _LF_OpenAI
                client = _LF_OpenAI(api_key=api_key)
            except Exception:
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
        else:
            from openai import OpenAI
            kwargs = {"api_key": api_key}
            if base_url:
                kwargs["base_url"] = base_url
            client = OpenAI(**kwargs)
        response = client.chat.completions.create(
            model=model, max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content
    except ImportError:
        raise RuntimeError("[LLM] openai package not installed. Run: pip install openai")


def _call_nvidia(prompt: str, model: str, max_tokens: int, api_key: str, speed: str = "smart") -> str:
    try:
        from openai import OpenAI
        client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=api_key)
        # Non-Think for fast (Agent 2 scoring), Think High for smart (Agents 3/4/5)
        if speed == "fast":
            extra = {"chat_template_kwargs": {"thinking": False}}
        else:
            extra = {"chat_template_kwargs": {"thinking": True, "reasoning_effort": "high"}}
        response = client.chat.completions.create(
            model=model, max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6, top_p=0.95,
            extra_body=extra, stream=False,
        )
        return response.choices[0].message.content or ""
    except ImportError:
        raise RuntimeError("[LLM] openai package not installed. Run: pip install openai")


def _call_ollama(model: str, prompt: str, max_tokens: int) -> str:
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {"model": model, "prompt": prompt, "stream": False,
               "options": {"num_predict": max_tokens, "temperature": 0.1}}
    resp = requests.post(url, json=payload, timeout=180)
    resp.raise_for_status()
    text = resp.json()["response"]
    if "deepseek" in model:
        text = _strip_think_tags(text)
    return text.strip()


# ── Claude Code CLI (legacy cc mode, local dev only) ──────────────────────────
def _find_claude_bin() -> str:
    import shutil
    found = shutil.which("claude")
    if found:
        return found
    nvm_dir = os.path.expanduser("~/.nvm/versions/node")
    if os.path.isdir(nvm_dir):
        for version in sorted(os.listdir(nvm_dir), reverse=True):
            candidate = os.path.join(nvm_dir, version, "bin", "claude")
            if os.path.exists(candidate):
                return candidate
    for path in ["/usr/local/bin/claude", "/opt/homebrew/bin/claude"]:
        if os.path.exists(path):
            return path
    raise RuntimeError("[LLM] claude CLI not found")

def _cc_env() -> dict:
    env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
    try:
        node_bin_dir = os.path.dirname(_find_claude_bin())
        existing_path = env.get("PATH", "")
        if node_bin_dir not in existing_path:
            env["PATH"] = f"{node_bin_dir}:{existing_path}"
    except Exception:
        pass
    return env

def _call_claude_code(prompt: str, model: str = "claude-sonnet-4-6") -> str:
    claude_bin = _find_claude_bin()
    result = subprocess.run(
        [claude_bin, "-p", prompt, "--model", model],
        capture_output=True, text=True, env=_cc_env(), timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(f"[LLM] claude CLI error: {result.stderr.strip()}")
    return result.stdout.strip()

def call_claude_code_skill(skill_name: str, args: str) -> str:
    claude_bin = _find_claude_bin()
    invocation = f"/{skill_name} {args}".strip()
    print(f"[LLM] CC skill → {invocation[:80]}")
    result = subprocess.run(
        [claude_bin, "-p", invocation],
        capture_output=True, text=True, env=_cc_env(), timeout=600,
    )
    if result.returncode != 0:
        raise RuntimeError(f"[LLM] claude skill '{skill_name}' error: {result.stderr.strip()}")
    return result.stdout.strip()


def _ollama_fallback(prompt: str, max_tokens: int, reason: str) -> str:
    print(f"[LLM] Ollama fallback (gemma2:9b) — reason: {reason}")
    return _strip_fences(_call_ollama("gemma2:9b", prompt, max_tokens))


# ── Main entry point ───────────────────────────────────────────────────────────
@observe(name="call_llm", capture_input=True, capture_output=True)
def call_llm(prompt: str, max_tokens: int = 2000, user_id: int = None,
             speed: str = "smart", model: str = None) -> str:
    """
    Call LLM for a given user.

    user_id provided  → load provider + key + model from user_settings DB row
    user_id=None      → legacy path (env ANTHROPIC_API_KEY + _llm_mode toggle)
    speed             → "fast" (Agent 2) or "smart" (Agents 3,4,5)
    model             → legacy override (ignored when user_id set)
    """
    # ── Resolve provider + model ──
    if user_id is not None:
        settings = _load_user_settings(user_id)
        provider = (settings.get("llm_provider") or "anthropic").lower()
        api_key  = settings.get("llm_api_key") or ""
        model_col = "llm_model_fast" if speed == "fast" else "llm_model_smart"
        resolved_model = settings.get(model_col) or DEFAULT_MODELS.get(provider, DEFAULT_MODELS["anthropic"])[speed]
    else:
        # Legacy path — CV tailor / cover letter endpoints (no user context on local dev)
        if _llm_mode == "local":
            provider = "ollama"
        elif _llm_mode == "cc":
            provider = "cc"
        else:
            provider = "anthropic"
        api_key       = os.environ.get("ANTHROPIC_API_KEY", "")
        resolved_model = model or "claude-sonnet-4-6"

    print(f"[LLM] provider={provider} model={resolved_model} speed={speed} user={user_id}")

    # ── Langfuse trace metadata ──
    if _LANGFUSE_ENABLED:
        try:
            if user_id:
                langfuse_context.update_current_trace(user_id=str(user_id))
            # Store at TRACE level too — /api/public/traces returns trace.metadata, not observations
            langfuse_context.update_current_trace(
                metadata={"model": resolved_model, "provider": provider, "speed": speed, "max_tokens": max_tokens},
            )
            # Also tag the observation for detail view
            langfuse_context.update_current_observation(
                model=resolved_model,
                metadata={"provider": provider, "speed": speed, "max_tokens": max_tokens},
            )
        except Exception:
            pass

    # ── AgentOps session ──
    _ao_session = None
    if _AGENTOPS_ENABLED:
        try:
            import agentops as _ao
            _ao_session = _ao.start_session(tags={
                "user_id": str(user_id) if user_id else "anon",
                "provider": provider,
                "model": resolved_model,
                "speed": speed,
            })
        except Exception:
            pass

    _ao_end_state = "Fail"
    try:
        # ── Ollama ──
        if provider == "ollama":
            result = _strip_fences(_call_ollama(resolved_model, prompt, max_tokens))
            _ao_end_state = "Success"
            return result

        # ── Claude Code CLI ──
        if provider == "cc":
            try:
                result = _strip_fences(_call_claude_code(prompt, resolved_model))
                _ao_end_state = "Success"
                return result
            except Exception as e:
                return _ollama_fallback(prompt, max_tokens, str(e))

        # ── Anthropic ──
        if provider == "anthropic":
            if not api_key:
                return _ollama_fallback(prompt, max_tokens, "no API key")
            try:
                result = _strip_fences(_call_anthropic(prompt, resolved_model, max_tokens, api_key))
                _ao_end_state = "Success"
                return result
            except Exception as e:
                return _ollama_fallback(prompt, max_tokens, str(e))

        # ── OpenAI-compatible ──
        if provider == "openai":
            if not api_key:
                return _ollama_fallback(prompt, max_tokens, "no API key")
            try:
                result = _strip_fences(_call_openai(prompt, resolved_model, max_tokens, api_key))
                _ao_end_state = "Success"
                return result
            except Exception as e:
                return _ollama_fallback(prompt, max_tokens, str(e))

        # ── NVIDIA NIM (DeepSeek-V4-Flash — Non-Think for fast, Think High for smart) ──
        if provider == "nvidia":
            if not api_key:
                return _ollama_fallback(prompt, max_tokens, "no NVIDIA API key")
            try:
                result = _strip_fences(_call_nvidia(prompt, resolved_model, max_tokens, api_key, speed))
                _ao_end_state = "Success"
                return result
            except Exception as e:
                return _ollama_fallback(prompt, max_tokens, str(e))

        raise RuntimeError(f"[LLM] Unknown provider: {provider!r}")

    finally:
        if _ao_session:
            try:
                _ao_session.end_session(end_state=_ao_end_state)
            except Exception:
                pass
            try:
                import psycopg2
                _db = psycopg2.connect(os.environ["DATABASE_URL"])
                _cur = _db.cursor()
                _cur.execute(
                    "INSERT INTO agentops_sessions (session_id, user_id, provider, model, speed, end_state) VALUES (%s,%s,%s,%s,%s,%s)",
                    (str(getattr(_ao_session, "session_id", "")), user_id, provider, resolved_model, speed, _ao_end_state),
                )
                _db.commit(); _cur.close(); _db.close()
            except Exception:
                pass
