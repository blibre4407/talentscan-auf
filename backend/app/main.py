import logging
import os
import shutil
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fpdf import FPDF
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db.migrations import ensure_schema
from app.db.models import Base, CVProfile
from app.services.evaluation import compute_metrics
from app.services.nlp_engine import generate_vector
from app.services.pdf_parser import extract_text_from_pdf
from app.services.profile_parser import extract_structured_profile
from app.services.search_utils import explain_match, summarize_missing_sections
from app.services.vector_store import get_index_count, rebuild_faiss_index, save_vector_to_faiss, search_faiss

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

os.makedirs("./data", exist_ok=True)
os.makedirs(settings.cv_storage_dir, exist_ok=True)

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)
ensure_schema(engine)

app = FastAPI(title="TalentScan-AUF API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ManualProfile(BaseModel):
    hub: str
    full_name: str
    phone_number: Optional[str] = ""
    email: Optional[str] = ""
    skills: str = ""
    experience: str = ""
    education: str = ""
    parser_source: str = "manual"
    parser_confidence: int = 100
    parser_missing_sections: List[str] = Field(default_factory=list)
    profile_status: str = "new"
    recruiter_notes: str = ""


class ReviewUpdateRequest(BaseModel):
    profile_status: str = "new"
    recruiter_notes: str = ""


class SearchRequest(BaseModel):
    job_description: Optional[str] = ""
    name_search: Optional[str] = ""
    hub_filter: Optional[str] = "All Hubs"
    top_k: int = 10


class EvaluationCase(BaseModel):
    label: str
    job_description: str
    expected_cv_ids: List[int]
    hub_filter: str = "All Hubs"
    top_k: int = 3


class EvaluationRequest(BaseModel):
    scenarios: List[EvaluationCase]


def build_combined_text(profile: ManualProfile) -> str:
    return (
        f"Name: {profile.full_name}\n"
        f"Hub: {profile.hub}\n"
        f"Skills: {profile.skills}\n"
        f"Experience: {profile.experience}\n"
        f"Education: {profile.education}"
    )


def generate_manual_pdf(profile: ManualProfile, cv_id: int) -> str:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, text=f"Profile: {profile.full_name}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", size=12)
    pdf.cell(0, 10, text=f"Hub: {profile.hub}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, text=f"Email: {profile.email}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, text=f"Phone: {profile.phone_number}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    for title, body in (
        ("Skills", profile.skills),
        ("Experience", profile.experience),
        ("Education", profile.education),
    ):
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 10, text=title, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", size=11)
        pdf.multi_cell(0, 6, text=body or "Not provided")
        pdf.ln(5)

    file_path = os.path.join(settings.cv_storage_dir, f"manual_{cv_id}.pdf")
    pdf.output(file_path)
    return file_path


def serialize_profile(cv: CVProfile) -> dict:
    missing_sections = []
    if cv.parser_missing_sections:
        missing_sections = [part.strip() for part in cv.parser_missing_sections.split(",") if part.strip()]

    return {
        "id": cv.id,
        "filename": cv.filename,
        "hub": cv.hub,
        "is_manual": cv.is_manual,
        "full_name": cv.full_name,
        "email": cv.email,
        "phone": cv.phone,
        "skills": cv.skills,
        "experience": cv.experience,
        "education": cv.education,
        "content": cv.content,
        "parser_source": cv.parser_source or "manual",
        "parser_confidence": cv.parser_confidence or 0,
        "parser_missing_sections": missing_sections,
        "profile_status": cv.profile_status or "new",
        "recruiter_notes": cv.recruiter_notes or "",
    }


def rebuild_index_from_db() -> int:
    db = SessionLocal()
    try:
        profiles = db.query(CVProfile).order_by(CVProfile.id.asc()).all()
        vectors: List[List[float]] = []

        for position, profile in enumerate(profiles):
            vector = generate_vector(profile.content or "")
            profile.vector_id = position
            vectors.append(vector)

        rebuild_faiss_index(vectors)
        db.commit()
        return len(profiles)
    finally:
        db.close()


def ensure_index_consistency() -> None:
    db = SessionLocal()
    try:
        profile_count = db.query(func.count(CVProfile.id)).scalar() or 0
        index_count = get_index_count()
    finally:
        db.close()

    if profile_count != index_count:
        logger.warning("FAISS index count mismatch detected. Rebuilding index for consistency.")
        rebuild_index_from_db()


def detect_duplicates(db_session, full_name: str, email: str) -> List[dict]:
    if not full_name.strip() and not email.strip():
        return []

    query = db_session.query(CVProfile)
    if email.strip():
        query = query.filter(CVProfile.email.ilike(email.strip()))
    else:
        query = query.filter(CVProfile.full_name.ilike(f"%{full_name.strip()}%"))

    matches = query.limit(5).all()
    return [
        {"id": cv.id, "full_name": cv.full_name, "email": cv.email, "hub": cv.hub}
        for cv in matches
    ]


def run_semantic_search(db_session, request: SearchRequest) -> List[dict]:
    matches = []

    if request.name_search.strip() and not request.job_description.strip():
        query = db_session.query(CVProfile).filter(
            (CVProfile.filename.ilike(f"%{request.name_search}%"))
            | (CVProfile.full_name.ilike(f"%{request.name_search}%"))
        )
        if request.hub_filter != "All Hubs":
            query = query.filter(CVProfile.hub == request.hub_filter)

        results = query.limit(request.top_k).all()
        for cv in results:
            matches.append(
                {
                    "cv_id": cv.id,
                    "filename": cv.filename,
                    "full_name": cv.full_name,
                    "hub": cv.hub,
                    "profile_status": cv.profile_status or "new",
                    "similarity_score": "Direct Match",
                    "preview": (cv.content or "")[:150] + "...",
                    "matched_keywords": [],
                    "match_reason": "Direct match on candidate name",
                }
            )
        return matches

    query_vector = generate_vector(request.job_description)
    distances, indices = search_faiss(query_vector, max(request.top_k * 5, 20))

    for i, vector_id in enumerate(indices):
        if vector_id == -1 or len(matches) >= request.top_k:
            continue

        cv = db_session.query(CVProfile).filter(CVProfile.vector_id == int(vector_id)).first()
        if not cv:
            continue
        if request.hub_filter != "All Hubs" and cv.hub != request.hub_filter:
            continue

        matched_keywords, match_reason = explain_match(request.job_description, cv.content or "", cv.skills or "")
        similarity_score = round(max(0, min(float(distances[i]) * 100, 100)), 2)

        matches.append(
            {
                "cv_id": cv.id,
                "filename": cv.filename,
                "full_name": cv.full_name,
                "hub": cv.hub,
                "profile_status": cv.profile_status or "new",
                "similarity_score": similarity_score,
                "preview": (cv.content or "")[:150] + "...",
                "matched_keywords": matched_keywords,
                "match_reason": match_reason,
            }
        )

    return matches


@app.on_event("startup")
def startup_tasks() -> None:
    ensure_index_consistency()


@app.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    raw_text = await extract_text_from_pdf(file_bytes)
    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Unable to extract text from the uploaded PDF.")

    parsed = extract_structured_profile(raw_text)
    return {
        **parsed,
        "parser_source": "backend-fallback",
        "raw_text_length": len(raw_text),
    }


@app.post("/upload")
async def upload_cv(
    hub: str = Form(...),
    full_name: str = Form(...),
    email: str = Form(""),
    phone_number: str = Form(""),
    skills: str = Form(""),
    experience: str = Form(""),
    education: str = Form(""),
    parser_source: str = Form("frontend-smart-parser"),
    parser_confidence: int = Form(0),
    parser_missing_sections: str = Form(""),
    profile_status: str = Form("new"),
    recruiter_notes: str = Form(""),
    file: UploadFile = File(...),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    profile = ManualProfile(
        hub=hub,
        full_name=full_name,
        phone_number=phone_number,
        email=email,
        skills=skills,
        experience=experience,
        education=education,
        parser_source=parser_source,
        parser_confidence=parser_confidence,
        parser_missing_sections=[part.strip() for part in parser_missing_sections.split(",") if part.strip()],
        profile_status=profile_status,
        recruiter_notes=recruiter_notes,
    )
    combined_text = build_combined_text(profile)

    try:
        vector = await run_in_threadpool(generate_vector, combined_text)
        vector_id = await run_in_threadpool(save_vector_to_faiss, vector)

        db = SessionLocal()
        try:
            duplicates = detect_duplicates(db, full_name, email)
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
                education=education,
                parser_source=parser_source,
                parser_confidence=parser_confidence,
                parser_missing_sections=summarize_missing_sections(profile.parser_missing_sections),
                profile_status=profile_status,
                recruiter_notes=recruiter_notes,
            )
            db.add(new_cv)
            db.commit()
            db.refresh(new_cv)

            file.file.seek(0)
            saved_path = os.path.join(settings.cv_storage_dir, f"{new_cv.id}_{file.filename}")
            with open(saved_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            new_cv.file_path = saved_path
            db.commit()

            return {
                "id": new_cv.id,
                "status": "Indexed successfully",
                "vector_id": vector_id,
                "duplicates": duplicates,
            }
        finally:
            db.close()
    except Exception as exc:
        logger.error("Upload error: %s", exc)
        await run_in_threadpool(rebuild_index_from_db)
        raise HTTPException(status_code=500, detail="Error occurred during upload.")


@app.post("/upload-manual")
async def upload_manual_cv(profile: ManualProfile):
    try:
        combined_text = build_combined_text(profile)
        vector = await run_in_threadpool(generate_vector, combined_text)
        vector_id = await run_in_threadpool(save_vector_to_faiss, vector)

        db = SessionLocal()
        try:
            duplicates = detect_duplicates(db, profile.full_name, profile.email or "")
            new_cv = CVProfile(
                filename=f"{profile.full_name} Profile",
                full_name=profile.full_name,
                hub=profile.hub,
                email=profile.email,
                phone=profile.phone_number,
                skills=profile.skills,
                experience=profile.experience,
                education=profile.education,
                content=combined_text,
                vector_id=vector_id,
                is_manual=True,
                parser_source=profile.parser_source,
                parser_confidence=profile.parser_confidence,
                parser_missing_sections=summarize_missing_sections(profile.parser_missing_sections),
                profile_status=profile.profile_status,
                recruiter_notes=profile.recruiter_notes,
            )
            db.add(new_cv)
            db.commit()
            db.refresh(new_cv)

            pdf_path = generate_manual_pdf(profile, new_cv.id)
            new_cv.file_path = pdf_path
            db.commit()

            return {
                "id": new_cv.id,
                "status": "Indexed manually",
                "vector_id": vector_id,
                "filename": new_cv.filename,
                "duplicates": duplicates,
            }
        finally:
            db.close()
    except Exception as exc:
        logger.error("Manual upload error: %s", exc)
        await run_in_threadpool(rebuild_index_from_db)
        raise HTTPException(status_code=500, detail="Error occurred during manual upload.")


@app.put("/cv/{cv_id}/update")
async def update_manual_cv(cv_id: int, profile: ManualProfile):
    db = SessionLocal()
    try:
        cv = db.query(CVProfile).filter(CVProfile.id == cv_id, CVProfile.is_manual.is_(True)).first()
        if not cv:
            raise HTTPException(status_code=404, detail="Manual CV not found")

        cv.full_name = profile.full_name
        cv.filename = f"{profile.full_name} Profile"
        cv.hub = profile.hub
        cv.email = profile.email
        cv.phone = profile.phone_number
        cv.skills = profile.skills
        cv.experience = profile.experience
        cv.education = profile.education
        cv.parser_source = profile.parser_source
        cv.parser_confidence = profile.parser_confidence
        cv.parser_missing_sections = summarize_missing_sections(profile.parser_missing_sections)
        cv.profile_status = profile.profile_status
        cv.recruiter_notes = profile.recruiter_notes

        combined_text = build_combined_text(profile)
        cv.content = combined_text
        cv.file_path = generate_manual_pdf(profile, cv.id)
        db.commit()
    finally:
        db.close()

    await run_in_threadpool(rebuild_index_from_db)
    return {"status": "success", "message": "Profile updated and search index rebuilt successfully"}


@app.put("/cv/{cv_id}/review")
async def update_profile_review(cv_id: int, review: ReviewUpdateRequest):
    db = SessionLocal()
    try:
        cv = db.query(CVProfile).filter(CVProfile.id == cv_id).first()
        if not cv:
            raise HTTPException(status_code=404, detail="CV not found")

        cv.profile_status = review.profile_status
        cv.recruiter_notes = review.recruiter_notes
        db.commit()
        return {"status": "success", "message": "Recruiter review updated successfully"}
    finally:
        db.close()


@app.post("/search")
async def search_experts(request: SearchRequest):
    db = SessionLocal()
    try:
        matches = run_semantic_search(db, request)
        if request.job_description.strip():
            db_profile_count = db.query(func.count(CVProfile.id)).scalar() or 0
            parser_warning = None
            if db_profile_count < 10:
                parser_warning = "Dataset is still small. Similarity scores are best treated as indicative, not final."
        else:
            parser_warning = None

        return {"top_matches": matches, "notice": parser_warning}
    except Exception as exc:
        logger.error("Search failed: %s", exc)
        raise HTTPException(status_code=500, detail="Internal server error during search.")
    finally:
        db.close()


@app.post("/evaluation/run")
async def run_evaluation(request: EvaluationRequest):
    db = SessionLocal()
    try:
        scenario_results = []
        for scenario in request.scenarios:
            search_request = SearchRequest(
                job_description=scenario.job_description,
                hub_filter=scenario.hub_filter,
                top_k=scenario.top_k,
            )
            matches = run_semantic_search(db, search_request)
            returned_ids = [match["cv_id"] for match in matches]
            top_1_hit = bool(returned_ids[:1] and returned_ids[0] in scenario.expected_cv_ids)
            top_3_hit = any(cv_id in scenario.expected_cv_ids for cv_id in returned_ids[:3])
            false_positive_count = sum(1 for cv_id in returned_ids[:3] if cv_id not in scenario.expected_cv_ids)
            hub_filter_correct = all(
                match["hub"] == scenario.hub_filter for match in matches
            ) if scenario.hub_filter != "All Hubs" else True

            scenario_results.append(
                {
                    "label": scenario.label,
                    "expected_cv_ids": scenario.expected_cv_ids,
                    "returned_cv_ids": returned_ids[:3],
                    "top_1_hit": top_1_hit,
                    "top_3_hit": top_3_hit,
                    "hub_filter_correct": hub_filter_correct,
                    "false_positive_count": false_positive_count,
                }
            )

        return {"metrics": compute_metrics(scenario_results), "scenarios": scenario_results}
    finally:
        db.close()


@app.get("/analytics/overview")
async def analytics_overview():
    db = SessionLocal()
    try:
        profiles = db.query(CVProfile).all()
        by_hub = {}
        by_status = {}
        manual_count = 0
        parser_coverage = 0
        missing_sections_total = 0

        for profile in profiles:
            by_hub[profile.hub] = by_hub.get(profile.hub, 0) + 1
            status = profile.profile_status or "new"
            by_status[status] = by_status.get(status, 0) + 1
            manual_count += 1 if profile.is_manual else 0
            parser_coverage += profile.parser_confidence or 0
            if profile.parser_missing_sections:
                missing_sections_total += len([value for value in profile.parser_missing_sections.split(",") if value.strip()])

        total = len(profiles)
        return {
            "total_profiles": total,
            "manual_profiles": manual_count,
            "uploaded_profiles": total - manual_count,
            "average_parser_confidence": round(parser_coverage / total, 2) if total else 0,
            "profiles_with_missing_sections": missing_sections_total,
            "by_hub": by_hub,
            "by_status": by_status,
            "faiss_index_size": get_index_count(),
        }
    finally:
        db.close()


@app.post("/admin/reindex")
async def reindex_profiles():
    indexed_profiles = await run_in_threadpool(rebuild_index_from_db)
    return {"status": "success", "indexed_profiles": indexed_profiles}


@app.get("/cv/{cv_id}")
async def get_cv(cv_id: int):
    db = SessionLocal()
    try:
        cv = db.query(CVProfile).filter(CVProfile.id == cv_id).first()
        if not cv:
            raise HTTPException(status_code=404, detail="CV not found")
        return serialize_profile(cv)
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
        return FileResponse(path=cv.file_path, filename=download_name, media_type="application/pdf")
    finally:
        db.close()
