import re

def patch_mock(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Find getCategories and getBrands
    if "if (!cats.some(c => c.name === 'Mobile Phones'))" not in content:
        content = content.replace(
            "public getCategories(): ProductCategory[] { return this.getStorage('categories', DEFAULT_CATEGORIES); }",
            "public getCategories(): ProductCategory[] { \n    const cats = this.getStorage('categories', DEFAULT_CATEGORIES);\n    if (!cats.some(c => c.name === 'Mobile Phones')) {\n      const newCats = [...cats, { id: 'cat-mobile', name: 'Mobile Phones', code: 'MOB' }];\n      this.saveCategories(newCats);\n      return newCats;\n    }\n    return cats;\n  }"
        )

    if "if (!brands.some(b => b.name === 'Apple'))" not in content:
        content = content.replace(
            "public getBrands(): Brand[] { return this.getStorage('brands', DEFAULT_BRANDS); }",
            "public getBrands(): Brand[] { \n    const brands = this.getStorage('brands', DEFAULT_BRANDS);\n    if (!brands.some(b => b.name === 'Apple')) {\n      const newBrands = [...brands, { id: 'br-apple', name: 'Apple' }, { id: 'br-xiaomi', name: 'Xiaomi' }, { id: 'br-oppo', name: 'Oppo' }, { id: 'br-vivo', name: 'Vivo' }];\n      this.saveBrands(newBrands);\n      return newBrands;\n    }\n    return brands;\n  }"
        )

    with open(filename, 'w') as f:
        f.write(content)

patch_mock('src/mockData.ts')
print("Patched mockData.ts get methods successfully")
