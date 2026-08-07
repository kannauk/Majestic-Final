const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

const printStylesRegex = /const getPrintStyle = \(\) => \{[\s\S]*?globalPrint\(elementId/m;
const match = code.match(printStylesRegex);

if (match) {
  // Let's replace the whole getPrintStyle function
  const newFunc = `const getPrintStyle = () => {
    let printStyle = '';
    const format = showPrintModal;

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
        th { border-bottom: 2px solid #000000 !important; }
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
          @page { size: A5 portrait; margin: 5mm; }
          body { width: 148mm; padding: 5mm; margin: 0; }
          td { border-bottom: 1px dashed #000000 !important; }
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

    return commonPrintCSS + '\\n' + printStyle + '\\n' + resetOuterBoxStyle;
  };

  const handlePrint = (elementId: string, format: string) => {
    const printStyle = getPrintStyle();
    globalPrint`;
    
  // We need to carefully replace the logic inside handlePrint as well, since getPrintStyle didn't exist
  // Let's just do a regex replace on the print function
}
