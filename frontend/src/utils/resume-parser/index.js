import * as pdfjsLib from 'pdfjs-dist';
import { groupTextItemsIntoLines } from './group-text-items-into-lines';
import { groupLinesIntoSections } from './group-lines-into-sections';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export const extractDataFromPDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textItems = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    textContent.items.forEach(item => {
      textItems.push({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
        fontName: item.fontName,
        hasEOL: item.hasEOL
      });
    });
  }

  const lines = groupTextItemsIntoLines(textItems);
  const sections = groupLinesIntoSections(lines);

  const parsedData = { full_name: '', email: '', phone_number: '', skills: '', experience: '', education: '' };

  for (const [key, sectionLines] of Object.entries(sections)) {
      // Rebuild the text block with proper spacing
      const text = sectionLines.map(line => line.map(item => item.text).join(' ')).join('\n');
      
      if (key === 'profile') {
          // Extract Email
          const emailMatch = text.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/);
          if (emailMatch) parsedData.email = emailMatch[0];
          
          // Extract Phone
          const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/);
          if (phoneMatch) parsedData.phone_number = phoneMatch[0].trim();
          
          // Name is usually the first valid line
          const validLines = sectionLines.filter(l => l.length > 0 && l[0].text.length > 2);
          if (validLines.length > 0 && !parsedData.full_name) {
             parsedData.full_name = validLines[0].map(i => i.text).join(' ');
          }
      } else {
          // Normalize the section key to remove accents for easy mapping
          const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          if (normalizedKey.includes('skill') || normalizedKey.includes('competence') || normalizedKey.includes('technolog') || normalizedKey.includes('outil')) {
              parsedData.skills = text;
          } 
          else if (normalizedKey.includes('experience') || normalizedKey.includes('emploi') || normalizedKey.includes('parcours')) {
              parsedData.experience = text;
          } 
          else if (normalizedKey.includes('education') || normalizedKey.includes('formation') || normalizedKey.includes('academic') || normalizedKey.includes('etude')) {
              parsedData.education = text;
          }
      }
  }

  return parsedData;
};