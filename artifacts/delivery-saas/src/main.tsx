import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

// Esta es la direcciÃ³n de tu servidor en Google Cloud
const apiUrl = "https://tiempolibre-api-612959916526.us-central1.run.app";

if (apiUrl) {
  setBaseUrl(apiUrl);
}

setAuthTokenGetter(() => localStorage.getItem("tiempolibre_token"));

createRoot(document.getElementById("root")!).render(<App />);

