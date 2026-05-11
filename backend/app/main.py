import os
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool

from app.services.pdf_parser import extract_text_from_pdf
from app.services.nlp_engine import generate_vector
from app.services.vector_store import save_vector_to_faiss
from app.db.models import Base, CVProfile

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from pydantic import BaseModel
from app.services.vector_store import search_faiss, get_index

# 1. Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 2. FIX: Ensure the data directory exists before DB or FAISS tries to write to it!
os.makedirs("./data", exist_ok=True)

# SQLite setup
DATABASE_URL = "sqlite:///./data/talentscan.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create the tables if they don't exist
Base.metadata.create_all(bind=engine)

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

    try:
        # 1. Extract Text
        file_bytes = await file.read()
        extracted_text = await extract_text_from_pdf(file_bytes)

        if not extracted_text:
            raise HTTPException(status_code=400, detail="Could not extract text or PDF is empty.")

        # 2. Generate Vector (FIX: Run blocking ML code in a threadpool)
        vector = await run_in_threadpool(generate_vector, extracted_text)
        
        if not vector:
            raise HTTPException(status_code=500, detail="Failed to generate vector embedding.")

        # 3. Save to FAISS (FIX: Also run disk I/O in threadpool)
        vector_id = await run_in_threadpool(save_vector_to_faiss, vector)

        # 4. Save to SQLite with proper transaction management
        db = SessionLocal()
        try:
            new_cv = CVProfile(
                filename=file.filename,
                content=extracted_text,
                vector_id=vector_id
            )
            db.add(new_cv)
            db.commit()
            db.refresh(new_cv)
            
            return {
                "id": new_cv.id,
                "filename": new_cv.filename,
                "status": "CV stored and indexed successfully",
                "vector_id": vector_id
            }
        except Exception as db_err:
            db.rollback()
            logger.error(f"Database insertion failed: {db_err}")
            raise HTTPException(status_code=500, detail="Database error occurred.")
        finally:
            db.close() # FIX: Ensure connection is always returned to the pool

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during upload: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected internal server error occurred.")


from pydantic import BaseModel
from app.services.vector_store import search_faiss, get_index

# 1. Define the Request Schema
class SearchRequest(BaseModel):
    job_description: str
    top_k: int = 5

# 2. Implement the Endpoint
@app.post("/search")
async def search_experts(request: SearchRequest):
    if not request.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")
    
    try:
        # Phase 1: Vectorize the Job Description
        query_vector = await run_in_threadpool(generate_vector, request.job_description)
        
        if not query_vector:
            raise HTTPException(status_code=500, detail="Failed to generate vector embedding.")

        # Phase 2: Query FAISS
        distances, indices = await run_in_threadpool(search_faiss, query_vector, request.top_k)
        
        # Handle empty index or no matches
        if len(indices) == 0 or indices[0] == -1:
            return {"query": request.job_description, "top_matches": []}
        
        # Phase 3: Retrieve Metadata from SQLite
        db = SessionLocal()
        matches = []
        try:
            for i, vector_id in enumerate(indices):
                if vector_id == -1: # FAISS returns -1 if there aren't enough vectors in the DB
                    continue
                
                # Fetch the CV that corresponds to this FAISS vector_id
                cv = db.query(CVProfile).filter(CVProfile.vector_id == int(vector_id)).first()
                
                if cv:
                    matches.append({
                        "cv_id": cv.id,
                        "filename": cv.filename,
                        "similarity_score": round(float(distances[i]) * 100, 2), # Convert to percentage
                        "preview": cv.content[:250] + "..." # Send a snippet to the frontend
                    })
        finally:
            db.close()
            
        return {"query": request.job_description, "top_matches": matches}

    except Exception as e:
        logger.error(f"Search failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during search.")

@app.get("/cv/{cv_id}")
async def get_cv(cv_id: int):
    db = SessionLocal()
    try:
        cv = db.query(CVProfile).filter(CVProfile.id == cv_id).first()
        if not cv:
            raise HTTPException(status_code=404, detail="CV not found")
        return {
            "id": cv.id,
            "filename": cv.filename,
            "content": cv.content
        }
    finally:
        db.close()