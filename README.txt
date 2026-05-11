# DocMind AI
### Intelligent Multi-Document Analysis & Summarization System with Offline AI Support

DocMind AI is an AI-powered document intelligence platform that allows users to upload PDF documents, generate intelligent summaries, interact using AI-powered chat, and convert summaries into audio outputs using offline AI technologies.

The project combines:
- Natural Language Processing (NLP)
- Retrieval-Augmented Generation (RAG)
- Semantic Search
- Local Large Language Models (LLMs)
- Offline Text-to-Speech (TTS)

into a single integrated platform.

---

#  Features

✅ Multi-document PDF upload  
✅ AI-generated summarization  
✅ RAG-based conversational chat  
✅ Semantic document retrieval  
✅ Offline AI support using Ollama  
✅ Offline audio generation  
✅ User authentication  
✅ Chat history management  
✅ Vector database integration  
✅ Responsive React frontend  

---

#  Tech Stack

## Frontend
- React.js
- Tailwind CSS
- Vite

## Backend
- FastAPI
- Python

## AI & NLP
- LangChain
- Sentence Transformers
- Qwen LLM
- Ollama
- FAISS / ChromaDB

## Audio
- pyttsx3 (Offline TTS)

---

#  Project Structure

Place everything inside:

```bash
D:\docmind\

D:\docmind\
├── backend\         # FastAPI backend files
├── frontend\        # React frontend files
├── uploads\         # Uploaded PDF files
├── outputs\         # Generated outputs
└── README.md

# System Requirements

Before running the project, install:

Required Software
Python 3.10+
Node.js 18+
Git
Ollama
  Installation Guide
Step 1 — Clone the Repository
git clone <YOUR_GITHUB_REPOSITORY_LINK>

Example:

git clone https://github.com/username/docmind-ai.git

Then:

cd docmind-ai
Step 2 — Install Python Dependencies

Open Command Prompt:

pip install fastapi uvicorn pymupdf pdfplumber spacy nltk langchain langchain-community chromadb sentence-transformers pyttsx3 python-multipart requests

Then download the SpaCy language model:

python -m spacy download en_core_web_sm
Step 3 — Install Frontend Dependencies
cd frontend
npm install
Step 4 — Install Ollama

Download and install Ollama:

 -> https://ollama.com/download

After installation, restart your PC.

Step 5 — Download Qwen Model

Open Command Prompt:

ollama pull qwen2.5

This downloads the local Large Language Model used in the project.

 # Running the Project

You must open 3 separate Command Prompt windows.

WINDOW 1 — Start Ollama
ollama serve

If you get:

Error: bind: Only one usage of each socket address...

it means Ollama is already running.

WINDOW 2 — Start Backend
d:
cd docmind\backend
uvicorn main:app --reload --port 8000

Backend URL:

http://localhost:8000

Test backend:

Open browser:

http://localhost:8000

Expected output:

{"message":"DocMind AI is running!"}
WINDOW 3 — Start Frontend
d:
cd docmind\frontend
npm run dev

Frontend URL:

http://localhost:5173

## Troubleshooting
- Module not found → pip install that module name
- Ollama not found → restart PC after installing Ollama
- Port in use → change 8000 to 8001 everywhere
- Blank page → run npm install in frontend folder first
- Timeout → wait 60 seconds, first run is slow
