import requests

PERSONA_PROMPTS = {
    "Student": """You are a helpful teacher explaining to a student.
Summarize this document in very simple language.
Focus on key concepts, definitions and main ideas only.
Use short sentences. Avoid all technical jargon.
End with 3 to 5 key takeaways labeled as Key Takeaways.
Do not use any markdown symbols like # or * or bullet dashes.
Write in plain simple sentences only.""",

    "Researcher": """You are a research assistant.
Summarize this document focusing on methodology,
experimental results, technical details and findings.
Preserve all numbers, percentages and citations.
Be thorough and precise. Include limitations if mentioned.
Do not use any markdown symbols like # or * or bullet dashes.
Write in plain simple sentences only.""",

    "Executive": """You are a senior business consultant.
Summarize this document in short points only.
Focus on conclusions, key decisions, business impact
and actionable insights. Maximum 10 points.
Be direct and concise.
Do not use any markdown symbols like # or * or bullet dashes.
Write in plain simple sentences only."""
}

AVAILABLE_MODELS = {
    "fast": "phi3.5",
    "best": "qwen2.5",
    "balanced": "phi3.5"
}

def summarize(text, persona, model_preference="best"):
    prompt = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["Student"])
    model = AVAILABLE_MODELS.get(model_preference, "qwen2.5")
    full_prompt = f"{prompt}\n\nDocument:\n{text[:2000]}\n\nSummary:"

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": model,
                "prompt": full_prompt,
                "stream": False,
                "options": {
                    "num_predict": 500,
                    "temperature": 0.7,
                    "top_p": 0.9
                }
            },
            timeout=180
        )
        result = response.json()
        return result.get("response", "Could not generate summary")
    except requests.exceptions.Timeout:
        return "Request timed out. Try a shorter document."
    except Exception as e:
        return f"Error generating summary: {str(e)}"