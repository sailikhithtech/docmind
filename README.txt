# DocMind AI — Setup Instructions

## Folder Structure
Place everything inside D:\docmind\ like this:

```
D:\docmind\
├── backend\         ← All .py files go here
├── frontend\        ← All frontend files go here
├── uploads\         ← Auto created, PDFs saved here
└── outputs\         ← Auto created, results saved here
```

---

## Step 1 — Install Python Libraries & Download Ollama Application.
Open Command Prompt and run:

```
pip install fastapi uvicorn pymupdf pdfplumber spacy nltk langchain langchain-community chromadb sentence-transformers pyttsx3 python-multipart requests
```

Then:
```
python -m spacy download en_core_web_sm
```

---

## Step 2 — Install Frontend Dependencies
Open Command Prompt and run:

```
d:
cd docmind\frontend
npm install
```

---

## Step 3 — Every Time You Start the Project
```
Install qwen2.5 Model from LLM.

Open 3 Command Prompt windows:

WINDOW 1 — Start Ollama:(Preferrred LLM Model for your compatability)
```
ollama serve
```

WINDOW 2 — Start Backend:
```
d:
cd docmind\backend
uvicorn main:app --reload --port 8000
```

WINDOW 3 — Start Frontend:
```
d:
cd docmind\frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

---

## Test Backend
Open browser and go to: http://localhost:8000
You should see: {"message": "DocMind AI is running!"}

---

## Troubleshooting
- Module not found → pip install that module name
- Ollama not found → restart PC after installing Ollama
- Port in use → change 8000 to 8001 everywhere
- Blank page → run npm install in frontend folder first
- Timeout → wait 60 seconds, first run is slow
