import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { 
  Printer, MessageCircle, Download, Mail, X, Image as ImageIcon,
  CheckCircle, AlertCircle, RefreshCcw
} from 'lucide-react';
import { Quotation } from '../types';
import { convertNumberToWords } from '../utils/numberToWords';

interface QuotationPrintModalProps {
  quotation: Quotation;
  companySetting: any;
  branchInfo: {
    address: string;
    phone: string;
  };
  onClose: () => void;
  onPrint: (elementId: string, format: string, orientation: string) => void;
  onShareWhatsApp?: (quotation: Quotation) => void;
}

export default function QuotationPrintModal({
  quotation,
  companySetting,
  branchInfo,
  onClose,
  onPrint,
  onShareWhatsApp,
}: QuotationPrintModalProps) {
  const [printFormat, setPrintFormat] = useState<'a4-half' | 'thermal' | 'a4' | 'a5'>('a4-half');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);

  const getElementId = () => {
    switch (printFormat) {
      case 'thermal':
        return 'thermal-quotation-display-area';
      case 'a4':
        return 'a4-quotation-display-area';
      case 'a5':
        return 'a5-quotation-display-area';
      case 'a4-half':
      default:
        return 'a4-half-quotation-display-area';
    }
  };

  const handleTriggerPrint = () => {
    const elementId = getElementId();
    onPrint(elementId, printFormat, printOrientation);
  };

  const handleDownloadPNG = async () => {
    const elementId = getElementId();
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      setIsDownloadingImage(true);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Quotation-${quotation.quotation_no}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to export quotation image:', err);
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateStr.split('T')[0];
    }
  };

  const totalQty = (quotation.quotation_items || []).reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-2xl w-full space-y-4 my-auto">
        {/* Header and Controls */}
        <div className="flex flex-col space-y-2 border-b border-zinc-100 pb-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-extrabold text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
              <span>📄</span>
              Sales Quotation Print & Transmit
            </span>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-900 text-xs font-semibold p-1 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Format Tabs */}
          <div className="flex flex-wrap gap-1 bg-zinc-100 p-1 rounded-xl">
            {[
              { key: 'a4-half', label: 'A4 Half (Landscape)' },
              { key: 'thermal', label: '80mm Thermal' },
              { key: 'a4', label: 'Standard A4' },
              { key: 'a5', label: 'A5 Portrait' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPrintFormat(tab.key as any)}
                className={`flex-1 text-[11px] font-bold py-1 px-2 rounded-lg transition-all text-center whitespace-nowrap ${
                  printFormat === tab.key
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Feed Orientation */}
          <div className="flex items-center justify-between pt-1 px-1">
            <span className="text-[10px] font-semibold text-zinc-500">Feed Orientation:</span>
            <div className="flex gap-1 bg-zinc-100 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setPrintOrientation('portrait')}
                className={`px-2 py-0.5 rounded transition-all ${
                  printOrientation === 'portrait' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                }`}
                title="Recommended for continuous paper / tractor feed - prevents 90 degree sideways rotation"
              >
                Standard Feed (Portrait)
              </button>
              <button
                type="button"
                onClick={() => setPrintOrientation('landscape')}
                className={`px-2 py-0.5 rounded transition-all ${
                  printOrientation === 'landscape' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                }`}
                title="Rotates page 90 degrees for landscape printer trays"
              >
                Landscape (Rotated 90°)
              </button>
            </div>
          </div>

          {printFormat === 'a4-half' && (
            <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-2 text-[10px] text-amber-900 leading-tight">
              <strong>💡 Continuous Dot Matrix Paper Tip:</strong> <em>Standard Feed (Portrait)</em> ensures crisp, unrotated alignment on 8.5&quot; x 5.5&quot; continuous tractor paper. In browser print dialog, set Margins to <em>&quot;None&quot;</em>.
            </div>
          )}
        </div>

        {/* Dynamic Visual Formats Preview Container */}
        <div className="border border-zinc-200 rounded-2xl p-4 overflow-y-auto max-h-[420px] bg-zinc-50 flex justify-center">
          {/* Format 1: A4 Half (Landscape) */}
          {printFormat === 'a4-half' && (
            <div
              id="a4-half-quotation-display-area"
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
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{'<< SALES QUOTATION >>'}</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', margin: '5px 0', color: '#000000' }}>
                    {companySetting?.company_name || 'MAJESTIC COMPUTERS & SERVICES'}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {branchInfo.address}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    Tel: {branchInfo.phone}
                  </div>
                </div>

                {/* Customer and Quotation Details Grid */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', marginBottom: '10px', fontSize: '16px', fontWeight: 'bold', lineHeight: '1.5', color: '#000000' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div>Customer Details:</div>
                    <div>{quotation.customer_name || 'Valued Client'}</div>
                    {quotation.customer_phone && (
                      <div>Tel: {quotation.customer_phone}</div>
                    )}
                    {quotation.customer_email && (
                      <div>Email: {quotation.customer_email}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <span>Quotation No:</span>
                      <span>{quotation.quotation_no}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <span>Date:</span>
                      <span>{formatDate(quotation.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <span>Valid Until:</span>
                      <span>{formatDate(quotation.valid_until || '')}</span>
                    </div>
                  </div>
                </div>

                {/* Products Table */}
                <div style={{ marginTop: '10px' }}>
                  <table className="invoice-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Courier New', monospace" }}>
                    <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      <tr style={{ borderTop: '2px solid black', borderBottom: '2px solid black', fontSize: '16px', fontWeight: 'bold', color: '#000000' }}>
                        <th style={{ padding: '8px 0', textAlign: 'left', width: '6%', backgroundColor: '#ffffff', color: '#000000' }}>S.N.</th>
                        <th style={{ padding: '8px 0', textAlign: 'left', width: '49%', backgroundColor: '#ffffff', color: '#000000' }}>Description of Goods</th>
                        <th style={{ padding: '8px 0', textAlign: 'right', width: '10%', backgroundColor: '#ffffff', color: '#000000' }}>Qty.</th>
                        <th style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '8px', width: '10%', backgroundColor: '#ffffff', color: '#000000' }}>Unit</th>
                        <th style={{ padding: '8px 0', textAlign: 'right', width: '10%', backgroundColor: '#ffffff', color: '#000000' }}>Price</th>
                        <th style={{ padding: '8px 0', textAlign: 'right', width: '15%', backgroundColor: '#ffffff', color: '#000000' }}>Amount(Rs.)</th>
                      </tr>
                    </thead>
                    <tbody style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      {(quotation.quotation_items || []).map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid black', fontSize: '16px', fontWeight: 'bold', color: '#000000', verticalAlign: 'top', lineHeight: '1.4' }}>
                          <td style={{ padding: '8px 0', textAlign: 'left', backgroundColor: '#ffffff', color: '#000000' }}>{index + 1}.</td>
                          <td style={{ padding: '8px 0', textAlign: 'left', wordWrap: 'break-word', whiteSpace: 'normal', backgroundColor: '#ffffff', color: '#000000' }}>{item.product_name.toUpperCase()}</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>{item.quantity.toFixed(2)}</td>
                          <td style={{ padding: '8px 0', textAlign: 'left', paddingLeft: '8px', backgroundColor: '#ffffff', color: '#000000' }}>Pcs.</td>
                          <td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>
                            {(item.unit_price - item.discount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </td>
                          <td style={{ padding: '8px 0', textAlign: 'right', backgroundColor: '#ffffff', color: '#000000' }}>
                            {((item.unit_price - item.discount) * item.quantity).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Grand Total Area */}
                <div style={{ width: '100%', marginTop: '5px', fontSize: '16px', fontWeight: 'bold', color: '#000000', backgroundColor: '#ffffff' }}>
                  <div style={{ borderTop: '3px solid black', paddingTop: '10px', paddingBottom: '10px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <div style={{ width: '55%', textAlign: 'right', paddingRight: '20px', fontSize: '18px', fontWeight: '900' }}>Grand Total</div>
                    
                    <div style={{ width: '10%', textAlign: 'right', borderBottom: '2px solid black', paddingBottom: '2px', fontSize: '16px' }}>
                      {totalQty.toFixed(2)}
                    </div>
                    
                    <div style={{ width: '20%' }}></div>
                    
                    <div style={{ width: '15%', textAlign: 'right', borderBottom: '4px double black', paddingBottom: '2px', fontSize: '18px', fontWeight: '900' }}>
                      {quotation.total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    </div>
                  </div>
                </div>

                {/* Amount in words */}
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '12px', color: '#000000', backgroundColor: '#ffffff' }}>
                  <div>LKR {convertNumberToWords(quotation.total)} Only</div>
                </div>

                {quotation.notes && (
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '8px', color: '#000000', backgroundColor: '#ffffff' }}>
                    <div>Quotation Scope / Note: {quotation.notes}</div>
                  </div>
                )}
              </div>

              {/* Bottom Area - Terms & Conditions | Receiver Signature */}
              <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', color: '#000000', backgroundColor: '#ffffff' }}>
                <div style={{ width: '50%' }}>
                  <div style={{ textDecoration: 'underline', marginBottom: '8px' }}>Terms & Conditions</div>
                  <ul style={{ listStyleType: 'none', padding: 0, margin: 0, lineHeight: '1.5' }}>
                    <li>1. Prices are valid until {formatDate(quotation.valid_until || '')}.</li>
                    <li>2. 1-Year Comprehensive Hardware Warranty applies upon purchase.</li>
                    <li>3. Goods subject to showroom stock availability on confirmation.</li>
                  </ul>
                </div>
                <div style={{ width: '50%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: '15px' }}>
                  <div style={{ textAlign: 'center', width: '45%' }}>
                    <div style={{ borderTop: '2px dashed black', width: '100%', paddingTop: '5px' }}>
                      Prepared By
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', width: '45%' }}>
                    <div style={{ borderTop: '2px dashed black', width: '100%', paddingTop: '5px' }}>
                      Customer Acceptance
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Format 2: Standard A4 */}
          {printFormat === 'a4' && (
            <div className="w-full bg-white p-6 border border-zinc-300 shadow-sm text-xs leading-relaxed text-zinc-800 flex flex-col space-y-4" id="a4-quotation-display-area">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-extrabold text-zinc-900 uppercase tracking-tight">
                    {companySetting?.company_name || 'MAJESTIC COMPUTERS & SERVICES'}
                  </h3>
                  <p className="text-[9px] text-zinc-500 mt-1">{quotation.branch_name}</p>
                  <p className="text-[9px] text-zinc-500">{branchInfo.address}</p>
                  <p className="text-[9px] text-zinc-505">Tel: {branchInfo.phone}</p>
                </div>
                <div className="text-right">
                  <h4 className="text-amber-600 font-black uppercase text-lg leading-none">SALES QUOTATION</h4>
                  <p className="font-mono text-xs font-semibold text-zinc-650 mt-2">No: {quotation.quotation_no}</p>
                  <p className="text-[9px] text-zinc-505">Date: {formatDate(quotation.created_at)}</p>
                  <p className="text-[9px] text-amber-700 font-bold">Valid Until: {formatDate(quotation.valid_until || '')}</p>
                </div>
              </div>

              <div className="border-t border-b border-zinc-150 py-3 grid grid-cols-2 gap-4 text-[10px]">
                <div>
                  <div className="font-bold text-zinc-500 uppercase tracking-widest text-[8px] mb-1">Quotation For:</div>
                  <p className="text-zinc-900 font-bold text-xs">{quotation.customer_name}</p>
                  {quotation.customer_phone && <p className="text-zinc-550 mt-0.5">Mobile: {quotation.customer_phone}</p>}
                  {quotation.customer_email && <p className="text-zinc-550">Email: {quotation.customer_email}</p>}
                </div>
                <div className="text-right">
                  <div className="font-bold text-zinc-500 uppercase tracking-widest text-[8px] mb-1">Quoted By:</div>
                  <p className="text-zinc-900 font-semibold">{quotation.created_by_name || 'Showroom Sales'}</p>
                  <p className="text-zinc-500 text-[9px]">Status: {quotation.status.toUpperCase()}</p>
                </div>
              </div>

              <table className="invoice-table w-full text-xs text-left text-zinc-600">
                <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                  <tr className="border-b-2 border-zinc-200 font-bold text-[9px] uppercase text-zinc-500">
                    <th className="pb-1.5 text-left">SKU Code</th>
                    <th className="pb-1.5 text-left">Product Specification</th>
                    <th className="pb-1.5 text-center">Unit Price</th>
                    <th className="pb-1.5 text-center">Qty</th>
                    <th className="pb-1.5 text-right">Total (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {(quotation.quotation_items || []).map((item, index) => (
                    <tr key={index} className="text-[10.5px]">
                      <td className="py-2.5 font-mono text-zinc-900">{item.sku}</td>
                      <td className="py-2.5 font-semibold text-zinc-850">{item.product_name}</td>
                      <td className="py-2.5 text-center">Rs. {item.unit_price.toLocaleString()}</td>
                      <td className="py-2.5 text-center font-bold">{item.quantity}</td>
                      <td className="py-2.5 text-right font-bold text-zinc-905">
                        Rs. {((item.unit_price - item.discount) * item.quantity).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between pt-4">
                <div className="max-w-[50%] text-[9px] text-zinc-500">
                  <p className="font-bold uppercase tracking-wider text-zinc-650 text-[8px] mb-1">Terms & Conditions:</p>
                  <p className="whitespace-pre-line">{quotation.terms_conditions || '1. Prices valid for 14 days.\n2. Standard distributor hardware warranty.\n3. Goods subject to availability.'}</p>
                  {quotation.notes && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-900 text-left">
                      <p className="font-bold uppercase text-[8px] tracking-wider mb-0.5">Quotation Notes:</p>
                      <p>{quotation.notes}</p>
                    </div>
                  )}
                </div>
                <div className="w-52 text-right space-y-1.5 text-[11px] font-semibold text-zinc-605">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>Rs. {quotation.subtotal.toLocaleString()}</span>
                  </div>
                  {quotation.discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Special Discount:</span>
                      <span>-Rs. {quotation.discount.toLocaleString()}</span>
                    </div>
                  )}
                  {quotation.tax > 0 && (
                    <div className="flex justify-between">
                      <span>Sales Tax:</span>
                      <span>Rs. {quotation.tax.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-xs text-zinc-900 border-t-2 border-zinc-200 pt-1.5">
                    <span>Grand Total:</span>
                    <span>Rs. {quotation.total.toLocaleString()} LKR</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono italic pt-1">
                    ({convertNumberToWords(quotation.total)} Only)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Format 3: 80mm Thermal */}
          {printFormat === 'thermal' && (
            <div className="w-[80mm] bg-white p-4 border border-zinc-300 shadow-sm text-[11px] font-mono leading-relaxed text-zinc-805 flex flex-col items-center select-none" id="thermal-quotation-display-area">
              <div className="font-extrabold text-center uppercase tracking-wide text-xs">{companySetting?.company_name || 'MAJESTIC COMPUTERS'}</div>
              <div className="text-center text-[10px] text-zinc-500 mt-0.5">{quotation.branch_name}</div>
              <div className="text-center text-[9px] text-zinc-500">{branchInfo.address}</div>
              <div className="text-center text-[9px] text-zinc-500">Tel: {branchInfo.phone}</div>
              <div className="w-full border-t border-dashed border-zinc-350 my-2" />
              
              <div className="w-full space-y-0.5 text-[9px]">
                <div className="font-bold text-center text-[10px] uppercase text-zinc-800">** PRICE QUOTATION **</div>
                <div><strong>Quote No:</strong> {quotation.quotation_no}</div>
                <div><strong>Date:</strong> {formatDate(quotation.created_at)}</div>
                <div><strong>Valid Until:</strong> {formatDate(quotation.valid_until || '')}</div>
                <div><strong>Client:</strong> {quotation.customer_name}</div>
              </div>

              <div className="w-full border-t border-dashed border-zinc-350 my-2" />
              
              <table className="w-full text-[9px]">
                <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left font-bold pb-1">Item</th>
                    <th className="text-center font-bold pb-1">Qty</th>
                    <th className="text-right font-bold pb-1">Price</th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                  {(quotation.quotation_items || []).map((item, index) => (
                    <tr key={index} className="border-b border-zinc-100 mt-1">
                      <td className="py-1">
                        <div>{item.product_name}</div>
                        {item.discount > 0 && <div className="text-[8px] text-zinc-500">-Rs. {item.discount} disc</div>}
                      </td>
                      <td className="py-1 text-center">{item.quantity}</td>
                      <td className="py-1 text-right">Rs. {((item.unit_price - item.discount) * item.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="w-full border-t border-dashed border-zinc-350 my-2" />

              <div className="w-full space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs. {quotation.subtotal.toLocaleString()}</span>
                </div>
                {quotation.discount > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Discount:</span>
                    <span>-Rs. {quotation.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xs border-t border-zinc-200 pt-1.5">
                  <span>Quoted Total:</span>
                  <span>Rs. {quotation.total.toLocaleString()}</span>
                </div>
              </div>

              {quotation.notes && (
                <>
                  <div className="w-full border-t border-dashed border-zinc-350 my-2" />
                  <div className="w-full text-left text-[9px] bg-zinc-50 p-1.5 rounded">
                    <strong>Note:</strong> {quotation.notes}
                  </div>
                </>
              )}

              <div className="w-full border-t border-dashed border-zinc-300 my-3" />
              <div className="text-[9px] text-center font-bold">ESTIMATE ONLY - PRICES VALID 14 DAYS</div>
              <div className="text-[9px] text-center italic mt-1 text-zinc-455">&quot;Majestic Service First&quot;</div>
            </div>
          )}

          {/* Format 4: A5 Portrait */}
          {printFormat === 'a5' && (
            <div
              id="a5-quotation-display-area"
              style={{
                fontFamily: "'Courier New', monospace",
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                color: '#000000',
                width: '148.5mm',
                minHeight: '210mm',
                padding: '6mm',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ width: '100%' }}>
                {/* Top Header */}
                <div style={{ textAlign: 'center', lineHeight: '1.4' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{'<< SALES QUOTATION >>'}</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', margin: '4px 0', color: '#000000' }}>
                    {companySetting?.company_name || 'MAJESTIC COMPUTERS'}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    {branchInfo.address}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    Tel: {branchInfo.phone}
                  </div>
                </div>

                {/* Customer and Quotation Details */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', lineHeight: '1.4', color: '#000000' }}>
                  <div>
                    <div>Client: {quotation.customer_name}</div>
                    {quotation.customer_phone && <div>Tel: {quotation.customer_phone}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>Quote No: {quotation.quotation_no}</div>
                    <div>Date: {formatDate(quotation.created_at)}</div>
                    <div>Valid: {formatDate(quotation.valid_until || '')}</div>
                  </div>
                </div>

                {/* Products Table */}
                <div style={{ marginTop: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Courier New', monospace" }}>
                    <thead style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      <tr style={{ borderTop: '2px solid black', borderBottom: '2px solid black', fontSize: '14px', fontWeight: 'bold' }}>
                        <th style={{ padding: '6px 0', textAlign: 'left', width: '8%' }}>S.N.</th>
                        <th style={{ padding: '6px 0', textAlign: 'left', width: '52%' }}>Description</th>
                        <th style={{ padding: '6px 0', textAlign: 'right', width: '12%' }}>Qty.</th>
                        <th style={{ padding: '6px 0', textAlign: 'right', width: '28%' }}>Amount(Rs.)</th>
                      </tr>
                    </thead>
                    <tbody style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                      {(quotation.quotation_items || []).map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid black', fontSize: '13px', fontWeight: 'bold', verticalAlign: 'top' }}>
                          <td style={{ padding: '6px 0' }}>{index + 1}.</td>
                          <td style={{ padding: '6px 0' }}>{item.product_name}</td>
                          <td style={{ padding: '6px 0', textAlign: 'right' }}>{item.quantity}</td>
                          <td style={{ padding: '6px 0', textAlign: 'right' }}>
                            {((item.unit_price - item.discount) * item.quantity).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Grand Total */}
                <div style={{ marginTop: '10px', borderTop: '2px solid black', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '900' }}>
                  <span>Grand Total:</span>
                  <span style={{ borderBottom: '4px double black' }}>
                    Rs. {quotation.total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  </span>
                </div>

                <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '8px' }}>
                  LKR {convertNumberToWords(quotation.total)} Only
                </div>
              </div>

              {/* Bottom Signatures */}
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                <div style={{ width: '45%', textAlign: 'center' }}>
                  <div style={{ borderTop: '1px dashed black', paddingTop: '4px' }}>Prepared By</div>
                </div>
                <div style={{ width: '45%', textAlign: 'center' }}>
                  <div style={{ borderTop: '1px dashed black', paddingTop: '4px' }}>Client Acceptance</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerPrint}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Quotation
            </button>

            {onShareWhatsApp && (
              <button
                onClick={() => onShareWhatsApp(quotation)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Send quotation via WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp Quote
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDownloadPNG}
              disabled={isDownloadingImage}
              className="flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Save as PNG Image"
            >
              {isDownloadingImage ? (
                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-zinc-600" />
              )}
              Save Image (PNG)
            </button>

            <button
              onClick={onClose}
              className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
