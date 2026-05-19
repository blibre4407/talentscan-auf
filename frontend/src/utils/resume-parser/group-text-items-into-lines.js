const BULLET_POINTS = ["•", "▪", "●", "○", "ü", "\u00b7", "\u2022", "\u2023", "\u25e6", "\u25aa", "\u2043", "\u204c", "\u204d", "\u2219"];

export const groupTextItemsIntoLines = (textItems) => {
  const lines = [];
  let line = [];

  for (let item of textItems) {
    if (item.hasEOL) {
      if (item.text.trim() !== "") line.push({ ...item });
      lines.push(line);
      line = [];
    } else if (item.text.trim() !== "") {
      line.push({ ...item });
    }
  }
  if (line.length > 0) lines.push(line);

  const typicalCharWidth = getTypicalCharWidth(lines.flat());
  
  for (let line of lines) {
    for (let i = line.length - 1; i > 0; i--) {
      const currentItem = line[i];
      const leftItem = line[i - 1];
      const leftItemXEnd = leftItem.x + leftItem.width;
      const distance = currentItem.x - leftItemXEnd;
      
      if (distance <= typicalCharWidth) {
        if (shouldAddSpaceBetweenText(leftItem.text, currentItem.text)) {
          leftItem.text += " ";
        }
        leftItem.text += currentItem.text;
        const currentItemXEnd = currentItem.x + currentItem.width;
        leftItem.width = currentItemXEnd - leftItem.x;
        line.splice(i, 1);
      }
    }
  }
  return lines;
};

const shouldAddSpaceBetweenText = (leftText, rightText) => {
  const leftTextEnd = leftText[leftText.length - 1];
  const rightTextStart = rightText[0];
  return [":", ",", "|", ".", ...BULLET_POINTS].includes(leftTextEnd) && rightTextStart !== " " ||
         leftTextEnd !== " " && ["|", ...BULLET_POINTS].includes(rightTextStart);
};

const getTypicalCharWidth = (textItems) => {
  textItems = textItems.filter((item) => item.text.trim() !== "");
  const heightToCount = {};
  let commonHeight = 0, heightMaxCount = 0;
  const fontNameToCount = {};
  let commonFontName = "", fontNameMaxCount = 0;

  for (let item of textItems) {
    const { text, height, fontName } = item;
    heightToCount[height] = (heightToCount[height] || 0) + 1;
    if (heightToCount[height] > heightMaxCount) {
      commonHeight = height;
      heightMaxCount = heightToCount[height];
    }
    fontNameToCount[fontName] = (fontNameToCount[fontName] || 0) + text.length;
    if (fontNameToCount[fontName] > fontNameMaxCount) {
      commonFontName = fontName;
      fontNameMaxCount = fontNameToCount[fontName];
    }
  }

  const commonTextItems = textItems.filter(item => item.fontName === commonFontName && item.height === commonHeight);
  const [totalWidth, numChars] = commonTextItems.reduce((acc, cur) => [acc[0] + cur.width, acc[1] + cur.text.length], [0, 0]);
  return totalWidth / (numChars || 1); // Avoid division by zero
};