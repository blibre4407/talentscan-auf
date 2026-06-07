import pdfplumber
import io

async def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Takes PDF file bytes and extracts all available raw text.
    """
    text = ""
    try:
        # We use io.BytesIO so we don't have to save the file to disk first
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"Error parsing PDF: {e}")
        return ""

    # Clean up the output by removing excessive newlines and spaces
    return text.strip()
    
