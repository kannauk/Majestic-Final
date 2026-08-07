const fs = require('fs');
let code = fs.readFileSync('src/components/Financials.tsx', 'utf8');

// Remove line 1
code = code.replace(/^const \[companyName.*\n/, '');

// Add it back after Financials function definition
const stateStart = code.indexOf(`const [activeSection, setActiveSection]`);
code = code.substring(0, stateStart) + `const [companyName, setCompanyName] = useState('MAJESTIC COMPUTERS');\n  ` + code.substring(stateStart);

// Let's also fix the literal ${companyName} issue.
// Ah, earlier I did: code = code.replace(/MAJESTIC COMPUTERS/g, '${companyName}');
// And I used template literals in the script without escaping it properly.
// Let's change ${companyName} back to \${companyName} where it was incorrectly replaced
code = code.replace(/\$\{companyName\}/g, '\\${companyName}');
// Wait, my replacement in Node.js for `${companyName}` without escaping inside a backtick string in the JS script would evaluate it. But it was in single quotes `'${companyName}'` in the script. So it actually wrote the literal string `${companyName}` into the file. That is correct if it is inside a template literal.
// Let's check how it's used.
fs.writeFileSync('src/components/Financials.tsx', code);
