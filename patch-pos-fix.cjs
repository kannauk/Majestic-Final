const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

const startIdx = code.indexOf('const handlePrint = (elementId: string, format: string) => {');
const endIdx = code.indexOf('  return (', startIdx);

const newCode = `const handlePrint = (elementId: string, format: string) => {
    let printStyle = '';
    if (format === 'thermal') {
      printStyle = \`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { padding: 3mm; width: 80mm; }
          body { 
             font-family: 'Courier New', Courier, monospace !important; 
             color: #000 !important;
            background: transparent !important;
            font-size: 13px !important;
            line-height: 1.4 !important;
          }
          * {
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border-radius: 0 !important;
          }
          table { width: 100% !important; }
          th {
            font-size: 11px !important;
            font-weight: 900 !important;
            border-bottom: 2px solid #000 !important;
          }
          td {
            font-size: 11px !important;
            border-bottom: 1px dashed #000 !important;
          }
        }
      \`;
    } else if (format === 'a4-half') {
      printStyle = \`
        @media print {
          @page { size: 210mm 148.5mm; margin: 0; }
          body { 
             margin: 0; 
             padding: 0;
            width: 210mm;
            height: 148.5mm;
          }
          
          #a4-half-invoice-display-area {
            width: 210mm !important;
            height: 148.5mm !important;
            padding: 8mm 12mm !important;
            box-sizing: border-box !important;
          }
          * {
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border-radius: 0 !important;
          }
          table {
            border-collapse: collapse !important;
          }
          img { filter: grayscale(100%) contrast(1000%); max-width: 100px; height: auto; }
          svg { stroke: #000 !important; fill: none !important; }
        }
      \`;
    } else {
      printStyle = \`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body { padding: 15px; width: 100%; }

          body { 
             font-family: 'Courier New', Courier, monospace !important; 
             color: #000 !important;
            background: transparent !important;
            font-size: 14px !important;
            line-height: 1.4 !important;
          }
          * {
            font-family: 'Courier New', Courier, monospace !important;
            color: #000 !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border-color: #000 !important;
            border-radius: 0 !important;
          }
          
          /* Dot-Matrix high-impact scaling for carbon-duplicate copying */
          .text-\\\\[7px\\\\], .text-\\\\[7\\\\.5px\\\\], .text-\\\\[8px\\\\], .text-\\\\[8\\\\.5px\\\\], .text-\\\\[9px\\\\] {
            font-size: 12px !important;
            font-weight: bold !important;
          }
          .text-\\\\[10px\\\\], .text-\\\\[10\\\\.5px\\\\], .text-xs, .text-\\\\[11px\\\\], .text-xs * {
            font-size: 14px !important;
            font-weight: bold !important;
          }
          .text-sm, .text-sm * {
            font-size: 15px !important;
            font-weight: bold !important;
          }
          .text-base, .text-base * {
            font-size: 16px !important;
            font-weight: bold !important;
          }
          .text-lg, .text-lg *, .text-xl, .text-xl *, .text-2xl, .text-2xl * {
            font-size: 19px !important;
            font-weight: 900 !important;
          }
          
          table, th, td, div, p, span, h1, h2, h3, h4, h5, h6 {
            color: #000 !important;
            border-color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          th {
            font-size: 12px !important;
            font-weight: 900 !important;
            border-bottom: 2px solid #000 !important;
          }
          td {
            font-size: 12px !important;
            border-bottom: 1px dashed #000 !important;
          }
          img { filter: grayscale(100%) contrast(1000%); max-width: 100px; height: auto; }
          svg { stroke: #000 !important; fill: none !important; }
        }
      \`;
    }

    const resetOuterBoxStyle = \`
      @media print {
        #thermal-receipt-display-area,
        #a4-invoice-display-area,
        #a4-half-invoice-display-area,
        #a5-invoice-display-area {
          border: none !important;
          border-width: 0px !important;
          box-shadow: none !important;
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
        }
      }
    \`;

    globalPrint(elementId, printStyle + '\\n' + resetOuterBoxStyle);
  };

`;

code = code.substring(0, startIdx) + newCode + code.substring(endIdx);
fs.writeFileSync('src/components/POS.tsx', code);
