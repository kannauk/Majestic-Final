const fs = require('fs');
let code = fs.readFileSync('src/components/Financials.tsx', 'utf8');

code = code.replace(`import { getBranches } from '../services/branches';`, `import { getBranches } from '../services/branches';\nimport { getSetting } from '../services/settings';`);

const stateStart = code.indexOf(`const [activeTab, setActiveTab] = useState<'overview' | 'general' | 'expenses' | 'suppliers' | 'customers' | 'tax'>('overview');`);
code = code.substring(0, stateStart) + `const [companyName, setCompanyName] = useState('MAJESTIC COMPUTERS');\n  ` + code.substring(stateStart);

const fetchStart = code.indexOf(`Promise.all([`);
if (fetchStart !== -1) {
  code = code.replace(`Promise.all([
      getExpenses(),
      getBranches(),
      getInvoices(),
      getSuppliers(),
      getCustomers(),
      getSupplierPayments(),
      getCustomerReceipts()
    ]).then(([exp, br, inv, sup, cust, supPay, custRec]) => {`, `Promise.all([
      getExpenses(),
      getBranches(),
      getInvoices(),
      getSuppliers(),
      getCustomers(),
      getSupplierPayments(),
      getCustomerReceipts(),
      getSetting()
    ]).then(([exp, br, inv, sup, cust, supPay, custRec, settingData]) => {
      if (settingData && settingData.company_name) setCompanyName(settingData.company_name);`);
}

code = code.replace(/MAJESTIC COMPUTERS/g, '${companyName}');
code = code.replace(/Majestic Computers/g, '${companyName}');

fs.writeFileSync('src/components/Financials.tsx', code);
