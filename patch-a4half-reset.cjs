const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

code = code.replace("background: transparent !important;", "background-color: #ffffff !important;");

fs.writeFileSync('src/components/POS.tsx', code);
