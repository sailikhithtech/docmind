import fitz  # PyMuPDF


def extract_text(path):
    """
    Extracts text from a PDF file page by page
    and returns a single combined text string.
    Empty pages are ignored.
    """

    doc = fitz.open(path)

    pages = []

    for page_number, page in enumerate(doc, start=1):

        text = page.get_text("text")

        if text.strip():  # skip empty pages
            pages.append(text)

    doc.close()

    return "\n".join(pages)