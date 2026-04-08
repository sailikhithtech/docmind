import requests


def translate_text(text, target_language):
    """
    Translate text to the target language using Ollama LLM.
    Only translates if the target is not English.
    Caps input at 2500 chars for performance.
    """
    if target_language == "English":
        return text

    # Cap text to keep translation fast
    text_to_translate = text[:2500]

    language_names = {
        "Hindi": "Hindi (हिन्दी)",
        "Telugu": "Telugu (తెలుగు)"
    }

    lang_name = language_names.get(target_language, target_language)

    prompt = f"""Translate the following text to {lang_name}. 
Rules:
1. Output ONLY the translated text, nothing else.
2. Do NOT include any explanation or notes.
3. Keep numbers and technical terms as-is if no direct translation exists.
4. Maintain the same paragraph structure.

Text to translate:
{text_to_translate}

Translation in {lang_name}:
"""

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "qwen2.5",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_predict": 1500,
                    "temperature": 0.3,
                    "num_ctx": 4096,
                }
            },
            timeout=180
        )

        result = response.json()
        translated = result.get("response", "").strip()

        if translated:
            # Clean up any markdown or extra formatting
            translated = translated.replace("```", "").strip()
            return translated
        else:
            print(f"Translation returned empty, using original text")
            return text_to_translate

    except Exception as e:
        print(f"Translation error: {str(e)}")
        return text_to_translate
