import re

def update_file(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Base dot matrix CSS applied to everything
    dot_matrix_css = """
          body { 
            font-family: 'Courier New', Courier, monospace !important; 
            color: #000 !important;
            background: transparent !important;
          }
          * {
            color: #000 !important;
            background: transparent !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border-color: #000 !important;
            border-radius: 0 !important;
          }
          img { filter: grayscale(100%) contrast(1000%); max-width: 100px; height: auto; }
          svg { stroke: #000 !important; fill: none !important; }
"""

    thermal_style = """    if (format === 'thermal') {
      printStyle = `
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { padding: 3mm; width: 80mm; }
""" + dot_matrix_css + """        }
      `;
    }"""

    a4_half_style = """ else if (format === 'a4-half') {
      printStyle = `
        @media print {
          @page { size: A4 landscape; margin: 4mm; }
          body { padding: 10px; width: 100%; }
""" + dot_matrix_css + """        }
      `;
    }"""

    a4_style = """ else {
      printStyle = `
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body { padding: 15px; width: 100%; }
""" + dot_matrix_css + """        }
      `;
    }"""

    # Replace the if-else block
    # We will regex match from "if (format === 'thermal') {" to "iframeDoc.write('<style>'"
    
    pattern = r"if \(format === 'thermal'\) \{.*?iframeDoc\.write\('<style>'"
    
    replacement = thermal_style + a4_half_style + a4_style + "\n\n    iframeDoc.write('<style>'"
    
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    # Remove A5 and Dot Matrix from the tabs array
    new_content = re.sub(r"\{ key: 'a5', label: 'Standard A5' \},", "", new_content)
    new_content = re.sub(r"\{ key: 'dot-matrix', label: 'Dot Matrix' \},", "", new_content)

    with open(filename, 'w') as f:
        f.write(new_content)

update_file('src/components/POS.tsx')
update_file('src/components/RepairCenter.tsx')
print("Updated successfully")
