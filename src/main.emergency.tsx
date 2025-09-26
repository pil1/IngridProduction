import { createRoot } from "react-dom/client";
import React from "react";
import EmergencyApp from "./App";
import "./globals.css";

// EMERGENCY MINIMAL MAIN - NO PROVIDERS, NO COMPLEXITY
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EmergencyApp />
  </React.StrictMode>
);