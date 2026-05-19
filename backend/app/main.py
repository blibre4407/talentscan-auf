import os
import logging
import shutil
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from fpdf import FPDF
from typing import Optional, List

from app.services.pdf_parser import extract_text_from_pdf
from app.services.nlp_engine import generate_vector
from app.services.vector_store import save_vector_to_faiss, search_faiss, get_index
from app.db.models import Base, CVProfile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from pydantic import BaseModel

# 1. Setup Logging & Directories
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

os.makedirs("./data", exist_ok=True)
CV_STORAGE_DIR = "./data/cv_storage"
os.makedirs(CV_STORAGE_DIR, exist_ok=True)

# 2. Database Setup
DATABASE_URL = "sqlite:///./data/talentscan.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="TalentScan-AUF API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS ---
class ManualProfile(BaseModel):
    hub: str
    full_name: str
    phone_number: Optional[str] = ""
    email: Optional[str] = ""
    skills: str
    experience: str
    education: str

class SearchRequest(BaseModel):
    job_description: Optional[str] = ""
    name_search: Optional[str] = ""
    hub_filter: Optional[str] = "All Hubs"
    top_k: int = 10

# --- UTILS ---
def generate_manual_pdf(profile: ManualProfile, cv_id: int) -> str:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", 'B', 16)
    pdf.cell(0, 10, text=f"Profile: {profile.full_name}", new_x="LMARGIN", new_y="NEXT", align='C')
    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 10, text=f"Hub: {profile.hub}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, text=f"Email: {profile.email}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, text=f"Phone: {profile.phone_number}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    pdf.set_font("Helvetica", 'B', 12)
    pdf.cell(0, 10, text="Skills", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6, text=profile.skills)
    pdf.ln(5)
    
    pdf.set_font("Helvetica", 'B', 12)
    pdf.cell(0, 10, text="Experience", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6, text=profile.experience)
    pdf.ln(5)
    
    pdf.set_font("Helvetica", 'B', 12)
    pdf.cell(0, 10, text="Education", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6, text=profile.education)
    
    file_path = os.path.join(CV_STORAGE_DIR, f"manual_{cv_id}.pdf")
    pdf.output(file_path)
    return file_path

# --- ENDPOINTS ---

@app.post("/upload")
async def upload_cv(
    hub: str = Form(...), 
    full_name: str = Form(...),
    email: str = Form(""),
    phone_number: str = Form(""),
    skills: str = Form(""),
    experience: str = Form(""),
    education: str = Form(""),
    file: UploadFile = File(...)
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    try:
        # Instead of extracting text on the backend, we now receive the PERFECT 
        # text directly from the React frontend's review screen!
        combined_text = f"Name: {full_name}\nHub: {hub}\nSkills: {skills}\nExperience: {experience}\nEducation: {education}"

        # Vectorize
        vector = await run_in_threadpool(generate_vector, combined_text)
        vector_id = await run_in_threadpool(save_vector_to_faiss, vector)

        db = SessionLocal()
        try:
            # Save to Database using the structured frontend fields
            new_cv = CVProfile(
                filename=file.filename, 
                hub=hub, 
                content=combined_text,
                vector_id=vector_id, 
                is_manual=False,
                full_name=full_name,
                email=email,
                phone=phone_number,
                skills=skills,
                experience=experience,
                education=education
            )
            db.add(new_cv)
            db.commit()
            db.refresh(new_cv)
            
            # Save Original File to Disk
            file.file.seek(0)
            saved_path = os.path.join(CV_STORAGE_DIR, f"{new_cv.id}_{file.filename}")
            with open(saved_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            new_cv.file_path = saved_path
            db.commit()
            
            return {"id": new_cv.id, "status": "Indexed successfully", "vector_id": vector_id}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error occurred during upload.")

@app.post("/upload-manual")
async def upload_manual_cv(profile: ManualProfile):
    try:
        combined_text = f"Name: {profile.full_name}\nHub: {profile.hub}\nSkills: {profile.skills}\nExperience: {profile.experience}\nEducation: {profile.education}"
        
        # Vectorize
        vector = await run_in_threadpool(generate_vector, combined_text)
        vector_id = await run_in_threadpool(save_vector_to_faiss, vector)

        db = SessionLocal()
        try:
            # Save to Database
            new_cv = CVProfile(
                filename=f"{profile.full_name} Profile", full_name=profile.full_name,
                hub=profile.hub, email=profile.email, phone=profile.phone_number,
                skills=profile.skills, experience=profile.experience, education=profile.education,
                content=combined_text, vector_id=vector_id, is_manual=True
            )
            db.add(new_cv)
            db.commit()
            db.refresh(new_cv)
            
            # Generate and Save PDF
            pdf_path = generate_manual_pdf(profile, new_cv.id)
            new_cv.file_path = pdf_path
            db.commit()
            
            return {"id": new_cv.id, "status": "Indexed manually", "vector_id": vector_id, "filename": new_cv.filename}
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Manual upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error occurred during manual upload.")

@app.put("/cv/{cv_id}/update")
async def update_manual_cv(cv_id: int, profile: ManualProfile):
    db = SessionLocal()
    try:
        cv = db.query(CVProfile).filter(CVProfile.id == cv_id, CVProfile.is_manual == True).first()
        if not cv:
            raise HTTPException(status_code=404, detail="Manual CV not found")
            
        # Update DB fields
        cv.full_name = profile.full_name
        cv.hub = profile.hub
        cv.email = profile.email
        cv.phone = profile.phone_number
        cv.skills = profile.skills
        cv.experience = profile.experience
        cv.education = profile.education
        
        combined_text = f"Name: {profile.full_name}\nHub: {profile.hub}\nSkills: {profile.skills}\nExperience: {profile.experience}\nEducation: {profile.education}"
        cv.content = combined_text
        
        # Regenerate the PDF file
        pdf_path = generate_manual_pdf(profile, cv.id)
        cv.file_path = pdf_path
        
        db.commit()
        return {"status": "success", "message": "Profile updated successfully"}
    finally:
        db.close()

@app.post("/search")
async def search_experts(request: SearchRequest):
    db = SessionLocal()
    try:
        matches = []
        
        # 1. Direct Database Search by Name
        if request.name_search.strip() and not request.job_description.strip():
            query = db.query(CVProfile).filter(
                (CVProfile.filename.ilike(f"%{request.name_search}%")) | 
                (CVProfile.full_name.ilike(f"%{request.name_search}%"))
            )
            if request.hub_filter != "All Hubs":
                query = query.filter(CVProfile.hub == request.hub_filter)
            
            results = query.limit(request.top_k).all()
            for cv in results:
                matches.append({
                    "cv_id": cv.id, "filename": cv.filename, "hub": cv.hub,
                    "similarity_score": "Direct Match", "preview": cv.content[:150] + "..."
                })
            return {"top_matches": matches}

        # 2. Semantic Vector Search
        query_vector = await run_in_threadpool(generate_vector, request.job_description)
        # Fetch a larger pool from FAISS to allow for local hub filtering
        distances, indices = await run_in_threadpool(search_faiss, query_vector, 50) 
        
        for i, vector_id in enumerate(indices):
            if vector_id == -1 or len(matches) >= request.top_k: continue
            
            cv = db.query(CVProfile).filter(CVProfile.vector_id == int(vector_id)).first()
            if cv:
                # Apply Hub Filter locally
                if request.hub_filter != "All Hubs" and cv.hub != request.hub_filter:
                    continue
                matches.append({
                    "cv_id": cv.id, "filename": cv.filename, "hub": cv.hub,
                    "similarity_score": round(float(distances[i]) * 100, 2),
                    "preview": cv.content[:150] + "..."
                })
        return {"top_matches": matches}
    except Exception as e:
        logger.error(f"Search failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during search.")
    finally:
        db.close()

@app.get("/cv/{cv_id}")
async def get_cv(cv_id: int):
    db = SessionLocal()
    try:
        cv = db.query(CVProfile).filter(CVProfile.id == cv_id).first()
        if not cv: 
            raise HTTPException(status_code=404, detail="CV not found")
        return {
            "id": cv.id, "filename": cv.filename, "hub": cv.hub, "is_manual": cv.is_manual,
            "full_name": cv.full_name, "email": cv.email, "phone": cv.phone,
            "skills": cv.skills, "experience": cv.experience, "education": cv.education,
            "content": cv.content
        }
    finally:
        db.close()

@app.get("/cv/{cv_id}/download")
async def download_cv(cv_id: int):
    db = SessionLocal()
    try:
        cv = db.query(CVProfile).filter(CVProfile.id == cv_id).first()
        if not cv or not cv.file_path or not os.path.exists(cv.file_path):
            raise HTTPException(status_code=404, detail="File not found on server")
        
        download_name = f"{cv.full_name}_CV.pdf" if cv.is_manual else cv.filename
        return FileResponse(path=cv.file_path, filename=download_name, media_type='application/pdf')
    finally:
        db.close()