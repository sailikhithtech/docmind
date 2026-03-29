import requests
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
import re

document_stores = {}

print("Loading embedding model...")

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

print("Embedding model ready!")


def build_index(text, filename):

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150
    )

    chunks = splitter.split_text(text)

    # Clean filename for Chroma collection
    collection_name = filename.replace(".pdf", "")
    collection_name = re.sub(r"[^a-zA-Z0-9._-]", "_", collection_name)
    collection_name = re.sub(r"^[^a-zA-Z0-9]+", "", collection_name)
    collection_name = re.sub(r"[^a-zA-Z0-9]+$", "", collection_name)
    collection_name = collection_name[:50]

    store = Chroma.from_texts(
        chunks,
        embeddings,
        collection_name=collection_name
    )

    document_stores[filename] = store

    print(f"Index built for {filename} — {len(chunks)} chunks")

    return len(chunks)


def chat_with_doc(filename, question):

    store = document_stores.get(filename)

    if not store:
        return "Document not found. Please upload the PDF first."

    results = store.similarity_search(question, k=3)

    context = "\n\n".join([r.page_content for r in results])

    prompt = f"""You are a helpful document assistant.
Try your best to find relevant information even if
the exact words do not match. Look for related concepts.
Answer the question using ONLY the document content below.
If the answer is not in the document say exactly:
I could not find this information in the document.
Do not make up any information.

Question: {question}

Document Content:
{context}

Answer:"""

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "qwen2.5",
                "prompt": prompt,
                "stream": False
            },
            timeout=180
        )

        return response.json().get("response", "No response received")

    except Exception as e:
        return f"Error getting answer: {str(e)}"