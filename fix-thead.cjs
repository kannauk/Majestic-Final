const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

code = code.replace(
  /<thead>/g,
  `<thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>`
);
code = code.replace(
  /<tbody>/g,
  `<tbody style={{ backgroundColor: '#ffffff', color: '#000000' }}>`
);

fs.writeFileSync('src/components/POS.tsx', code);
console.log("Patched thead and tbody colors");
