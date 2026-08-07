const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

// For A4 Half:
// <th> tags
code = code.replace(
  /<th style={{ padding: '8px 0', textAlign: 'left', width: '6%' }}>S.N.<\/th>/g,
  `<th style={{ padding: '8px 0', textAlign: 'left', width: '6%', backgroundColor: '#ffffff', color: '#000000' }}>S.N.</th>`
);
code = code.replace(
  /<th style={{ padding: '8px 0', textAlign: 'left', width: '49%' }}>Description of Goods<\/th>/g,
  `<th style={{ padding: '8px 0', textAlign: 'left', width: '49%', backgroundColor: '#ffffff', color: '#000000' }}>Description of Goods</th>`
);
code = code.replace(
  /<th style={{ padding: '8px 0', textAlign: 'right', width: '10%' }}>Qty.<\/th>/g,
  `<th style={{ padding: '8px 0', textAlign: 'right', width: '10%', backgroundColor: '#ffffff', color: '#000000' }}>Qty.</th>`
);
code = code.replace(
  /<th style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '8px', width: '10%' }}>Unit<\/th>/g,
  `<th style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '8px', width: '10%', backgroundColor: '#ffffff', color: '#000000' }}>Unit</th>`
);
code = code.replace(
  /<th style={{ padding: '8px 0', textAlign: 'right', width: '10%' }}>Price<\/th>/g,
  `<th style={{ padding: '8px 0', textAlign: 'right', width: '10%', backgroundColor: '#ffffff', color: '#000000' }}>Price</th>`
);
code = code.replace(
  /<th style={{ padding: '8px 0', textAlign: 'right', width: '15%' }}>Amount\(Rs.\)<\/th>/g,
  `<th style={{ padding: '8px 0', textAlign: 'right', width: '15%', backgroundColor: '#ffffff', color: '#000000' }}>Amount(Rs.)</th>`
);

// <td> tags for A4 Half and A5
code = code.replace(
  /<td style={{ padding: '8px 0', textAlign: 'left' }}>{index \+ 1}.<\/td>/g,
  `<td style={{ padding: '8px 0', textAlign: 'left', backgroundColor: '#ffffff', color: '#000000' }}>{index + 1}.</td>`
);
code = code.replace(
  /<td style={{ padding: '8px 0', textAlign: 'left', wordWrap: 'break-word', whiteSpace: 'normal' }}>{item.product_name.toUpperCase\(\)}<\/td>/g,
  `<td style={{ padding: '8px 0', textAlign: 'left', wordWrap: 'break-word', whiteSpace: 'normal', backgroundColor: '#ffffff', color: '#000000' }}>{item.product_name.toUpperCase()}</td>`
);
code = code.replace(
  /<td style={{ padding: '8px 0', textAlign: 'right' }}>{item.quantity.toFixed\(2\)}<\/td>/g,
  `<td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>{item.quantity.toFixed(2)}</td>`
);
code = code.replace(
  /<td style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '8px' }}>Pcs.<\/td>/g,
  `<td style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '8px', backgroundColor: '#ffffff', color: '#000000' }}>Pcs.</td>`
);
code = code.replace(
  /<td style={{ padding: '8px 0', textAlign: 'right' }}>\s*\{\(item.unit_price - item.discount\).toFixed\(2\).replace\(\/\\B\(\?=\\d\{3\}\)\+\(\?\!\\d\)\)\/g, ","\)\}\s*<\/td>/g,
  `<td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>\n                                {(item.unit_price - item.discount).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",")}\n                              </td>`
);
code = code.replace(
  /<td style={{ padding: '8px 0', textAlign: 'right' }}>\s*\{\(\(item.unit_price - item.discount\) \* item.quantity\).toFixed\(2\).replace\(\/\\B\(\?=\\d\{3\}\)\+\(\?\!\\d\)\)\/g, ","\)\}\s*<\/td>/g,
  `<td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>\n                                {((item.unit_price - item.discount) * item.quantity).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",")}\n                              </td>`
);


fs.writeFileSync('src/components/POS.tsx', code);
console.log("Patched POS table colors");
