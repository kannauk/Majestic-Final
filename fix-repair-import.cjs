const fs = require('fs');
let code = fs.readFileSync('src/components/RepairCenter.tsx', 'utf8');

code = code.replace("import { getBranches }\nimport { supabase } from '../lib/supabaseClient';\nimport { PaymentMethod } from '../types'; from '../services/branches';", "import { getBranches } from '../services/branches';\nimport { supabase } from '../lib/supabaseClient';\nimport { PaymentMethod } from '../types';");
fs.writeFileSync('src/components/RepairCenter.tsx', code);
