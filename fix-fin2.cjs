const fs = require('fs');
let code = fs.readFileSync('src/components/Financials.tsx', 'utf8');

code = code.replace(/\\\$\{companyName\}/g, '${companyName}');
fs.writeFileSync('src/components/Financials.tsx', code);
