import re

def patch_sql(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Add mobile category
    if "'Mobile Phones'" not in content:
        content = content.replace(
            "('c0000000-0000-0000-0000-000000000003', 'Memory (RAM)', 'RAM');",
            "('c0000000-0000-0000-0000-000000000003', 'Memory (RAM)', 'RAM'),\n('c0000000-0000-0000-0000-000000000004', 'Mobile Phones', 'MOB');"
        )

    # Add mobile brands
    if "'Apple'" not in content:
        content = content.replace(
            "('d0000000-0000-0000-0000-000000000003', 'Corsair');",
            "('d0000000-0000-0000-0000-000000000003', 'Corsair'),\n('d0000000-0000-0000-0000-000000000004', 'Apple'),\n('d0000000-0000-0000-0000-000000000005', 'Xiaomi'),\n('d0000000-0000-0000-0000-000000000006', 'Oppo'),\n('d0000000-0000-0000-0000-000000000007', 'Vivo');"
        )

    with open(filename, 'w') as f:
        f.write(content)

patch_sql('src/components/SQLSetup.tsx')
print("Patched SQLSetup.tsx successfully")
