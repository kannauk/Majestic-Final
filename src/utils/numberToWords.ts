export function convertNumberToWords(num: number): string {
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion'];

  function convertChunk(n: number): string {
    let parts: string[] = [];
    if (n >= 100) {
      parts.push(ones[Math.floor(n / 100)] + ' Hundred');
      n %= 100;
    }
    if (n >= 20) {
      parts.push(tens[Math.floor(n / 10)]);
      n %= 10;
    }
    if (n > 0) {
      parts.push(ones[n]);
    }
    return parts.join(' ');
  }

  let words = '';
  let scaleIndex = 0;
  
  const mainNum = Math.floor(num);
  const cents = Math.round((num - mainNum) * 100);

  let temp = mainNum;
  let chunks: string[] = [];
  while (temp > 0) {
    const chunk = temp % 1000;
    if (chunk > 0) {
      const chunkStr = convertChunk(chunk);
      chunks.unshift(chunkStr + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : ''));
    }
    temp = Math.floor(temp / 1000);
    scaleIndex++;
  }
  
  words = chunks.join(' ');
  
  if (cents > 0) {
    words += ` and Cents ${convertChunk(cents)}`;
  }
  
  return words.trim();
}
