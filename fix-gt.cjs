const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

code = code.replace(
  /<div style={{ width: '100%', marginTop: '5px', fontSize: '16px', fontWeight: 'bold', color: '#000000' }}>/g,
  `<div style={{ width: '100%', marginTop: '5px', fontSize: '16px', fontWeight: 'bold', color: '#000000', backgroundColor: '#ffffff' }}>`
);

code = code.replace(
  /<div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '12px', color: '#000000' }}>/g,
  `<div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '12px', color: '#000000', backgroundColor: '#ffffff' }}>`
);

code = code.replace(
  /<div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '8px', color: '#000000' }}>/g,
  `<div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '8px', color: '#000000', backgroundColor: '#ffffff' }}>`
);

// A5 versions
code = code.replace(
  /<div style={{ width: '100%', marginTop: '5px', fontSize: '14px', fontWeight: 'bold', color: '#000000' }}>/g,
  `<div style={{ width: '100%', marginTop: '5px', fontSize: '14px', fontWeight: 'bold', color: '#000000', backgroundColor: '#ffffff' }}>`
);

code = code.replace(
  /<div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '12px', color: '#000000' }}>/g,
  `<div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '12px', color: '#000000', backgroundColor: '#ffffff' }}>`
);

code = code.replace(
  /<div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '8px', color: '#000000' }}>/g,
  `<div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '8px', color: '#000000', backgroundColor: '#ffffff' }}>`
);


fs.writeFileSync('src/components/POS.tsx', code);
console.log("Patched more colors");
