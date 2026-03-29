from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
import os
import json
from datetime import datetime

from extractor import extract_text
from summarizer import summarize, AVAILABLE_MODELS
from rag import build_index, chat_with_doc
from hallucination import check_hallucination
from tts import convert_to_audio

# ── Project paths ──────────────────────────────────────────
PROJECT_PATH = "C:/Users/SAILIKHITH/OneDrive/Desktop/docmind"
UPLOADS_PATH = f"{PROJECT_PATH}/uploads"
OUTPUTS_PATH = f"{PROJECT_PATH}/outputs"
HISTORY_FILE = f"{OUTPUTS_PATH}/audio_history.json"

os.makedirs(UPLOADS_PATH, exist_ok=True)
os.makedirs(OUTPUTS_PATH, exist_ok=True)

app = FastAPI(title="DocMind AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.mount(
    "/outputs",
    StaticFiles(directory=OUTPUTS_PATH),
    name="outputs"
)


# ── Helper: Save audio to history ─────────────────────────
def save_audio_history(filename, language, audio_url):
    try:
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, "r") as f:
                history = json.load(f)
        else:
            history = []

        entry = {
            "id": len(history) + 1,
            "filename": filename.replace(".pdf", ""),
            "language": language,
            "date": datetime.now().strftime("%d-%m-%Y %I:%M %p"),
            "audio_url": audio_url
        }
        history.insert(0, entry)

        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2)

        return entry
    except Exception as e:
        print(f"History save error: {str(e)}")
        return None


# ── Routes ─────────────────────────────────────────────────
@app.get("/")
def home():
    return {
        "message": "DocMind AI is running!",
        "version": "1.0.0",
        "status": "healthy"
    }


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )

    save_path = f"{UPLOADS_PATH}/{file.filename}"
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    text = extract_text(save_path)

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract text. File may be scanned or image-based."
        )

    chunk_count = build_index(text, file.filename)

    return {
        "filename": file.filename,
        "status": "success",
        "message": "File uploaded and indexed successfully",
        "word_count": len(text.split()),
        "chunks_indexed": chunk_count
    }


@app.post("/summarize")
async def summarize_document(
    filename: str,
    persona: str,
    model: str = "best"
):
    file_path = f"{UPLOADS_PATH}/{filename}"

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="File not found. Please upload the PDF first."
        )

    if persona not in ["Student", "Researcher", "Executive"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid persona. Choose Student, Researcher or Executive."
        )

    text = extract_text(file_path)
    summary = summarize(text, persona, model)

    # Clean markdown symbols
    summary = summary.replace('#', '').replace('*', '').replace('`', '').strip()

    hallucination_result = check_hallucination(summary, text)
    audio_path = convert_to_audio(summary, filename, "English")

    audio_url = None
    if audio_path and os.path.exists(audio_path):
        clean_name = filename.replace(".pdf", "").replace(" ", "_")
        audio_url = f"http://localhost:8000/outputs/{clean_name}_English_audio.mp3"
        # Save to history
        save_audio_history(filename, "English", audio_url)

    result = {
        "filename": filename,
        "persona": persona,
        "model_used": AVAILABLE_MODELS.get(model, "qwen2.5"),
        "summary": summary,
        "hallucination": hallucination_result,
        "audio_url": audio_url
    }

    json_path = f"{OUTPUTS_PATH}/{filename.replace('.pdf', '')}_result.json"
    with open(json_path, "w") as f:
        json.dump(result, f, indent=2)

    return result


@app.post("/chat")
async def chat(filename: str, question: str):
    if not question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    answer = chat_with_doc(filename, question)

    return {
        "question": question,
        "answer": answer,
        "filename": filename
    }


@app.post("/listen")
async def listen_document(filename: str, language: str = "English"):
    file_path = f"{UPLOADS_PATH}/{filename}"

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="File not found. Please upload the PDF first."
        )

    if language not in ["English", "Hindi", "Telugu"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid language. Choose English, Hindi or Telugu."
        )

    text = extract_text(file_path)

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from PDF."
        )

    audio_path = convert_to_audio(text, filename, language)

    if not audio_path:
        raise HTTPException(
            status_code=500,
            detail="Audio generation failed. Please try again."
        )

    clean_name = filename.replace(".pdf", "").replace(" ", "_")
    audio_url = f"http://localhost:8000/outputs/{clean_name}_{language}_audio.mp3"

    # Save to history
    save_audio_history(filename, language, audio_url)

    return {
        "filename": filename,
        "language": language,
        "audio_url": audio_url,
        "status": "success"
    }


@app.get("/audio-history")
async def get_audio_history():
    """
    Returns all saved audio records
    """
    try:
        if not os.path.exists(HISTORY_FILE):
            return {"history": []}

        with open(HISTORY_FILE, "r") as f:
            history = json.load(f)

        return {"history": history}
    except Exception as e:
        return {"history": [], "error": str(e)}


@app.delete("/audio-history/{audio_id}")
async def delete_audio_record(audio_id: int):
    """
    Deletes a specific audio record from history
    """
    try:
        if not os.path.exists(HISTORY_FILE):
            raise HTTPException(status_code=404, detail="No history found")

        with open(HISTORY_FILE, "r") as f:
            history = json.load(f)

        history = [h for h in history if h["id"] != audio_id]

        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2)

        return {"status": "deleted", "id": audio_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health_check():
    return {"status": "ok"}
