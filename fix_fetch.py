import re, os

files = [
    "components/DeliveryTimer.tsx",
    "components/pickup-settlement.tsx",
    "pages/admin/DeliveryReport.tsx",
    "pages/admin/Messaging.tsx",
    "pages/admin/Refunds.tsx",
    "pages/admin/ShippingCosts.tsx",
    "pages/driver/DriverStatusToggle.tsx",
    "pages/admin-destinatarios.tsx",
    "pages/admin-feedback.tsx",
    "pages/admin-package-requests.tsx",
    "pages/admin-reports-combined.tsx",
    "pages/admin-staff.tsx",
    "pages/admin-subscriptions.tsx",
    "pages/feedback.tsx",
    "pages/map.tsx",
    "pages/order-new.tsx",
    "pages/wallet.tsx",
]

base = r"C:\Users\Fabian Napoles\tiempolibre-appweb"
import_line = 'import { apiFetch } from "@/lib/api";'

for rel in files:
    path = os.path.join(base, rel)
    if not os.path.exists(path):
        print(f"SKIP: {rel}")
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    original = content
    if import_line not in content:
        lines = content.split('\n')
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                insert_at = i + 1
        lines.insert(insert_at, import_line)
        content = '\n'.join(lines)
    content = re.sub(r'(?<![a-zA-Z])fetch\(', 'apiFetch(', content)
    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"OK: {rel}")
    else:
        print(f"SIN CAMBIOS: {rel}")

print("Done!")