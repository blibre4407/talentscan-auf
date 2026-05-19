import * as pdfjsLib from 'pdfjs-dist';

// Use unpkg with the exact version to prevent CORS/Webpack worker crashes
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export const extractDataFromPDF = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let allItems = [];

    // 1. EXTRACT: Read PDF text items (Direct port of open-resume/read-pdf.ts)
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      textContent.items.forEach(item => {
        if (item.str.trim() === '') return;
        allItems.push({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          height: item.height
        });
      });
    }

    // 2. GROUP: Combine intersecting text into lines (Direct port of open-resume/group-text-items-into-lines.ts)
    // Sort physically by Y-axis (top to bottom), then X-axis (left to right)
    allItems.sort((a, b) => {
      if (Math.abs(b.y - a.y) > a.height / 2) {
        return b.y - a.y; 
      }
      return a.x - b.x;
    });

    let lines = [];
    let currentLine = null;

    allItems.forEach(item => {
      if (!currentLine) {
        currentLine = { y: item.y, height: item.height, items: [item] };
        lines.push(currentLine);
      } else {
        const y1 = currentLine.y;
        const h1 = currentLine.height;
        const y2 = item.y;
        const h2 = item.height;
        
        // Open-Resume Intersection Logic: Do these two boxes share the same Y plane?
        if (Math.max(y1, y2) <= Math.min(y1 + h1, y2 + h2)) {
          currentLine.items.push(item);
        } else {
          currentLine = { y: item.y, height: item.height, items: [item] };
          lines.push(currentLine);
        }
      }
    });

    // Map items to continuous text strings
    const textLines = lines.map(line => {
      line.items.sort((a, b) => a.x - b.x); // Sort words horizontally
      return line.items.map(i => i.text).join(' ');
    });

    // 3. IDENTIFY SECTIONS: (Direct port of open-resume/group-lines-into-sections.ts)
    const parsedData = { full_name: '', email: '', phone_number: '', skills: '', experience: '', education: '' };
    
    let currentSection = 'profile';
    let sections = { profile: [], skills: [], experience: [], education: [] };

    const matchHeader = (line, keywords) => {
      const cleanLine = line.toLowerCase().replace(/[^a-z]/g, '');
      return keywords.some(kw => cleanLine.includes(kw)) && line.length < 35;
    };

    textLines.forEach(line => {
      if (matchHeader(line, ['skills', 'compétences', 'technologies', 'expertise'])) {
        currentSection = 'skills';
      } else if (matchHeader(line, ['experience', 'expérience', 'workhistory', 'employment'])) {
        currentSection = 'experience';
      } else if (matchHeader(line, ['education', 'éducation', 'formation', 'academic'])) {
        currentSection = 'education';
      } else {
        if (sections[currentSection]) sections[currentSection].push(line);
      }
    });

    // 4. EXTRACT ENTITIES
    const fullText = textLines.join('\n');
    
    const emailMatch = fullText.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/);
    if (emailMatch) parsedData.email = emailMatch[0];

    const phoneMatch = fullText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/);
    if (phoneMatch) parsedData.phone_number = phoneMatch[0].trim();

    // Grab the name from the profile section
    const profileLines = sections.profile.filter(line => line.length > 2 && !line.includes('@') && !/\d/.test(line) && !/resume|cv/i.test(line));
    if (profileLines.length > 0) {
        parsedData.full_name = profileLines[0];
    }

    parsedData.skills = sections.skills.join('\n').trim();
    parsedData.experience = sections.experience.join('\n').trim();
    parsedData.education = sections.education.join('\n').trim();

    return parsedData;

  } catch (error) {
    console.error("Open-Resume Parser Error Details:", error);
    throw error;
  }
};