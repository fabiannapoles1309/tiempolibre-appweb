import re
with open('artifacts/delivery-saas/src/components/notification-bell.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '{ credentials: "include",\n        credentials: "include",\n      }'
new = '{ credentials: "include" }'
fixed = content.replace(old, new)

with open('artifacts/delivery-saas/src/components/notification-bell.tsx', 'w', encoding='utf-8') as f:
    f.write(fixed)
print('Fix aplicado')