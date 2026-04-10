import requests
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings

print("Loading embedding model...")

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

print("Embedding model ready!")

# Global vector database
vector_store = None

# Note: We now receive chat history dynamically per request


def build_index(text, filename, user_id):

    global vector_store

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", " "]
    )

    chunks = splitter.split_text(text)

    # Attach metadata to each chunk
    metadatas = [{"source": filename, "user_id": user_id} for _ in chunks]

    if vector_store is None:

        vector_store = Chroma.from_texts(
            texts=chunks,
            embedding=embeddings,
            metadatas=metadatas,
            collection_name="docmind_collection"
        )

    else:

        vector_store.add_texts(
            texts=chunks,
            metadatas=metadatas
        )

    print(f"Indexed {filename} with {len(chunks)} chunks")

    return len(chunks)


def _get_indexed_sources(user_id):
    """Return the list of unique source filenames currently in the vector store for a specific user."""
    if vector_store is None:
        return []
    try:
        # Chroma exposes the underlying collection
        col = vector_store._collection
        all_meta = col.get(include=["metadatas"])["metadatas"]
        return list({m.get("source", "unknown") for m in all_meta if m and m.get("user_id") == user_id})
    except Exception:
        return []


def chat_with_docs(question, user_id, history=[]):

    global vector_store

    if vector_store is None:
        return {
            "answer": "No documents uploaded yet.",
            "sources": []
        }

    # ── Diverse retrieval across all indexed documents ──────────────────
    # Fetch chunks from EVERY source document so no single file dominates.
    indexed_sources = _get_indexed_sources(user_id)
    CHUNKS_PER_DOC = 4   # retrieve up to N chunks per document

    seen_chunks = {}   # source -> [chunks]
    if indexed_sources:
        for src in indexed_sources:
            try:
                hits = vector_store.similarity_search(
                    question,
                    k=CHUNKS_PER_DOC,
                    filter={"$and": [{"source": src}, {"user_id": user_id}]}
                )
                seen_chunks[src] = hits
            except Exception:
                # Some Chroma versions don't support filter — fall back below
                seen_chunks = {}
                break

    # Fallback: plain similarity search without per-source filter
    if not seen_chunks:
        total_k = max(8, len(indexed_sources) * CHUNKS_PER_DOC)
        results = vector_store.similarity_search(question, k=total_k, filter={"user_id": user_id})
        for r in results:
            src = r.metadata.get("source", "unknown")
            seen_chunks.setdefault(src, []).append(r)

    # ── Build source-annotated context ───────────────────────────────────
    context_parts = []
    all_sources = []
    for src, chunks in seen_chunks.items():
        if not chunks:
            continue
        all_sources.append(src)
        header = f"[Source: {src}]"
        body = "\n".join(c.page_content for c in chunks)
        context_parts.append(f"{header}\n{body}")

    context = "\n\n---\n\n".join(context_parts)
    context = context[:12000]   # expanded from 8000 for multi-doc coverage

    sources = list(set(all_sources))

    # ── Conversation history ─────────────────────────────────────────────
    history_text = ""
    # Look back at the last few turns (max 8 messages) to establish context
    for msg in history[-8:]:
        prefix = "User" if msg.get("role") == "user" else "AI"
        history_text += f"{prefix}: {msg.get('text', '')}\n"

    # ── Multi-document-aware prompt ──────────────────────────────────────
    multi_doc_note = (
        f"You have access to {len(sources)} document(s): {', '.join(sources)}.\n"
        "When relevant, synthesise information from multiple documents and mention which document each piece of information comes from."
        if len(sources) > 1 else ""
    )

    prompt = f"""You are an AI document assistant.

Answer the user's question using ONLY the information from the document context below.
{multi_doc_note}

Rules:
1. Write clear, easy-to-read explanations.
2. Use short paragraphs or numbered points when helpful.
3. Do NOT use LaTeX symbols like \\( \\), \\text{{}}, or mathematical markup.
4. Write equations in plain text form.
5. If the answer spans multiple documents, mention each source by name.
6. Avoid unnecessary symbols or special formatting.

Conversation History:
{history_text}

Document Context:
{context}

User Question:
{question}

Answer:"""

    try:

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "qwen2.5",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 500,
                    "num_ctx": 4096,
                }
            },
            timeout=180
        )

        result = response.json()

        answer = result.get("response", "No response received")
        answer = answer.replace("\\(", "").replace("\\)", "")
        answer = answer.replace("\\text{", "").replace("}", "")

        # History is naturally handled by the frontend passing it explicitly
        
        return {
            "answer": answer,
            "sources": sources
        }

    except Exception as e:
        return {
            "answer": f"Error getting answer: {str(e)}",
            "sources": []
        }