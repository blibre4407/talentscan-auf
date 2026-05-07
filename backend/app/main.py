from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.services.pdf_parser import extract_text_from_pdf # <-- Import your new service
from app.services.nlp_engine import generate_vector
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.models import Base, CVProfile
from app.services.vector_store import save_vector_to_faiss
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
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # 1. Extract Text
    file_bytes = await file.read()
    extracted_text = await extract_text_from_pdf(file_bytes)

    if not extracted_text:
        raise HTTPException(status_code=500, detail="Could not extract text.")

    # 2. Generate Vector
    vector = generate_vector(extracted_text)

    # 3. Save to FAISS and get the Vector ID
    vector_id = save_vector_to_faiss(vector)

    # 4. Save to SQLite
    db = SessionLocal()
    new_cv = CVProfile(
        filename=file.filename,
        content=extracted_text,
        vector_id=vector_id
    )
    db.add(new_cv)
    db.commit()
    db.refresh(new_cv)
    db.close()

    return {
        "id": new_cv.id,
        "filename": new_cv.filename,
        "status": "CV stored and indexed successfully",
        "vector_id": vector_id
    }
@app.post("/search")
async def search_experts(job_description: str):
    # Phase 2: Logic for Sentence-Transformers & FAISS goes here
    return {"query": job_description, "top_matches": []}

# SQLite setup
DATABASE_URL = "sqlite:///./data/talentscan.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create the tables if they don't exist
Base.metadata.create_all(bind=engine)