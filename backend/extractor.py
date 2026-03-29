import fitz  # PyMuPDF

def extract_text(path):
    """
    Opens the PDF and extracts all text
    from every page
    """

    doc = fitz.open(path)

    pages = []

    for page in doc:
        pages.append(page.get_text("text"))

    doc.close()

    return "\n".join(pages)