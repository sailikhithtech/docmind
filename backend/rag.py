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

# Conversation memory
conversation_history = []


def build_index(text, filename):

    global vector_store

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
        separators=["\n\n", "\n", ".", " "]
    )

    chunks = splitter.split_text(text)

    # Attach metadata to each chunk
    metadatas = [{"source": filename} for _ in chunks]

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


def chat_with_docs(question):

    global vector_store
    global conversation_history

    if vector_store is None:
        return {
            "answer": "No documents uploaded yet.",
            "sources": []
        }

    # Retrieve relevant chunks
    results = vector_store.similarity_search(question, k=8)

    context = "\n\n".join([r.page_content for r in results])
    context = context[:8000]

    # Collect sources
    sources = list(set([r.metadata.get("source", "unknown") for r in results]))

    # Build conversation history text
    history_text = ""

    for item in conversation_history[-5:]:
        history_text += f"User: {item['question']}\nAI: {item['answer']}\n"

    prompt = f"""
You are an AI assistant that answers questions using uploaded documents.

Use ONLY the document context and conversation history to answer.

If the answer cannot be found in the documents say exactly:
"I could not find this information in the documents."

Conversation History:
{history_text}

Document Context:
{context}

Question:
{question}

Answer clearly and concisely.
"""

    try:

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "qwen2.5",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 500
                }
            },
            timeout=180
        )

        result = response.json()

        answer = result.get("response", "No response received")

        # Save conversation history
        conversation_history.append({
            "question": question,
            "answer": answer
        })

        return {
            "answer": answer,
            "sources": sources
        }

    except Exception as e:
        return {
            "answer": f"Error getting answer: {str(e)}",
            "sources": []
        }