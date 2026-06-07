# TalentScan-AUF

TalentScan-AUF is a PFE recruitment assistant that matches CVs to job descriptions using semantic embeddings, structured recruiter validation, and FAISS-based similarity search.

## What is implemented
- Semantic search with explainable keyword overlap hints.
- Smart CV ingestion with recruiter review before indexing.
- Backend PDF parsing fallback when browser parsing fails.
- Manual profile editing with automatic FAISS reindexing to avoid stale search results.
- Recruiter review state and notes per profile.
- Analytics overview and benchmark evaluation endpoint.

## Core API
- `POST /upload`: upload a PDF plus reviewed structured fields.
- `POST /upload-manual`: create a manual profile without a PDF.
- `POST /parse-pdf`: backend fallback parser for PDFs.
- `PUT /cv/{id}/update`: edit manual profiles and rebuild the index safely.
- `PUT /cv/{id}/review`: save recruiter status and notes.
- `POST /search`: semantic or direct name search.
- `GET /analytics/overview`: dashboard metrics.
- `POST /evaluation/run`: run benchmark scenarios for the defense.

## Local development
1. Backend:
   - Create a virtual environment.
   - Install `backend/requirements.txt`.
   - Run `uvicorn app.main:app --reload` from `backend`.
2. Frontend:
   - Install `frontend/package.json` dependencies.
   - Set `REACT_APP_API_BASE_URL` if needed.
   - Run `npm start` from `frontend`.
3. Docker:
   - Use `docker-compose up --build`.
   - The Hugging Face cache is mounted so model downloads persist between runs.

## PFE defense assets
- Sample benchmark scenarios: [docs/benchmark-scenarios.sample.json](/C:/Users/darlen/Downloads/talentscan-auf-main%20(2)/talentscan-auf-main/docs/benchmark-scenarios.sample.json)
- Defense notes: [docs/pfe-defense-notes.md](/C:/Users/darlen/Downloads/talentscan-auf-main%20(2)/talentscan-auf-main/docs/pfe-defense-notes.md)
