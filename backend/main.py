from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
import os
import json
from datetime import datetime
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pydantic import BaseModel
from sqlalchemy.orm import Session

from extractor import extract_text
from summarizer import summarize, AVAILABLE_MODELS, smart_truncate
from rag import build_index, chat_with_docs
from hallucination import check_hallucination
from tts import convert_to_audio
from translator import translate_text

from database import get_db, User, AudioHistory, SummaryHistory
from auth import verify_password, get_password_hash, create_access_token, get_current_user, timedelta, ACCESS_TOKEN_EXPIRE_MINUTES

# ── Project paths ──────────────────────────────────────────
PROJECT_PATH = "C:/Users/SAILIKHITH/OneDrive/Desktop/docmind"
UPLOADS_PATH = f"{PROJECT_PATH}/uploads"
OUTPUTS_PATH = f"{PROJECT_PATH}/outputs"

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

# Auth schemas
class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

@app.post("/auth/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = get_password_hash(user.password)
    new_user = User(name=user.name, email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully"}

@app.post("/auth/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": db_user.email}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer", "user": {"name": db_user.name, "email": db_user.email}}

@app.get("/auth/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "name": current_user.name, "id": current_user.id}


@app.get("/")
def home():
    return {
        "message": "DocMind AI is running!",
        "version": "1.0.0",
        "status": "healthy"
    }

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    user_folder = f"{UPLOADS_PATH}/{current_user.id}"
    os.makedirs(user_folder, exist_ok=True)
    save_path = f"{user_folder}/{file.filename}"
    
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    text = extract_text(save_path)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text. File may be scanned or image-based.")

    text_cache[f"{current_user.id}_{file.filename}"] = text
    chunk_count = build_index(text, file.filename, current_user.id)

    return {
        "filename": file.filename,
        "status": "success",
        "message": "File uploaded and indexed successfully",
        "word_count": len(text.split()),
        "characters": len(text),
        "chunks_indexed": chunk_count
    }


@app.post("/upload-multiple")
async def upload_multiple_pdfs(files: List[UploadFile] = File(...), current_user: User = Depends(get_current_user)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    raw_files = [] 
    pre_errors = []
    for file in files:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            pre_errors.append({"filename": file.filename or "unknown", "error": "Not a PDF file"})
            continue
        data = await file.read()
        raw_files.append((file.filename, data))

    if not raw_files and pre_errors:
        raise HTTPException(status_code=400, detail=f"All files rejected: {pre_errors}")

    user_folder = f"{UPLOADS_PATH}/{current_user.id}"
    os.makedirs(user_folder, exist_ok=True)

    def save_and_extract(fname, data):
        save_path = f"{user_folder}/{fname}"
        with open(save_path, "wb") as fp:
            fp.write(data)
        text = extract_text(save_path)
        return fname, text

    results = []
    errors = list(pre_errors)

    with ThreadPoolExecutor(max_workers=min(4, len(raw_files))) as pool:
        future_map = {pool.submit(save_and_extract, fname, data): fname for fname, data in raw_files}
        extracted = {}
        for future in as_completed(future_map):
            fname = future_map[future]
            try:
                fname, text = future.result()
                if not text.strip():
                    errors.append({"filename": fname, "error": "Could not extract text. File may be scanned or image-based."})
                else:
                    extracted[fname] = text
            except Exception as exc:
                errors.append({"filename": fname, "error": str(exc)})

    for fname, text in extracted.items():
        text_cache[f"{current_user.id}_{fname}"] = text
        chunk_count = build_index(text, fname, current_user.id)
        results.append({
            "filename": fname,
            "status": "success",
            "word_count": len(text.split()),
            "characters": len(text),
            "chunks_indexed": chunk_count
        })

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
    model: str = "best",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_folder = f"{UPLOADS_PATH}/{current_user.id}"
    user_out_folder = f"{OUTPUTS_PATH}/{current_user.id}"
    os.makedirs(user_out_folder, exist_ok=True)
    file_path = f"{user_folder}/{filename}"

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found. Please upload the PDF first.")

    if persona not in ["Student", "Researcher", "Executive"]:
        raise HTTPException(status_code=400, detail="Invalid persona.")

    cache_key = f"{current_user.id}_{filename}"
    if cache_key in text_cache:
        text = text_cache[cache_key]
    else:
        text = extract_text(file_path)
        text_cache[cache_key] = text

    summary = summarize(text, persona, model)
    summary = summary.replace('#', '').replace('*', '').replace('`', '').strip()

    hallucination_result = check_hallucination(summary, text)

    clean_name = filename.replace(".pdf", "").replace(" ", "_")
    audio_url = f"http://localhost:8000/outputs/{current_user.id}/{clean_name}_summary_English_audio.mp3"
    audio_filename_in_tts = f"{current_user.id}/{clean_name}_summary_English_audio.mp3"

    def bg_tts():
        try:
            audio_path = convert_to_audio(summary, f"{current_user.id}/{clean_name}", "English", audio_type="summary")
            if audio_path and os.path.exists(audio_path):
                from database import SessionLocal
                with SessionLocal() as bg_db:
                    hist = AudioHistory(user_id=current_user.id, filename=filename, language="English", audio_url=audio_url, date=datetime.now().strftime("%d-%m-%Y %I:%M %p"))
                    bg_db.add(hist)
                    bg_db.commit()
        except Exception as e:
            print(f"Background TTS error: {e}")

    threading.Thread(target=bg_tts, daemon=True).start()

    result = {
        "filename": filename,
        "persona": persona,
        "model_used": AVAILABLE_MODELS.get(model, "qwen2.5"),
        "summary": summary,
        "hallucination": hallucination_result,
        "audio_url": None  # Intentionally None so UI polls audio-status instead of rendering a broken player
    }

    json_path = f"{user_out_folder}/{filename.replace('.pdf', '')}_result.json"
    with open(json_path, "w") as f:
        json.dump(result, f, indent=2)

    hist = SummaryHistory(user_id=current_user.id, filename=filename, persona=persona, model_used=result["model_used"], summary=summary, hallucination=json.dumps(hallucination_result), audio_url=audio_url, date=datetime.now().strftime("%d-%m-%Y %I:%M %p"))
    db.add(hist)
    db.commit()

    return result


@app.post("/summarize-combined")
async def summarize_combined(
    filenames: str,
    persona: str,
    model: str = "best",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if persona not in ["Student", "Researcher", "Executive"]:
        raise HTTPException(status_code=400, detail="Invalid persona.")

    name_list = [n.strip() for n in filenames.split(",") if n.strip()]
    if not name_list:
        raise HTTPException(status_code=400, detail="No filenames provided.")

    user_folder = f"{UPLOADS_PATH}/{current_user.id}"
    user_out_folder = f"{OUTPUTS_PATH}/{current_user.id}"
    os.makedirs(user_out_folder, exist_ok=True)

    cached = {}
    need_extract = []
    for fname in name_list:
        cache_key = f"{current_user.id}_{fname}"
        if cache_key in text_cache:
            cached[fname] = text_cache[cache_key]
        else:
            file_path = f"{user_folder}/{fname}"
            if os.path.exists(file_path):
                need_extract.append((fname, file_path))
            else:
                pass 

    if need_extract:
        def _extract(fname, path):
            return fname, extract_text(path)

        with ThreadPoolExecutor(max_workers=min(4, len(need_extract))) as pool:
            futures = {pool.submit(_extract, fn, fp): fn for fn, fp in need_extract}
            for future in as_completed(futures):
                fname = futures[future]
                try:
                    fname, text = future.result()
                    if text.strip():
                        text_cache[f"{current_user.id}_{fname}"] = text
                        cached[fname] = text
                except Exception:
                    pass

    doc_texts = [(fn, cached[fn]) for fn in name_list if fn in cached]
    missing = [fn for fn in name_list if fn not in cached]

    if not doc_texts:
        raise HTTPException(status_code=404, detail=f"Could not extract text from any file. Missing: {missing}")

    # Allow up to 12000 chars total for combined, divide equally across documents
    max_per_doc = 12000 // max(len(doc_texts), 1)

    separator = "\n\n" + ("─" * 60) + "\n\n"
    merged_parts = []
    for fname, txt in doc_texts:
        label = f"[Document: {fname}]\n"
        truncated_txt = smart_truncate(txt, max_chars=max_per_doc)
        merged_parts.append(label + truncated_txt)
    combined_text = separator.join(merged_parts)

    combined_label = "_AND_".join(n.replace(".pdf", "").replace(" ", "_") for n in name_list)[:80]
    
    summary = summarize(combined_text, persona, model, is_combined=True, doc_count=len(doc_texts))
    summary = summary.replace('#', '').replace('*', '').replace('`', '').strip()
    hallucination_result = check_hallucination(summary, combined_text)

    clean_name = combined_label
    audio_url = f"http://localhost:8000/outputs/{current_user.id}/{clean_name}_summary_English_audio.mp3"

    def bg_tts():
        try:
            audio_path = convert_to_audio(summary, f"{current_user.id}/{clean_name}", "English", audio_type="summary")
            if audio_path and os.path.exists(audio_path):
                from database import SessionLocal
                with SessionLocal() as bg_db:
                    hist = AudioHistory(user_id=current_user.id, filename=combined_label, language="English", audio_url=audio_url, date=datetime.now().strftime("%d-%m-%Y %I:%M %p"))
                    bg_db.add(hist)
                    bg_db.commit()
        except Exception as e:
            print(f"Background TTS error (combined): {e}")

    threading.Thread(target=bg_tts, daemon=True).start()

    result = {
        "filename": combined_label,
        "filenames": name_list,
        "persona": persona,
        "model_used": AVAILABLE_MODELS.get(model, "qwen2.5"),
        "summary": summary,
        "hallucination": hallucination_result,
        "audio_url": None,  # Intentionally None so UI polls audio-status
        "combined": True,
        "doc_count": len(doc_texts),
        "missing_files": missing
    }

    json_path = f"{user_out_folder}/{combined_label}_combined_result.json"
    with open(json_path, "w") as f:
        json.dump(result, f, indent=2)

    hist = SummaryHistory(user_id=current_user.id, filename=f"{combined_label} ({len(doc_texts)} docs)", persona=persona, model_used=result["model_used"], summary=summary, hallucination=json.dumps(hallucination_result), audio_url=audio_url, date=datetime.now().strftime("%d-%m-%Y %I:%M %p"))
    db.add(hist)
    db.commit()

    return result


class ChatMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    question: str
    history: List[ChatMessage] = []

@app.post("/chat")
async def chat(req: ChatRequest, current_user: User = Depends(get_current_user)):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    # Pass history exactly as a list of dicts to match rag.py expectations
    history_dicts = [{"role": msg.role, "text": msg.text} for msg in req.history]
    result = chat_with_docs(req.question, current_user.id, history_dicts)
    return result


@app.post("/listen")
async def listen_document(filename: str, language: str = "English", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_folder = f"{UPLOADS_PATH}/{current_user.id}"
    user_out_folder = f"{OUTPUTS_PATH}/{current_user.id}"
    os.makedirs(user_out_folder, exist_ok=True)
    file_path = f"{user_folder}/{filename}"

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    cache_key = f"{current_user.id}_{filename}"
    if cache_key in text_cache:
        text = text_cache[cache_key]
    else:
        text = extract_text(file_path)
        text_cache[cache_key] = text

    audio_text = text
    if language != "English":
        audio_text = translate_text(text[:2500], language)

    clean_name = filename.replace(".pdf", "").replace(" ", "_")
    audio_path = convert_to_audio(audio_text, f"{current_user.id}/{clean_name}", language)

    if not audio_path:
        raise HTTPException(status_code=500, detail="Audio generation failed")

    audio_url = f"http://localhost:8000/outputs/{current_user.id}/{clean_name}_{language}_audio.mp3"

    hist = AudioHistory(user_id=current_user.id, filename=filename, language=language, audio_url=audio_url, date=datetime.now().strftime("%d-%m-%Y %I:%M %p"))
    db.add(hist)
    db.commit()

    return {
        "filename": filename,
        "language": language,
        "audio_url": audio_url,
        "status": "success"
    }


@app.get("/audio-status")
async def get_audio_status(
    filename: str, 
    audio_type: str = "summary", 
    language: str = "English",
    current_user: User = Depends(get_current_user)
):
    clean_name = filename.replace(".pdf", "").replace(" ", "_")
    if audio_type == "summary":
        audio_filename = f"{clean_name}_summary_{language}_audio.mp3"
    else:
        audio_filename = f"{clean_name}_{language}_audio.mp3"
        
    audio_path = f"{OUTPUTS_PATH}/{current_user.id}/{audio_filename}"
    
    if os.path.exists(audio_path):
        audio_url = f"http://localhost:8000/outputs/{current_user.id}/{audio_filename}"
        return {"ready": True, "audio_url": audio_url}
        
    return {"ready": False}


@app.get("/audio-history")
async def get_audio_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    histories = db.query(AudioHistory).filter(AudioHistory.user_id == current_user.id).order_by(AudioHistory.id.desc()).all()
    return {"history": [{"id": h.id, "filename": h.filename.replace(".pdf", ""), "language": h.language, "date": h.date, "audio_url": h.audio_url} for h in histories]}


@app.delete("/audio-history/{audio_id}")
async def delete_audio_record(audio_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(AudioHistory).filter(AudioHistory.id == audio_id, AudioHistory.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="No history found")
    db.delete(record)
    db.commit()
    return {"status": "deleted", "id": audio_id}


@app.get("/summary-history")
async def get_summary_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    histories = db.query(SummaryHistory).filter(SummaryHistory.user_id == current_user.id).order_by(SummaryHistory.id.desc()).all()
    return {"history": [{"id": h.id, "filename": h.filename, "persona": h.persona, "model_used": h.model_used, "summary": h.summary, "hallucination": json.loads(h.hallucination), "audio_url": h.audio_url, "date": h.date} for h in histories]}


@app.delete("/summary-history/{record_id}")
async def delete_summary_record(record_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(SummaryHistory).filter(SummaryHistory.id == record_id, SummaryHistory.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="No history found")
    db.delete(record)
    db.commit()
    return {"status": "deleted", "id": record_id}


@app.get("/audio-status")
def audio_status(filename: str, audio_type: str = "summary", language: str = "English", current_user: User = Depends(get_current_user)):
    clean_name = filename.replace(".pdf", "").replace(" ", "_")
    if audio_type == "summary":
        file_path = f"{OUTPUTS_PATH}/{current_user.id}/{clean_name}_summary_{language}_audio.mp3"
        audio_url = f"http://localhost:8000/outputs/{current_user.id}/{clean_name}_summary_{language}_audio.mp3"
    else:
        file_path = f"{OUTPUTS_PATH}/{current_user.id}/{clean_name}_{language}_audio.mp3"
        audio_url = f"http://localhost:8000/outputs/{current_user.id}/{clean_name}_{language}_audio.mp3"

    if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
        return {"ready": True, "audio_url": audio_url}
    return {"ready": False}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/documents")
def list_documents(current_user: User = Depends(get_current_user)):
    user_folder = f"{UPLOADS_PATH}/{current_user.id}"
    if not os.path.exists(user_folder):
        return {"documents": []}
    files = os.listdir(user_folder)
    return {"documents": files}
