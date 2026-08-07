const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code = code.replace(
  /table:not\(\.no-dark-override\) \{ background-color: var\(--bg-card\) !important; \}/g,
  `table:not(.invoice-table) { background-color: var(--bg-card) !important; }`
);

code = code.replace(
  /thead, tr\[class\*="bg-zinc"\], tr\[class\*="bg-slate"\],\n\.bg-zinc-50\\\/50 \{\n  background-color: var\(--bg-base\) !important;\n\}/g,
  `thead:not(.invoice-table thead), tr[class*="bg-zinc"], tr[class*="bg-slate"],\n.bg-zinc-50\\/50 {\n  background-color: var(--bg-base) !important;\n}`
);

code = code.replace(
  /td:not\(\.no-dark-override\) \{ color: var\(--text-primary\) !important; opacity: 0\.9; \}/g,
  `td:not(.invoice-table td) { color: var(--text-primary) !important; opacity: 0.9; }`
);

// Add global print preview resets at the end of the file
const printPreviewCSS = `
/* Global Print Preview Exceptions */
.invoice-table {
  background-color: #ffffff !important;
}
.invoice-table thead {
  background-color: #ffffff !important;
}
.invoice-table td, .invoice-table th {
  color: #000000 !important;
}
.invoice-table tbody, .invoice-table tr {
  background-color: #ffffff !important;
  color: #000000 !important;
}
`;

fs.writeFileSync('src/index.css', code + printPreviewCSS);
console.log("Patched table CSS 2");
