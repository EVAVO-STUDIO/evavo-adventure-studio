import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { StudioErrorBoundary } from "./ErrorBoundary.js";
import { GeometryApp } from "./GeometryApp.js";
import "./style.css";

const root = document.querySelector<HTMLElement>("#root");
if (!root) {
  throw new Error("Adventure Studio root element was not found.");
}

const workspace = new URLSearchParams(window.location.search).get("workspace");
const application: ReactNode = workspace === "geometry" ? <GeometryApp /> : <App />;

createRoot(root).render(
  <StrictMode>
    <StudioErrorBoundary>{application}</StudioErrorBoundary>
  </StrictMode>,
);
