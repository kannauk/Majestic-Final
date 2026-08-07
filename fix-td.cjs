const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

// Fix A4 half table and A5 table tds
code = code.replace(
  /<td style={{ padding: '8px 0', textAlign: 'right' }}>/g,
  `<td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>`
);

// Fix the bottom area if it has no background color
code = code.replace(
  /<div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#000000' }}>/g,
  `<div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#000000', backgroundColor: '#ffffff' }}>`
);

// Also check A5 if it has 30px margin top
code = code.replace(
  /<div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', color: '#000000', paddingTop: '30px' }}>/g,
  `<div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', color: '#000000', paddingTop: '30px', backgroundColor: '#ffffff' }}>`
);

fs.writeFileSync('src/components/POS.tsx', code);
console.log("Patched td colors");
