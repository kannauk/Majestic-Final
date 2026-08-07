import sys

def patch_print(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # 1. Update the tabs map
    if "{ key: 'dot-matrix', label: 'Dot Matrix' }" not in content:
        content = content.replace(
            "{ key: 'a5', label: 'Standard A5' },",
            "{ key: 'a5', label: 'Standard A5' },\n                  { key: 'dot-matrix', label: 'Dot Matrix' },"
        )

    # 2. Add dot-matrix to handlePrint logic
    dot_matrix_style = """    } else if (format === 'dot-matrix') {
      printStyle = `
        @media print {
          @page { size: auto; margin: 4mm; }
          body { 
            padding: 10px; 
            width: 100%; 
            font-family: 'Courier New', Courier, monospace !important; 
            color: #000 !important;
            background: transparent !important;
            font-size: 11pt !important;
          }
          * {
            color: #000 !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border-color: #000 !important;
            border-radius: 0 !important;
          }
          .border, .border-b, .border-t, .border-l, .border-r {
             border-width: 1px !important;
             border-style: dashed !important;
             border-color: #000 !important;
          }
          img { filter: grayscale(100%) contrast(1000%); max-width: 100px; height: auto; }
          svg { stroke: #000 !important; fill: none !important; }
        }
      `;"""
    
    if "format === 'dot-matrix'" not in content:
        content = content.replace(
            "    } else {",
            dot_matrix_style + "\n    } else {"
        )

    with open(filename, 'w') as f:
        f.write(content)

patch_print('src/components/POS.tsx')
patch_print('src/components/RepairCenter.tsx')
print("Patched successfully")
