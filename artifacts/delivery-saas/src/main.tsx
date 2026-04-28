import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// When deploying the SPA and the API as separate services (e.g. a Render
// Static Site for the SPA + a Render Web Service for the API) they live on
// different origins. `VITE_API_BASE_URL` is baked at build time and tells
// the generated API client where to send requests. When unset (e.g. running
// on Replit where the proxy serves both on the same host) we leave the
// client using relative URLs.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (typeof apiBaseUrl === "string" && apiBaseUrl.trim()) {
  setBaseUrl(apiBaseUrl.trim());
}

createRoot(document.getElementById("root")!).render(<App />);
