const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

// The table rules look like this:
/*
/* Override standard tables *\/
table {
  background-color: var(--bg-card) !important;
}
thead, tr[class*="bg-zinc"], tr[class*="bg-slate"],
.bg-zinc-50\/50 {
  background-color: var(--bg-base) !important;
}
td {
  color: var(--text-primary) !important;
  opacity: 0.9;
}
*/

code = code.replace(
  /table\s*\{\s*background-color:\s*var\(--bg-card\)\s*!important;\s*\}/g,
  `table:not(.no-dark-override) { background-color: var(--bg-card) !important; }`
);

code = code.replace(
  /thead,\s*tr\[class\^="bg-zinc"\],\s*tr\[class\^="bg-slate"\],\s*\.bg-zinc-50\\\/50\s*\{\s*background-color:\s*var\(--bg-base\)\s*!important;\s*\}/g,
  `thead:not(.no-dark-override), tr[class^="bg-zinc"], tr[class^="bg-slate"], .bg-zinc-50\\/50 { background-color: var(--bg-base) !important; }`
);

code = code.replace(
  /td\s*\{\s*color:\s*var\(--text-primary\)\s*!important;\s*opacity:\s*0\.9;\s*\}/g,
  `td:not(.no-dark-override) { color: var(--text-primary) !important; opacity: 0.9; }`
);

fs.writeFileSync('src/index.css', code);
console.log("Patched table CSS");
