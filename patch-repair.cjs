const fs = require('fs');
let code = fs.readFileSync('src/components/RepairCenter.tsx', 'utf8');

code = code.replace(/your Majestic Computers repair ticket/g, 'your ${setting.company_name} repair ticket');
code = code.replace(/any Majestic Computers database branches/g, 'any {setting.company_name} database branches');
code = code.replace(/Data Indemnity: Majestic Computers shall/g, 'Data Indemnity: {setting.company_name} shall');

fs.writeFileSync('src/components/RepairCenter.tsx', code);
