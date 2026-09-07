import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./pages/App";
import { WalletProvider } from "./lib/WalletContext";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </StrictMode>,
);
