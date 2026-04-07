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
    "fast": "phi3.5",
    "best": "qwen2.5",
    "balanced": "phi3.5"
}


def split_text(text, chunk_size=4000):

    chunks = []

    for i in range(0, len(text), chunk_size):
        chunks.append(text[i:i + chunk_size])

    return chunks


def call_llm(prompt, model):

    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": 700,
                "temperature": 0.5,
                "top_p": 0.9
            }
        },
        timeout=180
    )

    result = response.json()

    return result.get("response", "")


def summarize(text, persona, model_preference="best"):

    base_prompt = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["Student"])

    model = AVAILABLE_MODELS.get(model_preference, "qwen2.5")

    chunks = split_text(text)

    section_summaries = []

    for chunk in chunks:

        prompt = f"""
{base_prompt}

Document Section:
{chunk}

Section Summary:
"""

        section_summary = call_llm(prompt, model)

        section_summaries.append(section_summary)

    combined = "\n".join(section_summaries)

    final_prompt = f"""
Combine the following section summaries into one final coherent summary.

Summaries:
{combined}

Final Summary:
"""

    final_summary = call_llm(final_prompt, model)

    return final_summary