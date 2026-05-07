from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.services.pdf_parser import extract_text_from_pdf # <-- Import your new service
from app.services.nlp_engine import generate_vector
app = FastAPI(title="TalentScan-AUF API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "TalentScan-AUF API is running"}

@app.post("/upload")
async def upload_cv(file: UploadFile = File(...)):
    # 1. Validate the file type
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # 2. Read the file into memory
    file_bytes = await file.read()
    
    # 3. Extract the text
    extracted_text = await extract_text_from_pdf(file_bytes)

    if not extracted_text:
        raise HTTPException(status_code=500, detail="Could not extract text. The PDF might be an image or encrypted.")

    # # 4. Return a preview (Later, this text will go into SQLite and FAISS)
    # return {
    #     "filename": file.filename,
    #     "status": "Text extracted successfully",
    #     "character_count": len(extracted_text),
    #     "preview": extracted_text[:2133] + "..." # Send the first 250 characters as proof
    # }

# --- NEW: AI Vectorization ---
    # Convert the text into a mathematical vector
    vector = generate_vector(extracted_text)

    return {
        "filename": file.filename,
        "status": "Text extracted and vectorized successfully",
        "character_count": len(extracted_text),
        "vector_dimensions": len(vector), # Should output 384
        "vector_preview": vector[:5] # Show the first 5 numbers of the array
    }
    
@app.post("/search")
async def search_experts(job_description: str):
    # Phase 2: Logic for Sentence-Transformers & FAISS goes here
    return {"query": job_description, "top_matches": []}

