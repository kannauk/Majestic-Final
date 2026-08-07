const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

const printStart = code.indexOf('const handlePrint = (elementId: string, format: string) => {');
const printEnd = code.indexOf('globalPrint(elementId, printStyle + \'\\n\' + resetOuterBoxStyle);') + 'globalPrint(elementId, printStyle + \'\\n\' + resetOuterBoxStyle);\n  };'.length;

if (printStart !== -1 && printEnd !== -1) {
  const newPrintFunc = `const handlePrint = (elementId: string, format: string) => {
    let printStyle = '';
    
    const commonPrintCSS = \`
      @media print {
        html, body {
          background-color: #ffffff !important;
        }
        * {
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          box-shadow: none !important;
          text-shadow: none !important;
          filter: none !important;
          border-color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-family: 'Courier New', Courier, monospace !important;
        }
        img { filter: grayscale(100%) contrast(1000%) !important; max-width: 100px; height: auto; }
        svg { stroke: #000000 !important; fill: none !important; }
        table { border-collapse: collapse !important; width: 100% !important; }
        th, td { 
          background-color: #ffffff !important; 
          color: #000000 !important; 
        }
      }
    \`;

    if (format === 'thermal') {
      printStyle = \`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { width: 80mm; padding: 2mm; margin: 0; }
        }
      \`;
    } else if (format === 'a5') {
      printStyle = \`
        @media print {
          @page { size: 148.5mm 210mm; margin: 5mm; }
          body { width: 148.5mm; padding: 5mm; margin: 0; }
          th { border-bottom: 2px solid #000000 !important; font-size: 14px !important; font-weight: bold !important; }
          td { border-bottom: 1px dashed #000000 !important; font-size: 14px !important; font-weight: bold !important; }
        }
      \`;
    } else if (format === 'a4-half') {
      printStyle = \`
        @media print {
          @page { size: 210mm 148.5mm; margin: 0; }
          body { 
            width: 210mm;
            height: 148.5mm;
            margin: 0; 
            padding: 0;
          }
          #a4-half-invoice-display-area {
            width: 210mm !important;
            height: 148.5mm !important;
            padding: 8mm 12mm !important;
            box-sizing: border-box !important;
          }
        }
      \`;
    } else {
      printStyle = \`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body { padding: 15px; width: 100%; }
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
          padding: 0 !important;
          margin: 0 !important;
        }
      }
    \`;

    globalPrint(elementId, commonPrintCSS + '\\n' + printStyle + '\\n' + resetOuterBoxStyle);
  };`;

  code = code.substring(0, printStart) + newPrintFunc + code.substring(printEnd);
  fs.writeFileSync('src/components/POS.tsx', code);
  console.log('Successfully updated CSS');
} else {
  console.log('Could not find print function');
}
