const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

code = code.replace(
  /<td style={{ padding: '8px 0', textAlign: 'left', wordWrap: 'break-word', whiteSpace: 'normal', maxWidth: '200px' }}>{item.product_name.toUpperCase\(\)}<\/td>/g,
  `<td style={{ padding: '8px 0', textAlign: 'left', wordWrap: 'break-word', whiteSpace: 'normal' }}>{item.product_name.toUpperCase()}</td>`
);

code = code.replace(
  /fontSize: '14px'/g,
  "fontSize: '16px'"
);

code = code.replace(
  /fontSize: '16px'/g,
  "fontSize: '16px'" // Wait, what if I replaced 14px with 16px, now they are all 16px.
);

fs.writeFileSync('src/components/POS.tsx', code);
console.log("Replaced maxWidth 200px and increased font sizes");
