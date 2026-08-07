import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Reads a PDF File object and extracts structured text lines.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      disableFontFace: true,
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      let lastY: number | null = null;
      let pageLines: string[] = [];
      let currentLine = '';

      for (const item of textContent.items as any[]) {
        if ('str' in item) {
          const strVal = item.str;
          if (!strVal) continue;

          // Check Y coordinate for line break
          const y = item.transform ? item.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
            if (currentLine.trim()) {
              pageLines.push(currentLine.trim());
            }
            currentLine = strVal;
          } else {
            currentLine += (currentLine ? ' ' : '') + strVal;
          }
          if (y !== null) lastY = y;
        }
      }

      if (currentLine.trim()) {
        pageLines.push(currentLine.trim());
      }

      fullText += pageLines.join('\n') + '\n';
    }

    return fullText;
  } catch (err) {
    console.error('PDF parsing error:', err);
    // Fallback simple text reader if PDF parsing fails
    const rawText = await file.text();
    return rawText;
  }
}

/**
 * Converts extracted text lines (e.g. from PDF or CSV) into a 2D grid array of string tokens.
 * Handles comma, tab, or multi-space delimiters.
 */
export function convertTextToGrid(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  const grid: string[][] = [];

  for (const line of lines) {
    // If comma or tab separated
    if (line.includes(',') || line.includes('\t')) {
      const tokens = line.split(/,|\t/).map(t => t.trim().replace(/^["']|["']$/g, ''));
      grid.push(tokens);
    } else {
      // Split by 2 or more spaces or vertical bars
      const tokens = line.split(/\s{2,}|\|/).map(t => t.trim());
      grid.push(tokens);
    }
  }

  return grid;
}
