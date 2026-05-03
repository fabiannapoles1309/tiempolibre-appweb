import os
SRC = r"C:\Users\Fabian Napoles\tiempolibre-appweb\artifacts\delivery-saas\src"
IMPORT_LINE = 'import { apiFetch } from "@/lib/api";'
SKIP_FILES = ["api.ts"]
def fix_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    original = content
    fname = os.path.basename(path)
    if fname in SKIP_FILES: return False
    if chr(99)+"redentials: " + chr(34)+"include"+chr(34) not in content: return False
    content = content.replace("await fetch(", "await apiFetch(")
    if "apiFetch" in content and IMPORT_LINE not in content:
        lines = content.split("\n")
        last_import = 0
        for i, line in enumerate(lines):
            if line.strip().startswith("import "): last_import = i
        lines.insert(last_import + 1, IMPORT_LINE)
        content = "\n".join(lines)
    if content != original:
        with open(path, "w", encoding="utf-8") as f: f.write(content)
        print("FIXED: " + path)
        return True
    return False
fixed = 0
for root, dirs, files in os.walk(SRC):
    for fname in files:
        if fname.endswith(".tsx") or fname.endswith(".ts"):
            path = os.path.join(root, fname)
            if fix_file(path): fixed += 1
print("Total arreglados: " + str(fixed))
