import re
from typing import Dict, List


SECTION_RULES = {
    "skills": ["skills", "competences", "compétences", "technologies", "expertise", "tools", "outils"],
    "experience": ["experience", "expérience", "employment", "work history", "parcours"],
    "education": ["education", "éducation", "formation", "academic", "studies", "etudes", "études"],
}


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _section_key(line: str) -> str | None:
    lowered = re.sub(r"[^a-zA-ZÀ-ÿ\s]", "", (line or "").lower()).strip()
    for key, keywords in SECTION_RULES.items():
        if any(keyword in lowered for keyword in keywords) and len(lowered.split()) <= 4:
            return key
    return None


def extract_structured_profile(raw_text: str) -> Dict[str, object]:
    clean_text = _normalize(raw_text)
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    sections: Dict[str, List[str]] = {"profile": [], "skills": [], "experience": [], "education": []}
    current_section = "profile"

    for line in lines:
        next_section = _section_key(line)
        if next_section:
            current_section = next_section
            continue
        sections[current_section].append(line)

    email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", clean_text)
    phone_match = re.search(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}", clean_text)

    profile_candidates = [
        line for line in sections["profile"]
        if len(line) > 3 and "@" not in line and not re.search(r"\d{3,}", line) and not re.search(r"\b(cv|resume)\b", line, re.I)
    ]
    full_name = profile_candidates[0] if profile_candidates else ""

    parsed = {
        "full_name": full_name,
        "email": email_match.group(0) if email_match else "",
        "phone_number": phone_match.group(0).strip() if phone_match else "",
        "skills": "\n".join(sections["skills"]).strip(),
        "experience": "\n".join(sections["experience"]).strip(),
        "education": "\n".join(sections["education"]).strip(),
    }

    missing_sections = [name for name in ("skills", "experience", "education") if not parsed[name]]
    quality_points = sum(
        1 for field in ("full_name", "email", "phone_number", "skills", "experience", "education")
        if parsed[field]
    )
    confidence = min(100, int((quality_points / 6) * 100))

    parsed["parser_confidence"] = confidence
    parsed["parser_missing_sections"] = missing_sections
    return parsed
