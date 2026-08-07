const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

const oldCSS = `    } else if (format === 'a4-half') {
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
    }`;

const newCSS = `    } else if (format === 'a4-half') {
      printStyle = \`
        @media print {
          @page { size: 210mm 148.5mm; margin: 0; }
          body { 
             margin: 0; 
             padding: 0;
            width: 210mm;
            height: 148.5mm;
            background-color: #ffffff;
          }
          
          #a4-half-invoice-display-area {
            width: 210mm !important;
            height: 148.5mm !important;
            padding: 8mm 12mm !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: #ffffff !important;
          }
          * {
            font-family: 'Courier New', monospace !important;
            color: #000000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border-radius: 0 !important;
          }
          table {
            border-collapse: collapse !important;
          }
          img { filter: grayscale(100%) contrast(1000%); max-width: 100px; height: auto; }
          svg { stroke: #000000 !important; fill: none !important; }
        }
      \`;
    }`;

code = code.replace(oldCSS, newCSS);
fs.writeFileSync('src/components/POS.tsx', code);
