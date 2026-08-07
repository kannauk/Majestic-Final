import * as XLSX from 'xlsx';

/**
 * Advanced Excel-Compatible CSV Import & Export Utilities
 * This provides robust escaping, parsing, and download of data spreadsheets
 * without any external library footprint or peer-dependency issues.
 */

/**
 * Escapes a cell value to be safe for Excel/CSV formatting.
 * Handles commas, double-quotes, and newlines correctly.
 */
export function escapeCSVCell(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  
  // Replace double quotes with two double quotes
  // If the cell contains comma, double-quote, or newline, wrap it in double quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports an array of objects/arrays to a downloadable CSV file.
 * Adds UTF-8 Byte Order Mark (BOM) so Microsoft Excel opens it with correct encoding (essential for non-ASCII characters).
 */
export function exportToCSV(
  headers: string[],
  rows: any[][],
  filename: string
) {
  // Add UTF-8 BOM
  let csvContent = '\uFEFF';
  
  // Add headers
  csvContent += headers.map(escapeCSVCell).join(',') + '\n';
  
  // Add rows
  rows.forEach(row => {
    csvContent += row.map(escapeCSVCell).join(',') + '\n';
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * A highly robust CSV parser that correctly handles quoted values,
 * double-quotes escape sequences, and multi-line cells.
 */
export function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped double-quote
          cell += '"';
          i++; // Skip next quote
        } else {
          // End of quoted cell
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\r' || char === '\n') {
        row.push(cell.trim());
        cell = '';
        if (row.length > 0 || (row.length === 1 && row[0] !== '')) {
          result.push(row);
        }
        row = [];
        // Skip subsequent newline character for Windows line-endings (\r\n)
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        cell += char;
      }
    }
  }

  // Handle last cell if there was no trailing newline
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    result.push(row);
  }

  return result;
}

/**
 * Parses binary Excel files (.xlsx, .xls) into a clean 2D string array.
 */
export function parseExcelFile(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          resolve([]);
          return;
        }
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
        const stringRows = rows.map(row => 
          Array.isArray(row) 
            ? row.map(cell => String(cell ?? '')) 
            : []
        );
        resolve(stringRows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
