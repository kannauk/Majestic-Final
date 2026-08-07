const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

const marker = "/* ==========================================================================\n   Sophisticated Dark Theme Overwrites\n   ========================================================================== */";
const idx = code.indexOf(marker);

if (idx !== -1) {
  let firstPart = code.substring(0, idx + marker.length);
  let secondPart = code.substring(idx + marker.length);
  code = firstPart + "\n@media screen {\n" + secondPart + "\n}\n";
  fs.writeFileSync('src/index.css', code);
  console.log("Patched index.css");
} else {
  console.log("Marker not found");
}
