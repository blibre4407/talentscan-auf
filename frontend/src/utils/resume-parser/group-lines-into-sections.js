const SECTION_TITLE_KEYWORDS = [
  "experience", "expérience", "education", "éducation", "formation", 
  "project", "projet", "skill", "compétence", "technologie", "job", 
  "course", "summary", "profil", "parcours"
];

export const groupLinesIntoSections = (lines) => {
  let sections = {};
  let sectionName = "profile";
  let sectionLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line[0]?.text.trim();
    
    if (isSectionTitle(line, i)) {
      sections[sectionName] = [...sectionLines];
      sectionName = text;
      sectionLines = [];
    } else {
      sectionLines.push(line);
    }
  }
  if (sectionLines.length > 0) sections[sectionName] = [...sectionLines];
  return sections;
};

const isSectionTitle = (line, lineNumber) => {
  if (lineNumber < 2 || line.length > 1 || line.length === 0) return false;
  
  const textItem = line[0];
  const text = textItem.text.trim();
  
  // Clean text for accent-insensitive comparison
  const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Check if it's explicitly bold and uppercase (Open-Resume primary heuristic)
  const isBold = textItem.fontName ? textItem.fontName.toLowerCase().includes('bold') : false;
  const hasLetterAndIsAllUpperCase = /[a-zA-Z\u00C0-\u017F]/.test(text) && text.toUpperCase() === text;

  if (isBold && hasLetterAndIsAllUpperCase) return true;

  // 2. Fallback heuristic: Short line, starts with capital, matches a known keyword
  const textHasAtMost3Words = text.split(" ").filter(s => s !== "&").length <= 3;
  const startsWithCapitalLetter = /^[A-Z\u00C0-\u017F]/.test(text.toUpperCase());
  
  // Support French accents in regex
  const hasOnlyLettersSpacesAmpersands = /^[a-zA-Z\u00C0-\u017F\s&]+$/.test(text);

  if (textHasAtMost3Words && hasOnlyLettersSpacesAmpersands && startsWithCapitalLetter) {
    if (SECTION_TITLE_KEYWORDS.some(keyword => normalizedText.includes(keyword))) {
      return true;
    }
  }
  
  return false;
};