import os
SRC = r"C:\Users\Fabian Napoles\tiempolibre-appweb\artifacts\delivery-saas\src"
IMPORT_LINE = 'import { apiFetch } from "@/lib/api";'
def fix_file(path):
    with open(path,"r",encoding="utf-8") as f: content=f.read()
    original=content
    if os.path.basename(path)=="api.ts": return False
    if "credentials:" not in content: return False
    content=content.replace("await fetch(","await apiFetch(")
    content=content.replace("const r = await apiFetch(","const r = await apiFetch(")
    content=content.replace(" fetch(`"," apiFetch(`")
    content=content.replace("=fetch(`","=apiFetch(`")
    if "apiFetch" in content and IMPORT_LINE not in content:
        lines=content.split("\n"); last=0
        for i,l in enumerate(lines):
            if l.strip().startswith("import "): last=i
        lines.insert(last+1,IMPORT_LINE); content="\n".join(lines)
    if content!=original:
        with open(path,"w",encoding="utf-8") as f: f.write(content)
        print("FIXED: "+path); return True
    return False
fixed=0
for root,dirs,files in os.walk(SRC):
    for fname in files:
        if fname.endswith(".tsx") or fname.endswith(".ts"):
            if fix_file(os.path.join(root,fname)): fixed+=1
print("Total: "+str(fixed))
