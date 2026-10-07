import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// Self-hosted font (no external CDN request). Variable, weights 100-700.
import "@fontsource-variable/ibm-plex-sans";

import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
