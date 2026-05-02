import re

with open("artifacts/delivery-saas/src/components/notification-bell.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = "const API = import.meta.env.VITE_API_URL ?? \"\";"
new = """const API = import.meta.env.VITE_API_URL ?? "";

function authHeaders(): HeadersInit {
  const token = document.cookie
    .split("; ")
    .find((r) => r.startsWith("rapidoo_session="))
    ?.split("=")[1];
  return token ? { Authorization: "Bearer " + token } : {};
}"""

content = content.replace(old, new)

old2 = 'await fetch(`${API}/api/me/notifications?limit=20`, { credentials: "include" })'
new2 = 'await fetch(`${API}/api/me/notifications?limit=20`, { credentials: "include", headers: authHeaders() })'
content = content.replace(old2, new2)

with open("artifacts/delivery-saas/src/components/notification-bell.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Fix aplicado")