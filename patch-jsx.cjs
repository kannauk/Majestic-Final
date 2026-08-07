const fs = require('fs');
let code = fs.readFileSync('src/components/POS.tsx', 'utf8');

const oldJsxStart = code.indexOf("{showPrintModal === 'a4-half' && (");
const oldJsxEnd = code.indexOf("{showPrintModal === 'a5' && (");

if (oldJsxStart === -1 || oldJsxEnd === -1) {
  console.error('Could not find JSX markers');
  process.exit(1);
}

const newJsx = `{showPrintModal === 'a4-half' && (
                /* Corporate A4 Half Sheet (Landscape) styled layout matching majestic computers format */
                <div 
                  id="a4-half-invoice-display-area"
                  style={{
                    fontFamily: "'Courier New', monospace",
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    width: '210mm',
                    minHeight: '148.5mm',
                    padding: '8mm 12mm',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ width: '100%' }}>
                    {/* Top Header */}
                    <div style={{ textAlign: 'center', lineHeight: '1.4' }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{"<< RETAIL INVOICE >>"}</div>
                      <div style={{ fontSize: '22px', fontWeight: '900', margin: '5px 0', color: '#000000' }}>
                        {companySetting.company_name}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        {invoiceBranchInfo.address}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                        Tel: {invoiceBranchInfo.phone}
                      </div>
                    </div>

                    {/* Customer and Invoice Details Grid */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold', lineHeight: '1.5', color: '#000000' }}>
                      <div style={{ textAlign: 'left' }}>
                        <div>Customer Details:</div>
                        <div>{selectedInvoice.customer_name || 'Cash'}</div>
                        {selectedInvoice.customer_phone && (
                          <div>Tel: {selectedInvoice.customer_phone}</div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <span>Invoice No:</span>
                          <span>{selectedInvoice.invoice_no}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <span>Date:</span>
                          <span>
                            {(() => {
                              try {
                                const d = new Date(selectedInvoice.created_at);
                                const day = String(d.getDate()).padStart(2, '0');
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const year = d.getFullYear();
                                return \`\${day}-\${month}-\${year}\`;
                              } catch (e) {
                                return selectedInvoice.created_at.split('T')[0];
                              }
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    <div style={{ marginTop: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Courier New', monospace" }}>
                        <thead>
                          <tr style={{ borderTop: '2px solid black', borderBottom: '2px solid black', fontSize: '14px', fontWeight: 'bold', color: '#000000' }}>
                            <th style={{ padding: '8px 0', textAlign: 'left', width: '6%' }}>S.N.</th>
                            <th style={{ padding: '8px 0', textAlign: 'left', width: '49%' }}>Description of Goods</th>
                            <th style={{ padding: '8px 0', textAlign: 'right', width: '10%' }}>Qty.</th>
                            <th style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '8px', width: '10%' }}>Unit</th>
                            <th style={{ padding: '8px 0', textAlign: 'right', width: '10%' }}>Price</th>
                            <th style={{ padding: '8px 0', textAlign: 'right', width: '15%' }}>Amount(Rs.)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedInvoice?.invoice_items || []).map((item, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid black', fontSize: '14px', fontWeight: 'bold', color: '#000000', verticalAlign: 'top', lineHeight: '1.4' }}>
                              <td style={{ padding: '8px 0', textAlign: 'left' }}>{index + 1}.</td>
                              <td style={{ padding: '8px 0', textAlign: 'left', wordWrap: 'break-word', whiteSpace: 'normal', maxWidth: '200px' }}>{item.product_name.toUpperCase()}</td>
                              <td style={{ padding: '8px 0', textAlign: 'right' }}>{item.quantity.toFixed(2)}</td>
                              <td style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '8px' }}>Pcs.</td>
                              <td style={{ padding: '8px 0', textAlign: 'right' }}>
                                {(item.unit_price - item.discount).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",")}
                              </td>
                              <td style={{ padding: '8px 0', textAlign: 'right' }}>
                                {((item.unit_price - item.discount) * item.quantity).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Grand Total Area */}
                    <div style={{ width: '100%', marginTop: '5px', fontSize: '14px', fontWeight: 'bold', color: '#000000' }}>
                      <div style={{ borderTop: '3px solid black', paddingTop: '10px', paddingBottom: '10px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div style={{ width: '55%', textAlign: 'right', paddingRight: '20px', fontSize: '18px', fontWeight: '900' }}>Grand Total</div>
                        
                        <div style={{ width: '10%', textAlign: 'right', borderBottom: '2px solid black', paddingBottom: '2px', fontSize: '16px' }}>
                          {(() => {
                            const totQty = (selectedInvoice?.invoice_items || []).reduce((acc, item) => acc + item.quantity, 0);
                            return totQty.toFixed(2);
                          })()}
                        </div>
                        
                        <div style={{ width: '20%' }}></div>
                        
                        <div style={{ width: '15%', textAlign: 'right', borderBottom: '4px double black', paddingBottom: '2px', fontSize: '18px', fontWeight: '900' }}>
                          {selectedInvoice.total.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",")}
                        </div>
                      </div>
                    </div>

                    {/* Amount in words */}
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '12px', color: '#000000' }}>
                      <div>LKR {convertNumberToWords(selectedInvoice.total)} Only</div>
                    </div>

                    {selectedInvoice.notes && (
                      <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '8px', color: '#000000' }}>
                        <div>Note: {selectedInvoice.notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Area - Terms & Conditions | Receiver Signature */}
                  <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', color: '#000000' }}>
                    <div style={{ width: '50%' }}>
                      <div style={{ textDecoration: 'underline', marginBottom: '8px' }}>Terms & Conditions</div>
                      <ul style={{ listStyleType: 'none', padding: 0, margin: 0, lineHeight: '1.5' }}>
                        <li>Once Goods Sold Cash Not Refund.</li>
                        <li>Acceseries Warranty will be claim with in 48 hours.</li>
                      </ul>
                    </div>
                    <div style={{ width: '50%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: '15px' }}>
                      <div style={{ textAlign: 'center', width: '45%' }}>
                        <div style={{ borderTop: '2px dashed black', width: '100%', paddingTop: '5px' }}>
                          Receiver's Signature
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', width: '45%' }}>
                        <div style={{ borderTop: '2px dashed black', width: '100%', paddingTop: '5px' }}>
                          Company Signature
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              `;

code = code.substring(0, oldJsxStart) + newJsx + code.substring(oldJsxEnd);

fs.writeFileSync('src/components/POS.tsx', code);
