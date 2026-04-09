import requests

PERSONA_PROMPTS = {
    "Student": "You are a teacher. Summarize the document simply. List 3-5 key takeaways at the end.",
    "Researcher": "You are a research assistant. Summarize the technical concepts, methods, results, and conclusions concisely.",
    "Executive": "You are a business consultant. Give a short executive summary with key findings and actionable insights."
}

AVAILABLE_MODELS = {
    "fast": "qwen2.5",
    "best": "qwen2.5",
    "balanced": "qwen2.5"
}

# ── Performance tuning ─────────────────────────────────────
# Reduced from 12,000 → 6,000 chars for faster LLM inference.
# ~6,000 chars ≈ 1,500 words, sufficient for a strong summary.
MAX_TEXT_CHARS = 6000

# Chunk size for fallback splitting (rarely triggered)
CHUNK_SIZE = 3000


def smart_truncate(text, max_chars=MAX_TEXT_CHARS):
    """
    Truncate text keeping beginning + end.
    Beginning usually has abstract/intro; end has conclusion.
    """
    if len(text) <= max_chars:
        return text

    head_size = int(max_chars * 0.7)
    tail_size = max_chars - head_size

    head = text[:head_size]
    tail = text[-tail_size:]

    return head + "\n\n[... middle omitted ...]\n\n" + tail


def call_llm(prompt, model, max_tokens=300):
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": 0.3,       # lower = more deterministic & faster
                "top_p": 0.8,
                "num_ctx": 2048,          # reduced from 4096 → 2048 for speed
                "top_k": 20,              # limits token candidates = faster sampling
            }
        },
        timeout=120                       # reduced timeout from 180s → 120s
    )

    result = response.json()
    return result.get("response", "")


def summarize(text, persona, model_preference="best"):

    base_prompt = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["Student"])
    model = AVAILABLE_MODELS.get(model_preference, "qwen2.5")

    # Truncate to max allowed size
    trimmed = smart_truncate(text, MAX_TEXT_CHARS)

    # Single-shot summary (most common path)
    if len(trimmed) <= MAX_TEXT_CHARS:
        prompt = f"""{base_prompt}

Document:
{trimmed}

Summary:"""
        return call_llm(prompt, model, max_tokens=300)

    # Fallback: split into at most 2 chunks
    chunks = [trimmed[i:i + CHUNK_SIZE] for i in range(0, len(trimmed), CHUNK_SIZE)]
    chunks = chunks[:2]

    section_summaries = []
    for chunk in chunks:
        prompt = f"""{base_prompt}

Section:
{chunk}

Brief summary:"""
        section_summary = call_llm(prompt, model, max_tokens=200)
        section_summaries.append(section_summary)

    combined = "\n".join(section_summaries)

    final_prompt = f"""Merge these summaries into one concise summary:

{combined}

Final Summary:"""

    return call_llm(final_prompt, model, max_tokens=250)