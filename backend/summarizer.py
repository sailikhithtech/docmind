import requests

PERSONA_PROMPTS = {
    "Student": """You are a helpful teacher explaining a document to a student.
Explain the ideas in very simple language.
Focus on main concepts and definitions.
End with 3 to 5 key takeaways.""",

    "Researcher": """You are a research assistant.
Summarize focusing on technical concepts,
methods, results and conclusions.""",

    "Executive": """You are a business consultant.
Provide a short executive summary focusing
on key findings and actionable insights."""
}

AVAILABLE_MODELS = {
    "fast": "qwen2.5",
    "best": "qwen2.5",
    "balanced": "qwen2.5"
}

# ── Performance tuning ─────────────────────────────────────
# Max characters of source text to send to LLM.
# ~12,000 chars ≈ 3,000 words ≈ enough context for a good summary.
# This prevents the "10-chunk" problem for large PDFs.
MAX_TEXT_CHARS = 12000

# Chunk size for splitting when text exceeds MAX_TEXT_CHARS
# (only used as fallback – normally we do a single-shot summary)
CHUNK_SIZE = 6000


def smart_truncate(text, max_chars=MAX_TEXT_CHARS):
    """
    Intelligently truncate text keeping beginning + end
    (beginning usually has abstract/intro, end has conclusion).
    """
    if len(text) <= max_chars:
        return text

    # Take 70% from start and 30% from end
    head_size = int(max_chars * 0.7)
    tail_size = max_chars - head_size

    head = text[:head_size]
    tail = text[-tail_size:]

    return head + "\n\n[... middle sections omitted for brevity ...]\n\n" + tail


def call_llm(prompt, model, max_tokens=500):

    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": 0.5,
                "top_p": 0.9,
                "num_ctx": 4096,
            }
        },
        timeout=180
    )

    result = response.json()

    return result.get("response", "")


def summarize(text, persona, model_preference="best"):

    base_prompt = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["Student"])
    model = AVAILABLE_MODELS.get(model_preference, "qwen2.5")

    # Smart truncate: keep text within a manageable size
    trimmed = smart_truncate(text, MAX_TEXT_CHARS)

    # If text fits in one shot (≤ 12k chars), do a SINGLE LLM call
    if len(trimmed) <= MAX_TEXT_CHARS:
        prompt = f"""{base_prompt}

Document Content:
{trimmed}

Provide a clear and comprehensive summary:
"""
        return call_llm(prompt, model, max_tokens=600)

    # Fallback: for edge cases, split into at most 2 chunks
    chunks = [trimmed[i:i + CHUNK_SIZE] for i in range(0, len(trimmed), CHUNK_SIZE)]
    # Cap at 2 chunks max
    chunks = chunks[:2]

    section_summaries = []
    for chunk in chunks:
        prompt = f"""{base_prompt}

Document Section:
{chunk}

Section Summary:
"""
        section_summary = call_llm(prompt, model, max_tokens=400)
        section_summaries.append(section_summary)

    combined = "\n".join(section_summaries)

    final_prompt = f"""Combine the following section summaries into one final coherent summary.

Summaries:
{combined}

Final Summary:
"""

    final_summary = call_llm(final_prompt, model, max_tokens=500)

    return final_summary