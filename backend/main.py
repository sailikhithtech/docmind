from fastapi import FastAPI, UploadFile, File, HTTPException
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
import os
import json
from datetime import datetime
import threading

from extractor import extract_text
from summarizer import summarize, AVAILABLE_MODELS
from rag import build_index, chat_with_docs
from hallucination import check_hallucination
from tts import convert_to_audio
from translator import translate_text

# ── Project paths ──────────────────────────────────────────
PROJECT_PATH = "C:/Users/SAILIKHITH/OneDrive/Desktop/docmind"
UPLOADS_PATH = f"{PROJECT_PATH}/uploads"
OUTPUTS_PATH = f"{PROJECT_PATH}/outputs"
HISTORY_FILE = f"{OUTPUTS_PATH}/audio_history.json"
SUMMARY_HISTORY_FILE = f"{OUTPUTS_PATH}/summary_history.json"

os.makedirs(UPLOADS_PATH, exist_ok=True)
os.makedirs(OUTPUTS_PATH, exist_ok=True)

# ── Text cache to avoid re-extracting PDFs ────────────────
text_cache = {}

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


# ── Helper: Save summary to history ────────────────────────
def save_summary_history(filename, persona, model_used, summary, hallucination, audio_url):
    try:
        if os.path.exists(SUMMARY_HISTORY_FILE):
            with open(SUMMARY_HISTORY_FILE, "r") as f:
                history = json.load(f)
        else:
            history = []

        entry = {
            "id": int(datetime.now().timestamp() * 1000),
            "filename": filename,
            "persona": persona,
            "model_used": model_used,
            "summary": summary,
            "hallucination": hallucination,
            "audio_url": audio_url,
            "date": datetime.now().strftime("%d-%m-%Y %I:%M %p")
        }
        history.insert(0, entry)

        with open(SUMMARY_HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2)

        return entry
    except Exception as e:
        print(f"Summary history save error: {str(e)}")
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

    # Cache the extracted text
    text_cache[file.filename] = text

    chunk_count = build_index(text, file.filename)

    return {
    "filename": file.filename,
    "status": "success",
    "message": "File uploaded and indexed successfully",
    "word_count": len(text.split()),
    "characters": len(text),
    "chunks_indexed": chunk_count
}


@app.post("/upload-multiple")
async def upload_multiple_pdfs(files: List[UploadFile] = File(...)):
    """Upload and index multiple PDF files at once"""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    results = []
    errors = []

    for file in files:
        try:
            if not file.filename or not file.filename.lower().endswith(".pdf"):
                errors.append({"filename": file.filename or "unknown", "error": "Not a PDF file"})
                continue

            save_path = f"{UPLOADS_PATH}/{file.filename}"
            with open(save_path, "wb") as f:
                shutil.copyfileobj(file.file, f)

            text = extract_text(save_path)

            if not text.strip():
                errors.append({"filename": file.filename, "error": "Could not extract text. File may be scanned or image-based."})
                continue

            # Cache extracted text
            text_cache[file.filename] = text

            chunk_count = build_index(text, file.filename)

            results.append({
                "filename": file.filename,
                "status": "success",
                "word_count": len(text.split()),
                "characters": len(text),
                "chunks_indexed": chunk_count
            })
        except Exception as e:
            errors.append({"filename": file.filename or "unknown", "error": str(e)})

    if not results and errors:
        raise HTTPException(
            status_code=400,
            detail=f"All files failed to process: {errors}"
        )

    return {
        "status": "success",
        "total_uploaded": len(results),
        "total_failed": len(errors),
        "results": results,
        "errors": errors
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

    # Use cached text if available, otherwise extract
    if filename in text_cache:
        text = text_cache[filename]
    else:
        text = extract_text(file_path)
        text_cache[filename] = text

    summary = summarize(text, persona, model)

    # Clean markdown symbols
    summary = summary.replace('#', '').replace('*', '').replace('`', '').strip()

    hallucination_result = check_hallucination(summary, text)

    # Generate TTS in background thread (don't block the response)
    clean_name = filename.replace(".pdf", "").replace(" ", "_")
    audio_url = f"http://localhost:8000/outputs/{clean_name}_summary_English_audio.mp3"

    def bg_tts():
        try:
            audio_path = convert_to_audio(summary, filename, "English", audio_type="summary")
            if audio_path and os.path.exists(audio_path):
                save_audio_history(filename, "English", audio_url)
        except Exception as e:
            print(f"Background TTS error: {e}")

    threading.Thread(target=bg_tts, daemon=True).start()

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

    # Save to summary history
    save_summary_history(filename, persona, result["model_used"], summary, hallucination_result, audio_url)

    return result


@app.post("/chat")
async def chat(question: str):

    if not question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    result = chat_with_docs(question)

    return result


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

    # Use cached text if available
    if filename in text_cache:
        text = text_cache[filename]
    else:
        text = extract_text(file_path)
        text_cache[filename] = text

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from PDF."
        )

    # Translate text if not English
    audio_text = text
    if language != "English":
        audio_text = translate_text(text[:2500], language)

    audio_path = convert_to_audio(audio_text, filename, language)

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


@app.get("/summary-history")
async def get_summary_history():
    """Returns all saved summarization records"""
    try:
        if not os.path.exists(SUMMARY_HISTORY_FILE):
            return {"history": []}
        with open(SUMMARY_HISTORY_FILE, "r") as f:
            history = json.load(f)
        return {"history": history}
    except Exception as e:
        return {"history": [], "error": str(e)}


@app.delete("/summary-history/{record_id}")
async def delete_summary_record(record_id: int):
    """Deletes a specific summary record from history"""
    try:
        if not os.path.exists(SUMMARY_HISTORY_FILE):
            raise HTTPException(status_code=404, detail="No history found")
        with open(SUMMARY_HISTORY_FILE, "r") as f:
            history = json.load(f)
        history = [h for h in history if h["id"] != record_id]
        with open(SUMMARY_HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2)
        return {"status": "deleted", "id": record_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/documents")
def list_documents():

    files = os.listdir(UPLOADS_PATH)

    return {"documents": files}
