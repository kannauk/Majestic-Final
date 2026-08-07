import re

def patch_mock_data(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Add mobile category
    if "Mobile Phones" not in content:
        content = content.replace(
            "{ id: 'cat-accessories', name: 'Accessories', code: 'ACC' }",
            "{ id: 'cat-accessories', name: 'Accessories', code: 'ACC' },\n  { id: 'cat-mobile', name: 'Mobile Phones', code: 'MOB' }"
        )

    # Add mobile brands
    if "br-apple" not in content:
        content = content.replace(
            "{ id: 'br-majestic', name: 'Majestic Custom' }",
            "{ id: 'br-majestic', name: 'Majestic Custom' },\n  { id: 'br-apple', name: 'Apple' },\n  { id: 'br-xiaomi', name: 'Xiaomi' },\n  { id: 'br-oppo', name: 'Oppo' },\n  { id: 'br-vivo', name: 'Vivo' }"
        )

    with open(filename, 'w') as f:
        f.write(content)

patch_mock_data('src/mockData.ts')
print("Patched mockData.ts successfully")
