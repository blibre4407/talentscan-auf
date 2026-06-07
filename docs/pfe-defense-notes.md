# TalentScan-AUF Defense Notes

## System Positioning
TalentScan-AUF is a hybrid AI recruitment assistant built for institutional hiring workflows. It combines semantic similarity search with structured recruiter validation, hub filtering, and profile review states.

## Technical Highlights
- FastAPI backend for ingestion, search, analytics, evaluation, and file delivery.
- Sentence-Transformers embeddings with FAISS cosine-similarity search.
- SQLite metadata storage with persistent PDF file storage.
- React dashboard with AI-assisted CV parsing, backend fallback parsing, and recruiter review controls.

## Evaluation Workflow
1. Prepare 20-30 benchmark CVs and 8-10 job descriptions.
2. Fill `docs/benchmark-scenarios.sample.json` with the real expected candidate IDs.
3. Run `POST /evaluation/run` with those scenarios.
4. Capture the resulting `top_1_accuracy`, `top_3_accuracy`, `hub_filter_accuracy`, and `false_positive_rate`.

## Recommended Screenshots for the Jury
- Upload flow with parser confidence and missing-section warning.
- Search results with explanation chips and candidate status.
- Profile page with recruiter review notes.
- Analytics cards showing profile totals and parser confidence.

## Key Story for the Jury
The important innovation is not just semantic search. It is the human-in-the-loop workflow:
- AI extracts and structures the CV.
- The recruiter validates or corrects it.
- The system stores a trusted structured profile.
- Search remains semantically consistent because manual profile edits trigger index rebuilds.
