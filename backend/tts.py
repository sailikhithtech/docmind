from gtts import gTTS
import os

LANGUAGE_CODES = {
    "English": "en",
    "Hindi": "hi",
    "Telugu": "te"
}

def convert_to_audio(text, filename, language="English"):
    """
    Converts text to audio in the selected language
    using gTTS and saves it to outputs folder
    """
    try:
        lang_code = LANGUAGE_CODES.get(language, "en")
        clean_name = filename.replace(".pdf", "").replace(" ", "_")
        output_path = f"C:/Users/SAILIKHITH/OneDrive/Desktop/docmind/outputs/{clean_name}_{language}_audio.mp3"

        tts = gTTS(text=text[:3000], lang=lang_code, slow=False)
        tts.save(output_path)

        return output_path

    except Exception as e:
        print(f"TTS Error: {str(e)}")
        return None
