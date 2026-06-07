import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

const matchHeader = (line, keywords) => {
  const cleanLine = line.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, '');
  return keywords.some((keyword) => cleanLine.includes(keyword)) && line.length < 40;
};

const computeMetadata = (parsedData) => {
  const missingSections = ['skills', 'experience', 'education'].filter((section) => !parsedData[section]?.trim());
  const filledFields = ['full_name', 'email', 'phone_number', 'skills', 'experience', 'education']
    .filter((field) => parsedData[field]?.trim()).length;

  return {
    parser_source: 'frontend-smart-parser',
    parser_confidence: Math.min(100, Math.round((filledFields / 6) * 100)),
    parser_missing_sections: missingSections,
  };
};

export const extractDataFromPDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allItems = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    textContent.items.forEach((item) => {
      if (!item.str.trim()) return;
      allItems.push({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        height: item.height,
      });
    });
  }

  allItems.sort((a, b) => {
    if (Math.abs(b.y - a.y) > a.height / 2) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const lines = [];
  let currentLine = null;

  allItems.forEach((item) => {
    if (!currentLine) {
      currentLine = { y: item.y, height: item.height, items: [item] };
      lines.push(currentLine);
      return;
    }

    const sameLine = Math.max(currentLine.y, item.y) <= Math.min(currentLine.y + currentLine.height, item.y + item.height);
    if (sameLine) {
      currentLine.items.push(item);
    } else {
      currentLine = { y: item.y, height: item.height, items: [item] };
      lines.push(currentLine);
    }
  });

  const textLines = lines.map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '));
  const parsedData = { full_name: '', email: '', phone_number: '', skills: '', experience: '', education: '' };
  const sections = { profile: [], skills: [], experience: [], education: [] };
  let currentSection = 'profile';

  textLines.forEach((line) => {
    if (matchHeader(line, ['skills', 'competences', 'competence', 'technologies', 'expertise'])) {
      currentSection = 'skills';
    } else if (matchHeader(line, ['experience', 'employment', 'work history', 'parcours'])) {
      currentSection = 'experience';
    } else if (matchHeader(line, ['education', 'formation', 'academic', 'etudes'])) {
      currentSection = 'education';
    } else {
      sections[currentSection].push(line);
    }
  });

  const fullText = textLines.join('\n');
  const emailMatch = fullText.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/);
  const phoneMatch = fullText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/);

  if (emailMatch) parsedData.email = emailMatch[0];
  if (phoneMatch) parsedData.phone_number = phoneMatch[0].trim();

  const profileLines = sections.profile.filter((line) => line.length > 2 && !line.includes('@') && !/\d/.test(line) && !/resume|cv/i.test(line));
  if (profileLines.length > 0) {
    parsedData.full_name = profileLines[0];
  }

  parsedData.skills = sections.skills.join('\n').trim();
  parsedData.experience = sections.experience.join('\n').trim();
  parsedData.education = sections.education.join('\n').trim();

  return {
    ...parsedData,
    ...computeMetadata(parsedData),
  };
};
