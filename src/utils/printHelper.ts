export const globalPrint = (elementId: string, printStyle: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const printContainerId = 'global-print-container-wrapper';
  let printContainer = document.getElementById(printContainerId);
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = printContainerId;
    document.body.appendChild(printContainer);
  }
  
  printContainer.innerHTML = element.outerHTML;
  
  const styleId = 'global-print-style-wrapper';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  
  styleElement.innerHTML = `
    @media print {
      body > *:not(#${printContainerId}) {
        display: none !important;
      }
      #${printContainerId} {
        display: block !important;
      }
    }
    @media screen {
      #${printContainerId} {
        display: none !important;
      }
    }
    ${printStyle}
  `;
  
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      printContainer.innerHTML = '';
      if (styleElement.parentNode) styleElement.parentNode.removeChild(styleElement);
    }, 1000);
  }, 100);
};

export const globalPrintHTML = (htmlContent: string) => {
  const printContainerId = 'global-print-container-wrapper';
  let printContainer = document.getElementById(printContainerId);
  if (!printContainer) {
    printContainer = document.createElement('div');
    printContainer.id = printContainerId;
    document.body.appendChild(printContainer);
  }
  
  // Extract body content if html wrapper is provided
  let bodyContent = htmlContent;
  let styleContent = '';
  
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1];
  }
  
  const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) {
    styleContent = styleMatch[1];
  }
  
  printContainer.innerHTML = bodyContent;
  
  const styleId = 'global-print-style-wrapper';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  
  styleElement.innerHTML = `
    @media print {
      body > *:not(#${printContainerId}) {
        display: none !important;
      }
      #${printContainerId} {
        display: block !important;
      }
    }
    @media screen {
      #${printContainerId} {
        display: none !important;
      }
    }
    ${styleContent}
  `;
  
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      printContainer.innerHTML = '';
      if (styleElement.parentNode) styleElement.parentNode.removeChild(styleElement);
    }, 1000);
  }, 100);
};
