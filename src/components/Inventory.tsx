import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Package, Plus, ArrowLeftRight, AlertTriangle, Layers, 
  RefreshCcw, Move, Barcode, Clipboard, Search, Grid, MapPin, CheckCircle,
  FileSpreadsheet, Download, Upload, FileUp, FileDown, Pencil, X, FileText,
  Eye, EyeOff, PackageX
} from 'lucide-react';
import { User, Branch, Product, ProductStock, InventoryLog, ProductCategory, Brand, InventoryLogType } from '../types';
import { exportToCSV, parseCSV, parseExcelFile } from '../utils/excelHelper';
import { extractTextFromPDF } from '../utils/pdfHelper';

interface ParsedStockRow {
  sku: string;
  productName: string;
  qty: number;
  branchId: string;
  branchName: string;
  costPrice: number;
  sellingPrice: number;
  minAlert: number;
  categoryName?: string;
  brandName?: string;
  status: 'valid' | 'new_sku' | 'invalid';
  reason?: string;
}

interface InventoryProps {
  user: User;
  activeBranch: Branch | null;
}

export default function Inventory({ user, activeBranch }: InventoryProps) {
  const [activeTab, setActiveTab] = useState<'stocks' | 'transfer' | 'logs' | 'excel'>('stocks');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Excel Import States
  const [dragOver, setDragOver] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedStockRow[]>([]);
  const [importFilename, setImportFilename] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>(user.role === 'super_admin' ? 'all' : (user.branch_id || ''));
  const [hideZeroStock, setHideZeroStock] = useState<boolean>(true);

  // Create Product fields
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [sku, setSku] = useState('');
  const [pName, setPName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [catSelected, setCatSelected] = useState('');
  const [brandSelected, setBrandSelected] = useState('');
  const [initialQty, setInitialQty] = useState<number>(10);
  const [pDesc, setPDesc] = useState('');

  // Editing Product Item Name and Details
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Manual Stock Adjustment state
  const [adjustingStockRow, setAdjustingStockRow] = useState<any | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'deduct' | 'set'>('add');
  const [adjustQtyInput, setAdjustQtyInput] = useState<number>(0);
  const [adjustRemarks, setAdjustRemarks] = useState('');

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const { updateProduct } = await import('../services/products');
      await updateProduct(editingProduct);
      setCatalogProducts(catalogProducts.map(p => p.id === editingProduct.id ? editingProduct : p));

      setStatusLogText(`Product item updated: "${editingProduct.name}" [SKU: ${editingProduct.sku}]`);
      setEditingProduct(null);
      setTimeout(() => setStatusLogText(null), 3500);
    } catch (error) {
      console.error(error);
      setStatusLogText('Failed to update product.');
    }
  };

  const handleManualStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingStockRow) return;

    if (adjustQtyInput < 0) {
      alert('Quantity cannot be negative.');
      return;
    }

    try {
      const { upsertProductStock } = await import('../services/productStocks');
      const { createInventoryLog } = await import('../services/inventoryLogs');

      let finalQty = adjustingStockRow.qty;
      let logType: 'in' | 'out' | 'damaged' = 'in';
      let changeQty = 0;

      if (adjustType === 'add') {
        finalQty += adjustQtyInput;
        logType = 'in';
        changeQty = adjustQtyInput;
      } else if (adjustType === 'deduct') {
        if (adjustingStockRow.qty < adjustQtyInput) {
          alert(`Cannot deduct ${adjustQtyInput} units. Only ${adjustingStockRow.qty} units are available in stock.`);
          return;
        }
        finalQty -= adjustQtyInput;
        logType = 'out';
        changeQty = adjustQtyInput;
      } else if (adjustType === 'set') {
        const diff = adjustQtyInput - adjustingStockRow.qty;
        if (diff > 0) {
          logType = 'in';
          changeQty = diff;
        } else if (diff < 0) {
          logType = 'out';
          changeQty = Math.abs(diff);
        } else {
          logType = 'in';
          changeQty = 0;
        }
        finalQty = adjustQtyInput;
      }

      // 1. Update/Upsert stock
      const updatedStock = await upsertProductStock({
        id: adjustingStockRow.id,
        product_id: adjustingStockRow.productId,
        branch_id: adjustingStockRow.branchId,
        quantity: finalQty,
        min_stock_alert: adjustingStockRow.minAlert,
      });

      // 2. Log in inventory logs
      const logMsg = `Manual adjustment (${adjustType.toUpperCase()}): ${adjustQtyInput} units. Reason: ${adjustRemarks || 'No remarks provided'}. Changed stock from ${adjustingStockRow.qty} to ${finalQty} by ${user.name}`;
      await createInventoryLog({
        product_id: adjustingStockRow.productId,
        product_name: adjustingStockRow.productName,
        sku: adjustingStockRow.sku,
        branch_id: adjustingStockRow.branchId,
        branch_name: adjustingStockRow.branchName,
        quantity: changeQty,
        type: logType,
        description: logMsg,
        created_at: new Date().toISOString()
      });

      // 3. Update local state
      setProductStocks(productStocks.map(stk => stk.id === updatedStock.id ? updatedStock : stk));

      // Refresh logs
      const { getInventoryLogs } = await import('../services/inventoryLogs');
      const logs = await getInventoryLogs();
      setInventoryLogsList(logs);

      // Reset
      setAdjustingStockRow(null);
      setStatusLogText(`Stock updated for ${adjustingStockRow.productName}. New Qty: ${finalQty}`);
      setTimeout(() => setStatusLogText(null), 4000);

      alert(`✅ Stock adjusted successfully!\n\nProduct: ${adjustingStockRow.productName}\nLocation: ${adjustingStockRow.branchName}\nNew In-Stock Qty: ${finalQty}`);
    } catch (error: any) {
      console.error(error);
      alert(`Failed to adjust stock: ${error.message || 'Unknown database error'}`);
    }
  };

  // Transfer fields
  const [transferProductId, setTransferProductId] = useState('');
  const [transferFromBranch, setTransferFromBranch] = useState(user.role === 'super_admin' ? 'b-colombo' : (user.branch_id || ''));
  const [transferToBranch, setTransferToBranch] = useState('b-jaffna');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferRemarks, setTransferRemarks] = useState('');

  // Status logs
  const [statusLogText, setStatusLogText] = useState<string | null>(null);

  // Load datasets dynamically
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brandsList, setBrandsList] = useState<Brand[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [productStocks, setProductStocks] = useState<ProductStock[]>([]);
  const [inventoryLogsList, setInventoryLogsList] = useState<InventoryLog[]>([]);

  useEffect(() => {
    Promise.all([
      import('../services/branches').then(s => s.getBranches()),
      import('../services/categories').then(s => s.getCategories()),
      import('../services/brands').then(s => s.getBrands()),
      import('../services/products').then(s => s.getProducts()),
      import('../services/productStocks').then(s => s.getProductStocks()),
      import('../services/inventoryLogs').then(s => s.getInventoryLogs())
    ]).then(([branches, categories, brands, products, stocks, logs]) => {
      setBranches(branches);
      setCategories(categories);
      setBrandsList(brands);
      setCatalogProducts(products);
      setProductStocks(stocks);
      setInventoryLogsList(logs);
    }).catch(console.error);
  }, []);

  // Refresh categories/brands when modal opens
  useEffect(() => {
    if (showAddProductModal) {
      Promise.all([
        import('../services/categories').then(s => s.getCategories()),
        import('../services/brands').then(s => s.getBrands())
      ]).then(([categories, brands]) => {
        setCategories(categories);
        setBrandsList(brands);
      }).catch(console.error);
    }
  }, [showAddProductModal]);

  useEffect(() => {
    if (activeBranch) {
      setFilterBranch(activeBranch.id);
    }
  }, [activeBranch]);

  // Compute stocks display
  const stocksDisplay = useMemo(() => {
    const list: any[] = [];
    catalogProducts.forEach(prod => {
      // Find matching stock row
      productStocks.forEach(stk => {
        // Apply branch filters
        if (filterBranch !== 'all' && stk.branch_id !== filterBranch) return;
        
        if (stk.product_id === prod.id) {
          const cat = categories.find(c => c.id === prod.category_id);
          const br = brandsList.find(b => b.id === prod.brand_id);
          const branchObj = branches.find(b => b.id === stk.branch_id);
          
          list.push({
            id: stk.id,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            barcode: prod.barcode,
            costPrice: prod.cost_price,
            sellingPrice: prod.selling_price,
            categoryName: cat ? cat.name : 'Uncategorized',
            categoryId: prod.category_id,
            brandName: br ? br.name : 'Unknown',
            qty: stk.quantity,
            minAlert: stk.min_stock_alert,
            branchName: branchObj ? branchObj.name : 'Unknown',
            branchId: stk.branch_id
          });
        }
      });
    });

    // Apply search query filters & zero stock filter
    return list.filter(row => {
      const matchesCategory = filterCategory === 'all' || row.categoryId === filterCategory;
      const cleanQ = searchQuery.toLowerCase();
      const matchesSearch = row.productName.toLowerCase().includes(cleanQ) || 
                            row.sku.toLowerCase().includes(cleanQ) || 
                            row.barcode.includes(cleanQ);
      const matchesStock = hideZeroStock ? row.qty > 0 : true;
      return matchesCategory && matchesSearch && matchesStock;
    });
  }, [catalogProducts, productStocks, categories, brandsList, branches, filterBranch, filterCategory, searchQuery, hideZeroStock]);

  const handleCreateProductCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !pName || !catSelected || !brandSelected) {
      alert('Fill all required fields');
      return;
    }

    try {
      const { createProduct } = await import('../services/products');
      const { createProductStock } = await import('../services/productStocks');
      
      const newProd = await createProduct({
        name: pName,
        sku: sku,
        barcode: barcode || String(Math.floor(Math.random() * 900000000000) + 100000000000),
        description: pDesc,
        category_id: catSelected,
        brand_id: brandSelected,
        cost_price: costPrice,
        selling_price: sellingPrice,
        serial_tracked: true,
        created_at: new Date().toISOString(),
      });

      setCatalogProducts([newProd, ...catalogProducts]);

      // Create stock parameter ONLY for the branch where it was created
      const targetBranchId = activeBranch?.id || user.branch_id;
      if (targetBranchId) {
        const newStock = await createProductStock({
          product_id: newProd.id,
          branch_id: targetBranchId,
          quantity: initialQty,
          min_stock_alert: 3
        });
        setProductStocks([newStock, ...productStocks]);
      } else {
        // Fallback to all branches if no branch is contextually active
        const newStocks = [];
        for (const br of branches) {
          const startingQty = initialQty;
          const newStock = await createProductStock({
            product_id: newProd.id,
            branch_id: br.id,
            quantity: startingQty,
            min_stock_alert: 3
          });
          newStocks.push(newStock);
        }
        setProductStocks([...newStocks, ...productStocks]);
      }

      // Reset fields & Notify
      setSku('');
      setPName('');
      setBarcode('');
      setCostPrice(0);
      setSellingPrice(0);
      setPDesc('');
      setShowAddProductModal(false);

      setStatusLogText('Product successfully registered into Majestic Catalog with starting quantities.');
      setTimeout(() => setStatusLogText(null), 3000);
    } catch (error: any) {
      console.error(error);
      alert(`Failed to register product: ${error.message || 'Unknown error'}`);
    }
  };

  // Perform localized Stock Transfer logic
  const handleStockTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferProductId || !transferFromBranch || !transferToBranch) {
      setStatusLogText('Transfer error. Incomplete inputs.');
      return;
    }
    if (transferFromBranch === transferToBranch) {
      setStatusLogText('Cannot transfer source items to the same branch destinations.');
      return;
    }
    if (transferQty <= 0) {
      setStatusLogText('Transfer quantity must be positive.');
      return;
    }

    try {
      const { transferStock } = await import('../services/transfers');
      await transferStock(
        transferProductId,
        transferFromBranch,
        transferToBranch,
        transferQty,
        transferRemarks || 'Weekly replenishment dispatch',
        user.name
      );

      // Reset
      setTransferQty(1);
      setTransferRemarks('');
      setStatusLogText(`Dispatched transfer: ${transferQty} units sent successfully.`);
      setTimeout(() => setStatusLogText(null), 3000);
      
      // Reload stocks and logs
      const { getProductStocks } = await import('../services/productStocks');
      const { getInventoryLogs } = await import('../services/inventoryLogs');
      const [stocks, logs] = await Promise.all([getProductStocks(), getInventoryLogs()]);
      setProductStocks(stocks);
      setInventoryLogsList(logs);

    } catch (err: any) {
      setStatusLogText(`Failed: ${err.message}`);
    }
  };

  // --- EXCEL STOCK BULK SYNC LOGIC ---

  const exportStocksToExcel = () => {
    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Brand',
      'Location Branch',
      'Branch ID',
      'In-Stock Qty',
      'Cost Price (LKR)',
      'Selling Price (LKR)',
      'Min Stock Alert'
    ];

    const rows = stocksDisplay.map(item => [
      item.sku,
      item.productName,
      item.categoryName,
      item.brandName,
      item.branchName,
      item.branchId,
      item.qty,
      item.costPrice,
      item.sellingPrice,
      item.minAlert
    ]);

    exportToCSV(headers, rows, `Majestic_Stock_Balances_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const downloadStocksTemplate = () => {
    const headers = [
      'SKU',
      'Product Name',
      'Category ID or Name',
      'Brand Name',
      'Branch ID or Name',
      'Quantity',
      'Cost Price',
      'Selling Price',
      'Min Stock Alert'
    ];
    
    const rows = [
      ['ASUS-ROG-G14-01', 'Asus ROG Zephyrus G14 Gaming Laptop', 'Laptops', 'Asus', 'b-colombo', '15', '415000', '445000', '3'],
      ['SAM-980PRO-1T', 'Samsung 980 Pro 1TB NVMe PCIe Gen4 SSD', 'Storage', 'Samsung', 'Colombo Branch', '24', '28000', '36000', '5']
    ];

    exportToCSV(headers, rows, 'Majestic_Stock_Balances_Template.csv');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setImportFilename(file.name);
    const fileNameLower = file.name.toLowerCase();
    if (fileNameLower.endsWith('.pdf')) {
      try {
        const text = await extractTextFromPDF(file);
        if (text) {
          parseAndValidateStocks(text);
        } else {
          alert('No text could be extracted from this PDF document.');
        }
      } catch (err: any) {
        alert(`PDF Extraction Error: ${err.message || 'Failed to read PDF file'}`);
      }
    } else if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
      try {
        const grid = await parseExcelFile(file);
        if (grid && grid.length > 0) {
          parseAndValidateStocks(grid);
        } else {
          alert('Excel file is empty or could not be read.');
        }
      } catch (err: any) {
        alert(`Excel Extraction Error: ${err.message || 'Failed to read Excel file'}`);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          parseAndValidateStocks(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const parseAndValidateStocks = (input: string | string[][]) => {
    try {
      const grid = typeof input === 'string' ? parseCSV(input) : input;
      if (grid.length < 2) {
        alert('Empty spreadsheet or invalid headers');
        return;
      }

      const rawHeaders = grid[0].map(h => h.toLowerCase().trim());
      
      let skuIdx = rawHeaders.findIndex(h => h.includes('sku') || h.includes('code'));
      let nameIdx = rawHeaders.findIndex(h => h.includes('product') || h.includes('name') || h.includes('item'));
      let qtyIdx = rawHeaders.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('stock') || h.includes('balance'));
      let branchIdx = rawHeaders.findIndex(h => h.includes('branch') || h.includes('location'));
      let costIdx = rawHeaders.findIndex(h => h.includes('cost') || h.includes('buy') || h.includes('purchase'));
      let sellIdx = rawHeaders.findIndex(h => h.includes('sell') || h.includes('price') || h.includes('retail'));
      let minIdx = rawHeaders.findIndex(h => h.includes('min') || h.includes('alert') || h.includes('threshold'));
      let categoryIdx = rawHeaders.findIndex(h => h.includes('category') || h.includes('type') || h.includes('group'));
      let brandIdx = rawHeaders.findIndex(h => h.includes('brand') || h.includes('make') || h.includes('manufacturer'));

      if (skuIdx === -1) skuIdx = 0;
      if (nameIdx === -1) nameIdx = 1;
      if (qtyIdx === -1) qtyIdx = 5;
      if (branchIdx === -1) branchIdx = 4;
      if (costIdx === -1) costIdx = 6;
      if (sellIdx === -1) sellIdx = 7;
      if (minIdx === -1) minIdx = 8;

      const validated: ParsedStockRow[] = [];

      for (let i = 1; i < grid.length; i++) {
        const row = grid[i];
        if (row.length === 0 || row.every(cell => cell === '')) continue;

        const rawSku = row[skuIdx]?.toUpperCase().trim() || '';
        const rawName = row[nameIdx]?.trim() || '';
        const rawQty = parseInt(row[qtyIdx]) >= 0 ? parseInt(row[qtyIdx]) : 0;
        const rawBranchStr = row[branchIdx]?.trim() || '';
        const rawCost = parseFloat(row[costIdx]) >= 0 ? parseFloat(row[costIdx]) : 0;
        const rawSell = parseFloat(row[sellIdx]) >= 0 ? parseFloat(row[sellIdx]) : 0;
        const rawMin = parseInt(row[minIdx]) >= 0 ? parseInt(row[minIdx]) : 3;
        const rawCategory = categoryIdx !== -1 ? row[categoryIdx]?.trim() || '' : '';
        const rawBrand = brandIdx !== -1 ? row[brandIdx]?.trim() || '' : '';

        if (!rawSku) {
          validated.push({
            sku: '',
            productName: rawName || 'Unknown Item',
            qty: rawQty,
            branchId: '',
            branchName: rawBranchStr,
            costPrice: rawCost,
            sellingPrice: rawSell,
            minAlert: rawMin,
            status: 'invalid',
            reason: 'Missing unique SKU code'
          });
          continue;
        }

        let branchMatch = branches.find(b => 
          b.id.toLowerCase() === rawBranchStr.toLowerCase() || 
          b.name.toLowerCase() === rawBranchStr.toLowerCase() || 
          b.code.toLowerCase() === rawBranchStr.toLowerCase()
        );

        if (!branchMatch) {
          branchMatch = activeBranch || branches[0] || null;
        }

        const bId = branchMatch?.id || '00000000-0000-0000-0000-000000000000';
        const bName = branchMatch?.name || 'Default Branch';

        const productMatch = catalogProducts.find(p => p.sku.toUpperCase() === rawSku);

        if (productMatch) {
          validated.push({
            sku: rawSku,
            productName: productMatch.name,
            qty: rawQty,
            branchId: bId,
            branchName: bName,
            costPrice: productMatch.cost_price,
            sellingPrice: productMatch.selling_price,
            minAlert: rawMin,
            categoryName: rawCategory,
            brandName: rawBrand,
            status: 'valid'
          });
        } else {
          validated.push({
            sku: rawSku,
            productName: rawName || `New Product (${rawSku})`,
            qty: rawQty,
            branchId: bId,
            branchName: bName,
            costPrice: rawCost,
            sellingPrice: rawSell,
            minAlert: rawMin,
            categoryName: rawCategory,
            brandName: rawBrand,
            status: 'new_sku',
            reason: 'SKU not found. Will register new catalog entry.'
          });
        }
      }

      setParsedRows(validated);
    } catch (err: any) {
      alert(`Spreadsheet parsing error: ${err.message}`);
    }
  };

  const commitStocksImport = async () => {
    if (parsedRows.length === 0) return;

    try {
      const { createProduct } = await import('../services/products');
      const { getProductStocks, upsertProductStock } = await import('../services/productStocks');
      const { createInventoryLog } = await import('../services/inventoryLogs');
      const { createCategory } = await import('../services/categories');
      const { createBrand } = await import('../services/brands');
      
      let createdProductsCount = 0;
      let updatedStocksCount = 0;
      
      // Mutable copies to track newly created ones during import
      const currentCategories = [...categories];
      const currentBrands = [...brandsList];

      for (const row of parsedRows) {
        if (row.status === 'invalid') continue;

        let productId = '';

        if (row.status === 'new_sku') {
          // Resolve category
          let catId = currentCategories[0]?.id || null as any;
          if (row.categoryName) {
            let existingCat = currentCategories.find(c => c.name.toLowerCase() === row.categoryName!.toLowerCase());
            if (!existingCat) {
              const newCat = await createCategory({ name: row.categoryName, code: row.categoryName.substring(0, 3).toUpperCase() });
              currentCategories.push(newCat);
              catId = newCat.id;
            } else {
              catId = existingCat.id;
            }
          }

          // Resolve brand
          let brandId = currentBrands[0]?.id || null as any;
          if (row.brandName) {
            let existingBrand = currentBrands.find(b => b.name.toLowerCase() === row.brandName!.toLowerCase());
            if (!existingBrand) {
              const newBrand = await createBrand({ name: row.brandName });
              currentBrands.push(newBrand);
              brandId = newBrand.id;
            } else {
              brandId = existingBrand.id;
            }
          }

          const newProduct = await createProduct({
            name: row.productName,
            sku: row.sku,
            barcode: String(Math.floor(Math.random() * 900000000000) + 100000000000),
            description: 'Auto-imported via spreadsheet bulk tool.',
            category_id: catId,
            brand_id: brandId,
            cost_price: row.costPrice,
            selling_price: row.sellingPrice,
            serial_tracked: true,
            created_at: new Date().toISOString(),
          });
          
          productId = newProduct.id;
          createdProductsCount++;

          // Initialize stock only for the specified branch from the row
          await upsertProductStock({
            product_id: productId,
            branch_id: row.branchId,
            quantity: row.qty,
            min_stock_alert: row.minAlert
          });
        } else {
          const matched = catalogProducts.find(p => p.sku.toUpperCase() === row.sku);
          if (matched) {
            productId = matched.id;
          }
        }

        if (productId) {
          if (row.status !== 'new_sku') {
            // Upsert the specific branch stock safely
            await upsertProductStock({
              product_id: productId,
              branch_id: row.branchId,
              quantity: row.qty,
              min_stock_alert: row.minAlert
            });
            updatedStocksCount++;

            await createInventoryLog({
              product_id: productId,
              product_name: row.productName,
              sku: row.sku,
              branch_id: row.branchId,
              branch_name: row.branchName,
              quantity: row.qty,
              type: 'in',
              description: `Spreadsheet balance sync. Set stock to ${row.qty} by ${user.name}`,
              created_at: new Date().toISOString()
            });
          } else {
            // New SKU stock already initialized in branches loop above; just write log
            await createInventoryLog({
              product_id: productId,
              product_name: row.productName,
              sku: row.sku,
              branch_id: row.branchId,
              branch_name: row.branchName,
              quantity: row.qty,
              type: 'in',
              description: `Spreadsheet setup. Initialized stock to ${row.qty} by ${user.name}`,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      // Refresh data
      const { getProducts } = await import('../services/products');
      const { getInventoryLogs } = await import('../services/inventoryLogs');
      const { getCategories } = await import('../services/categories');
      const { getBrands } = await import('../services/brands');
      
      const [products, stocks, logs, fetchedCats, fetchedBrands] = await Promise.all([getProducts(), getProductStocks(), getInventoryLogs(), getCategories(), getBrands()]);
      setCatalogProducts(products);
      setProductStocks(stocks);
      setInventoryLogsList(logs);
      setCategories(fetchedCats);
      setBrandsList(fetchedBrands);

      setStatusLogText(`Excel stock import complete! Added ${createdProductsCount} catalog SKUs and updated ${updatedStocksCount} branch stock records.`);
      setParsedRows([]);
      setImportFilename('');
      
      // Explicit confirmation popup for the user
      alert(`✅ Excel Stock Import Successful!\n\n• New SKUs Added: ${createdProductsCount}\n• Branch Stocks Synced: ${updatedStocksCount}\n\nThe product database and branch stocks have been successfully updated.`);
      
      setTimeout(() => setStatusLogText(null), 10000);
    } catch (error: any) {
      console.error(error);
      alert(`Failed to import stocks: ${error?.message || error || 'Unknown database error'}`);
    }
  };

  const logsDisplayFiltered = useMemo(() => {
    if (user.role !== 'super_admin' && user.branch_id) {
      return inventoryLogsList.filter(l => l.branch_id === user.branch_id);
    }
    return inventoryLogsList;
  }, [inventoryLogsList, user]);

  return (
    <div className="space-y-6" id="inventory-module-root">
      {/* Tab Switch header */}
      <div className="flex justify-between items-center bg-zinc-50 border border-zinc-200/80 p-2 rounded-2xl">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('stocks')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'stocks'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-650 hover:bg-zinc-200/50'
            }`}
          >
            <Grid className="w-4 h-4" />
            Branch Stock Ledger
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'transfer'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-650 hover:bg-zinc-200/50'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Inter-Branch Stock Transfer
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'logs'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-650 hover:bg-zinc-200/50'
            }`}
          >
            <Clipboard className="w-4 h-4" />
            Inventory Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('excel')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'excel'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-650 hover:bg-zinc-200/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Excel Bulk Sync
          </button>
        </div>

        {/* Global trigger to add new catalog models */}
        {user.role !== 'cashier' && user.role !== 'technician' && (
          <button
            onClick={() => setShowAddProductModal(true)}
            className="bg-indigo-600 font-bold hover:bg-indigo-705 text-white text-xs px-3.5 py-2 rounded-xl flex items-center gap-1 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Catalog SKU
          </button>
        )}
      </div>

      {statusLogText && (
        <div className="bg-indigo-50 border border-indigo-100/60 p-3 rounded-xl text-xs font-medium text-indigo-755 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>{statusLogText}</span>
        </div>
      )}

      {activeTab === 'stocks' ? (
        <div className="bg-white border p-5 rounded-2xl shadow-xs space-y-4" id="stocks-ledger-card">
          <div className="flex flex-col sm:flex-row justify-between gap-3 p-3 bg-zinc-50 rounded-2xl border">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Find item via typing name, brand, SKU code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-white border text-xs rounded-xl px-3 py-1.5 focus:ring-1 focus:ring-indigo-505"
            >
              <option value="all">Any Category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Zero Stock Toggle Button */}
            <button
              type="button"
              onClick={() => setHideZeroStock(!hideZeroStock)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
                hideZeroStock
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'
              }`}
              title={hideZeroStock ? 'Zero stock items are hidden. Click to show.' : 'Showing all items including zero stock.'}
            >
              {hideZeroStock ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Hiding 0 Stock</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Showing 0 Stock</span>
                </>
              )}
            </button>

            {/* Branch isolation select */}
            {user.role === 'super_admin' ? (
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="bg-white border text-xs rounded-xl px-3 py-1.5 focus:ring-1 focus:ring-indigo-505"
              >
                <option value="all">Enterprise Global stock</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <div className="text-xs bg-zinc-200/50 border rounded-xl px-3 py-1.5 font-bold text-zinc-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Isolated: {branches.find(b => b.id === user.branch_id)?.name || 'Local'}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-205 text-zinc-500 font-semibold text-left">
                  <th className="pb-3">SKU / Code</th>
                  <th className="pb-3">Hardware Item</th>
                  <th className="pb-3">Showroom Location</th>
                  <th className="pb-3 text-right">Cost Value</th>
                  <th className="pb-3 text-right">Selling Price</th>
                  <th className="pb-3 text-center">In-Stock Qty</th>
                  <th className="pb-3 text-right">Status Alert</th>
                  <th className="pb-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 text-zinc-700">
                {stocksDisplay.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <PackageX className="w-8 h-8 text-zinc-300" />
                        <p className="text-xs font-semibold text-zinc-600">No matching stock items found</p>
                        <p className="text-[11px] text-zinc-400 max-w-sm">
                          {hideZeroStock
                            ? "Zero stock items are currently hidden. Click 'Hiding 0 Stock' above or adjust your search filters."
                            : "No items match your active search or category filters."}
                        </p>
                        {hideZeroStock && (
                          <button
                            type="button"
                            onClick={() => setHideZeroStock(false)}
                            className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Show Zero Stock Items
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  stocksDisplay.map(item => {
                  const isLow = item.qty <= item.minAlert;
                  const prod = catalogProducts.find(p => p.id === item.productId);
                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 font-semibold font-mono text-zinc-900">{item.sku}</td>
                      <td className="py-3">
                        <div className="font-bold text-zinc-900">{item.productName}</div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                          <span>Category: {item.categoryName}</span>
                          <span>•</span>
                          <span>Brand: {item.brandName}</span>
                        </div>
                      </td>
                      <td className="py-3 font-medium text-zinc-650">{item.branchName}</td>
                      <td className="py-3 text-right">Rs. {item.costPrice.toLocaleString()}</td>
                      <td className="py-3 text-right font-semibold text-zinc-900">
                        Rs. {item.sellingPrice.toLocaleString()}
                      </td>
                      <td className={`py-3 text-center font-bold text-sm ${isLow ? 'text-red-650' : 'text-zinc-800'}`}>
                        {item.qty}
                      </td>
                      <td className="py-3 text-right">
                        {item.qty === 0 ? (
                          <span className="text-[10px] bg-red-100 text-red-750 px-2.5 py-1 rounded-full font-bold">OUT OF STOCK</span>
                        ) : isLow ? (
                          <span className="text-[10px] bg-amber-100 text-amber-755 px-2.5 py-1 rounded-full font-bold">LOW STOCK LIMIT</span>
                        ) : (
                          <span className="text-[10px] bg-green-100 text-green-755 px-2.5 py-1 rounded-full font-bold">STOCK NORMAL</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {prod && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingProduct(prod)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                              title="Edit Item Name & Catalog Details"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit Name</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustingStockRow({
                                  id: item.id,
                                  productId: item.productId,
                                  productName: item.productName,
                                  sku: item.sku,
                                  branchId: item.branchId,
                                  branchName: item.branchName,
                                  qty: item.qty,
                                  minAlert: item.minAlert
                                });
                                setAdjustType('add');
                                setAdjustQtyInput(10);
                                setAdjustRemarks('Manual stock adjustment');
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-650 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                              title="Manually Add, Deduct, or Set exact stock level for this item at this location"
                            >
                              <Plus className="w-3 h-3 text-emerald-600" />
                              <span>Add/Adjust Stock</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'transfer' ? (
        /* Stock transfer between branches form */
        <div className="bg-white border rounded-2xl p-6 shadow-xs max-w-xl mx-auto space-y-4" id="stock-transfer-form-pane">
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5 border-b border-zinc-100 pb-3">
              <Move className="w-5 h-5 text-indigo-500 animate-bounce" />
              Dispatch Inter-Branch Stock Transfers
            </h4>
            <p className="text-[11px] text-zinc-510 mt-1">
              Transfer parts or laptops securely between majestic branches. Our ERP will automatically log debit/credit transactions.
            </p>
          </div>

          <form onSubmit={handleStockTransferSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-zinc-550 block mb-1">Select Hardware Asset to transfer:</label>
              <select
                value={transferProductId}
                onChange={(e) => setTransferProductId(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-205 rounded-xl px-3 py-2 outline-none"
                required
              >
                <option value="">-- Choose hardware item catalog --</option>
                {catalogProducts.filter(p => {
                  // Only list products that exist (have stock record) in the source branch
                  return productStocks.some(stk => stk.product_id === p.id && stk.branch_id === transferFromBranch);
                }).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.sku}]
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-zinc-550 block mb-1">From Source Branch:</label>
                {user.role === 'super_admin' ? (
                  <select
                    value={transferFromBranch}
                    onChange={(e) => setTransferFromBranch(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-205 rounded-xl px-3 py-2 outline-none"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-zinc-100 font-bold px-3 py-2 border rounded-xl">{branches.find(b => b.id === transferFromBranch)?.name || 'Own'}</div>
                )}
              </div>

              <div>
                <label className="text-zinc-550 block mb-1">To Destination Branch:</label>
                <select
                  value={transferToBranch}
                  onChange={(e) => setTransferToBranch(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-205 rounded-xl px-3 py-2 outline-none animate-pulse"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-zinc-555 block font-bold">Transfer Quantity:</label>
              <input
                type="number"
                value={transferQty || ''}
                onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-zinc-50 border border-zinc-205 rounded-xl px-3 py-2 outline-none font-bold"
                required
              />
            </div>

            <div>
              <label className="text-zinc-550 block mb-1">Transfer dispatch remarks and Notes:</label>
              <textarea
                placeholder="e.g. Relocating display laptop units for showroom launch..."
                value={transferRemarks}
                onChange={(e) => setTransferRemarks(e.target.value)}
                rows={2}
                className="w-full bg-zinc-50 border border-zinc-205 rounded-xl p-3 outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2 px-4 rounded-xl transition-all uppercase tracking-wider text-[11px]"
            >
              Verify & Dispatch Stock Transfer
            </button>
          </form>
        </div>
      ) : activeTab === 'logs' ? (
        /* Inventory Logs history Panel (Logs Tab) */
        <div className="bg-white border rounded-2xl p-5 shadow-xs space-y-4">
          <h4 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5 border-b border-zinc-50 pb-3">
            <Barcode className="w-5 h-5 text-indigo-500" />
            Stock Ledger Audit Trails
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 font-semibold text-left uppercase text-[9px]">
                  <th className="pb-2">Audit Timestamp</th>
                  <th className="pb-2">Product Name</th>
                  <th className="pb-2">Location Branch</th>
                  <th className="pb-2 text-center">Adjust Type</th>
                  <th className="pb-2 text-center">Adjust Qty</th>
                  <th className="pb-2 text-right">Audit Trails Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 text-zinc-700 font-mono">
                {logsDisplayFiltered.map(l => (
                  <tr key={l.id} className="hover:bg-zinc-50/50">
                    <td className="py-2.5 text-zinc-400 font-sans">{l.created_at.split('T')[0]} {l.created_at.split('T')[1]?.substring(0, 5)}</td>
                    <td className="py-2.5 font-bold text-zinc-800 font-sans">{l.product_name}</td>
                    <td className="py-2.5 text-zinc-650 font-sans">{l.branch_name}</td>
                    <td className="py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.type === 'in' || l.type === 'transfer_in' ? 'bg-green-50 text-green-705' : 'bg-red-50 text-red-655'
                      }`}>
                        {l.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 text-center font-bold font-sans text-sm">{l.quantity}</td>
                    <td className="py-2.5 text-right font-sans text-zinc-600">{l.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Excel Bulk Sync Panel (Spreadsheet Tab) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="excel-sync-panel">
          {/* Instructions and Export Utilities (5 cols) */}
          <div className="lg:col-span-5 bg-white border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b pb-3.5">
              <h4 className="text-sm font-semibold text-zinc-950 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-500" />
                Excel Stock Bulk Actions
              </h4>
              <p className="text-[11px] text-zinc-500 mt-1">
                Download fully configured spreadsheets from Majestic ERP or upload new stock balances in bulk.
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-zinc-50 p-3 rounded-xl border border-dashed text-[11.5px] text-zinc-600 leading-relaxed">
                <span className="font-bold text-zinc-800 block mb-1">💡 Import Instructions:</span>
                1. Always format your columns exactly like our template.<br/>
                2. Matches existing catalog items by **SKU** code.<br/>
                3. If the SKU is not found in the catalog, Majestic will automatically register it as a new product!<br/>
                4. Enter numerical values under **Quantity**, **Cost Price**, and **Selling Price** rows.
              </div>

              <div className="pt-2">
                <span className="font-bold text-zinc-800 block mb-2 uppercase text-[10px] tracking-wider text-zinc-400">Export Controls:</span>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={exportStocksToExcel}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm text-[11px]"
                  >
                    <FileDown className="w-4 h-4 text-emerald-400" />
                    Export Current Stock Balances
                  </button>

                  <button
                    onClick={downloadStocksTemplate}
                    className="w-full bg-zinc-50 hover:bg-zinc-100 border text-zinc-700 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-[11px]"
                  >
                    <Download className="w-4 h-4 text-zinc-500" />
                    Download Import Blank Template
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Import Drag-n-Drop & Parsed Preview (7 cols) */}
          <div className="lg:col-span-7 bg-white border rounded-2xl p-5 shadow-xs space-y-4">
            <h4 className="text-sm font-semibold text-zinc-950 flex items-center gap-1.5 border-b pb-3">
              <Upload className="w-4.5 h-4.5 text-indigo-500" />
              Upload Spreadsheet File
            </h4>

            {/* Drag & Drop Box */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                dragOver 
                  ? 'border-indigo-500 bg-indigo-50/40' 
                  : importFilename 
                  ? 'border-emerald-400 bg-emerald-50/10' 
                  : 'border-zinc-200 hover:border-zinc-350 bg-zinc-50/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
              <FileUp className={`w-9 h-9 mb-2.5 ${importFilename ? 'text-emerald-500' : 'text-zinc-400 animate-pulse'}`} />
              {importFilename ? (
                <div>
                  <span className="font-bold text-xs text-zinc-800 block">Loaded: {importFilename}</span>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Click or drag another file to replace</span>
                </div>
              ) : (
                <div>
                  <span className="font-bold text-xs text-zinc-800 block">Drag and drop stock Excel/CSV here</span>
                  <span className="text-[10px] text-zinc-400 mt-1 block">Supports native Excel spreadsheets (.xlsx, .xls) and standard .csv formats</span>
                </div>
              )}
            </div>

            {/* Parsed Rows Preview */}
            {parsedRows.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center bg-zinc-50 p-2.5 border rounded-xl">
                  <div className="text-xs">
                    <span className="font-bold text-zinc-800">{parsedRows.length} Rows</span> parsed & ready.
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setParsedRows([]); setImportFilename(''); }}
                      className="bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      Clear
                    </button>
                    <button
                      onClick={commitStocksImport}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all uppercase tracking-wider"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Commit into ERP
                    </button>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-zinc-50 text-zinc-500 font-bold border-b text-[10px]">
                      <tr>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Product Name</th>
                        <th className="p-2">Branch</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-zinc-700">
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/40">
                          <td className="p-2 font-mono font-bold">{row.sku || 'N/A'}</td>
                          <td className="p-2 truncate max-w-xs" title={row.productName}>{row.productName}</td>
                          <td className="p-2 truncate" title={row.branchName}>{row.branchName}</td>
                          <td className="p-2 text-center font-bold text-zinc-900">{row.qty}</td>
                          <td className="p-2 text-right">
                            {row.status === 'valid' ? (
                              <span className="bg-green-100 text-green-700 text-[9px] px-2 py-0.5 rounded font-extrabold uppercase">Valid Sync</span>
                            ) : row.status === 'new_sku' ? (
                              <span className="bg-indigo-100 text-indigo-700 text-[9px] px-2 py-0.5 rounded font-extrabold uppercase" title={row.reason}>New Item</span>
                            ) : (
                              <span className="bg-red-100 text-red-700 text-[9px] px-2 py-0.5 rounded font-extrabold uppercase" title={row.reason}>Error</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CATALOG DOCK NEW MODEL MODAL VIEW */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4">
            <h4 className="text-sm font-bold text-zinc-900 flex justify-between items-center border-b border-zinc-100 pb-3.5">
              <span>Add New Hardware Asset SKU</span>
              <button onClick={() => setShowAddProductModal(false)} className="text-zinc-400 font-bold hover:text-zinc-900 text-xs">Close</button>
            </h4>

            <form onSubmit={handleCreateProductCatalog} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-500 font-semibold block">Unique SKU code:</label>
                <input
                  type="text"
                  placeholder="e.g. ASUS-RTX4060TI-08"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold uppercase"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500 font-semibold block">Product/Part Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Asus ROG RTX 4500 GPU"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500 font-semibold block">Choose Category:</label>
                <select
                  value={catSelected}
                  onChange={(e) => setCatSelected(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl outline-none focus:ring-1"
                  required
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500 font-semibold block">Choose Brand:</label>
                <select
                  value={brandSelected}
                  onChange={(e) => setBrandSelected(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl outline-none focus:ring-1"
                  required
                >
                  <option value="">-- Choose Brand --</option>
                  {brandsList.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500 font-semibold block">Buying/Cost Price: (Rs.)</label>
                <input
                  type="number"
                  value={costPrice || ''}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-500 font-semibold block">Showroom Selling Price: (Rs.)</label>
                <input
                  type="number"
                  value={sellingPrice || ''}
                  onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl outline-none"
                  required
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-zinc-550 font-semibold block">Starting Quantity for Active branch:</label>
                <input
                  type="number"
                  value={initialQty || ''}
                  onChange={(e) => setInitialQty(parseInt(e.target.value) || 0)}
                  className="w-full bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl outline-none font-bold"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-zinc-500 font-semibold block">Detailed specifications specifications:</label>
                <textarea
                  placeholder="Technical details like chip speeds, fan count, clock etc."
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl outline-none"
                />
              </div>

              <button
                type="submit"
                className="col-span-2 bg-indigo-600 hover:bg-indigo-705 text-white font-bold py-2.5 rounded-xl mt-2 transition-all uppercase tracking-wider text-[11px]"
              >
                Register into Showroom Channels
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT ITEM MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-extrabold text-white">Modify Item Name & Details</h4>
              </div>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductEdit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block font-bold mb-1">Item Name / Hardware Model Name:</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">SKU / Item Code:</label>
                  <input
                    type="text"
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Barcode:</label>
                  <input
                    type="text"
                    value={editingProduct.barcode || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Cost Price (LKR):</label>
                  <input
                    type="number"
                    value={editingProduct.cost_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Selling Price (LKR):</label>
                  <input
                    type="number"
                    value={editingProduct.selling_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Category:</label>
                  <select
                    value={editingProduct.category_id}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block font-bold mb-1">Brand:</label>
                  <select
                    value={editingProduct.brand_id}
                    onChange={(e) => setEditingProduct({ ...editingProduct, brand_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                  >
                    {brandsList.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block font-bold mb-1">Description / Technical Specifications:</label>
                <textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-extrabold py-3 rounded-2xl transition-all shadow-lg uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Save Item Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL STOCK ADJUSTMENT MODAL */}
      {adjustingStockRow && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-extrabold text-zinc-900">Manual Stock Adjustment</h4>
              </div>
              <button onClick={() => setAdjustingStockRow(null)} className="text-zinc-400 hover:text-zinc-650 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-zinc-50 border rounded-2xl p-4 text-xs space-y-1 text-zinc-700">
              <div><span className="font-semibold text-zinc-500">Product:</span> <strong className="text-zinc-900">{adjustingStockRow.productName}</strong></div>
              <div><span className="font-semibold text-zinc-500">SKU / Code:</span> <code className="bg-zinc-200/50 px-1 py-0.5 rounded font-mono text-zinc-800">{adjustingStockRow.sku}</code></div>
              <div><span className="font-semibold text-zinc-500">Location Branch:</span> <strong className="text-zinc-900">{adjustingStockRow.branchName}</strong></div>
              <div className="pt-1 mt-1 border-t border-zinc-200"><span className="font-semibold text-zinc-500">Current Stock Qty:</span> <strong className="text-emerald-750 text-sm">{adjustingStockRow.qty}</strong> units</div>
            </div>

            <form onSubmit={handleManualStockAdjust} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-700 block font-bold mb-1.5">Adjustment Action Type:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('add')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                      adjustType === 'add'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-200/50'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-250 hover:bg-zinc-100'
                    }`}
                  >
                    ➕ Add Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('deduct')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                      adjustType === 'deduct'
                        ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-200/50'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-250 hover:bg-zinc-100'
                    }`}
                  >
                    ➖ Deduct Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('set')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition-all cursor-pointer ${
                      adjustType === 'set'
                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-200/50'
                        : 'bg-zinc-50 text-zinc-600 border-zinc-250 hover:bg-zinc-100'
                    }`}
                  >
                    🎯 Set Exact Stock
                  </button>
                </div>
              </div>

              <div>
                <label className="text-zinc-700 block font-bold mb-1">
                  {adjustType === 'add' && 'Quantity to ADD:'}
                  {adjustType === 'deduct' && 'Quantity to DEDUCT:'}
                  {adjustType === 'set' && 'New EXACT Stock Level:'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustQtyInput}
                  onChange={(e) => setAdjustQtyInput(parseInt(e.target.value) || 0)}
                  className="w-full bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl text-zinc-900 outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-sm"
                  required
                />
                {adjustType === 'add' && (
                  <p className="text-[10px] text-zinc-400 mt-1">This will increase stock quantity from {adjustingStockRow.qty} to {adjustingStockRow.qty + adjustQtyInput} units.</p>
                )}
                {adjustType === 'deduct' && (
                  <p className="text-[10px] text-rose-500 mt-1">This will decrease stock quantity from {adjustingStockRow.qty} to {Math.max(0, adjustingStockRow.qty - adjustQtyInput)} units.</p>
                )}
                {adjustType === 'set' && (
                  <p className="text-[10px] text-zinc-400 mt-1">This will overwrite the stock level from {adjustingStockRow.qty} to exactly {adjustQtyInput} units.</p>
                )}
              </div>

              <div>
                <label className="text-zinc-700 block font-bold mb-1">Remarks / Reason for Adjustment:</label>
                <input
                  type="text"
                  value={adjustRemarks}
                  onChange={(e) => setAdjustRemarks(e.target.value)}
                  placeholder="e.g., Showroom replenishment, stock count audit, physical damage etc."
                  className="w-full bg-zinc-50 border border-zinc-200 p-2.5 rounded-xl text-zinc-900 outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingStockRow(null)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold py-2.5 rounded-2xl transition-all border text-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-2xl transition-all shadow-md text-center cursor-pointer"
                >
                  Commit Stock Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
