import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { StudioErrorBoundary } from "./ErrorBoundary.js";
import { GeometryApp } from "./GeometryApp.js";
import "./style.css";
import "./switcher.css";

const root = document.querySelector<HTMLElement>("#root");
if (!root) {
  throw new Error("Adventure Studio root element was not found.");
}

const workspace = new URLSearchParams(window.location.search).get("workspace");
const geometryActive = workspace === "geometry";
const application: ReactNode = geometryActive ? <GeometryApp /> : <App />;

const switcher = document.createElement("a");
switcher.className = "workspace-switcher";
switcher.href = geometryActive ? "/" : "/?workspace=geometry";
switcher.textContent = geometryActive ? "Scene Composer" : "Project Geometry";
switcher.setAttribute(
  "aria-label",
  geometryActive
    ? "Open the scene composition workspace"
    : "Open the project geometry workspace",
);
document.body.appendChild(switcher);

createRoot(root).render(
  <StrictMode>
    <StudioErrorBoundary>{application}</StudioErrorBoundary>
  </StrictMode>,
);
