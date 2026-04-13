import pyttsx3
import os

OUTPUT_DIR = "outputs"

def convert_to_audio(text, filename, language="English"):

    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)

        clean_name = filename.replace(".pdf", "").replace(" ", "_")

        audio_file = f"{clean_name}_{language}_audio.mp3"

        audio_path = os.path.join(OUTPUT_DIR, audio_file)

        engine = pyttsx3.init()

        voices = engine.getProperty("voices")

        # select english voice
        selected_voice = voices[0].id

        engine.setProperty("voice", selected_voice)

        engine.setProperty("rate", 150)

        print("Generating audio...")

        engine.save_to_file(text, audio_path)

        engine.runAndWait()

        print("Audio generated:", audio_path)

        return audio_path

    except Exception as e:
        print("Audio generation error:", e)
        return None