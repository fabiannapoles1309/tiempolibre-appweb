import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// When deploying the SPA and the API as separate Cloud Run services they
// live on different origins. `VITE_API_BASE_URL` is baked at build time and
// tells the generated API client where to send requests. When unset (e.g.
// running on Replit where the proxy serves both on the same host) we leave
// the client using relative URLs.
// Accept either a full URL (https://api.example.com) or a bare hostname
// (api.example.com). Render's `fromService.host` returns just the hostname,
// so we add `https://` automatically when no scheme is present.
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseUrl = rawApiBaseUrl
  ? /^https?:\/\//i.test(rawApiBaseUrl)
    ? rawApiBaseUrl
    : `https://${rawApiBaseUrl}`
  : undefined;
if (typeof apiBaseUrl === "string" && apiBaseUrl.trim()) {
  setBaseUrl(apiBaseUrl.trim());
}

createRoot(document.getElementById("root")!).render(<App />);
