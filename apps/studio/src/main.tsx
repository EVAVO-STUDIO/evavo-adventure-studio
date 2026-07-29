import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { AnimationApp } from "./AnimationApp.js";
import { DialogueApp } from "./DialogueApp.js";
import { StudioErrorBoundary } from "./ErrorBoundary.js";
import { GeometryApp } from "./GeometryApp.js";
import { ObjectApp } from "./ObjectApp.js";
import { ValidationApp } from "./ValidationApp.js";
import "./style.css";
import "./switcher.css";

const root = document.querySelector<HTMLElement>("#root");
if (!root) {
  throw new Error("Adventure Studio root element was not found.");
}

const workspace = new URLSearchParams(window.location.search).get("workspace");
const application: ReactNode =
  workspace === "geometry" ? (
    <GeometryApp />
  ) : workspace === "objects" ? (
    <ObjectApp />
  ) : workspace === "animation" ? (
    <AnimationApp />
  ) : workspace === "dialogue" ? (
    <DialogueApp />
  ) : workspace === "validation" ? (
    <ValidationApp />
  ) : (
    <App />
  );

const switcher = document.createElement("nav");
switcher.className = "workspace-switcher";
switcher.setAttribute("aria-label", "Adventure Studio workspaces");
const workspaces = [
  { id: "composer", href: "/", label: "Composer" },
  { id: "geometry", href: "/?workspace=geometry", label: "Geometry" },
  { id: "objects", href: "/?workspace=objects", label: "Objects" },
  { id: "animation", href: "/?workspace=animation", label: "Animation" },
  { id: "dialogue", href: "/?workspace=dialogue", label: "Dialogue" },
  { id: "validation", href: "/?workspace=validation", label: "Validate" },
] as const;
const activeWorkspace =
  workspace === "geometry" ||
  workspace === "objects" ||
  workspace === "animation" ||
  workspace === "dialogue" ||
  workspace === "validation"
    ? workspace
    : "composer";
for (const item of workspaces) {
  const link = document.createElement("a");
  link.href = item.href;
  link.textContent = item.label;
  if (item.id === activeWorkspace) {
    link.className = "is-active";
    link.setAttribute("aria-current", "page");
  }
  switcher.appendChild(link);
}
document.body.appendChild(switcher);

createRoot(root).render(
  <StrictMode>
    <StudioErrorBoundary>{application}</StudioErrorBoundary>
  </StrictMode>,
);
