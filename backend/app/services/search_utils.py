import re
from typing import Iterable, List, Tuple


STOPWORDS = {
    "the", "and", "with", "for", "that", "this", "from", "into", "nous", "avec", "pour",
    "une", "des", "dans", "sur", "les", "and", "or", "job", "role", "candidate", "profil",
    "experience", "skills", "skill", "education", "seeking", "searching", "looking",
}


def tokenize(text: str) -> List[str]:
    return [
        token for token in re.findall(r"[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-\+]{2,}", (text or "").lower())
        if token not in STOPWORDS
    ]


def explain_match(job_description: str, candidate_text: str, candidate_skills: str | None = None) -> Tuple[List[str], str]:
    query_terms = tokenize(job_description)
    skill_terms = tokenize(candidate_skills or "")
    content_terms = tokenize(candidate_text)

    overlap = []
    seen = set()
    for term in query_terms:
        if term in seen:
            continue
        if term in skill_terms or term in content_terms:
            overlap.append(term)
            seen.add(term)
        if len(overlap) == 5:
            break

    if overlap:
        reason = f"Matched on {', '.join(overlap[:3])}"
    else:
        reason = "Semantic similarity based on the overall profile context"

    return overlap, reason


def summarize_missing_sections(sections: Iterable[str]) -> str:
    values = [section for section in sections if section]
    return ", ".join(values)
