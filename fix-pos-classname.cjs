const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

code = code.replace(
  /<table style=\{\{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Courier New', monospace" \}\}>/g,
  `<table className="invoice-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Courier New', monospace" }}>`
);

code = code.replace(
  /<table className="w-full text-xs text-left text-zinc-600">/g,
  `<table className="invoice-table w-full text-xs text-left text-zinc-600">`
);

fs.writeFileSync('src/components/POS.tsx', code);
console.log("Patched table classnames");
