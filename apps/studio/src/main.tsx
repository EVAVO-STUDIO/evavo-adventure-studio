import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { AdventureAuthenticityApp } from "./AdventureAuthenticityApp.js";
import { AdventureDesignApp } from "./AdventureDesignApp.js";
import { AdventureEvidenceApp } from "./AdventureEvidenceApp.js";
import { AnimationApp } from "./AnimationApp.js";
import { ArtDirectionApp } from "./ArtDirectionApp.js";
import { DialogueApp } from "./DialogueApp.js";
import { StudioErrorBoundary } from "./ErrorBoundary.js";
import { FontApp } from "./FontApp.js";
import { GeometryApp } from "./GeometryApp.js";
import { ObjectApp } from "./ObjectApp.js";
import { PlaytestApp } from "./PlaytestApp.js";
import { UiSkinApp } from "./UiSkinApp.js";
import { ValidationApp } from "./ValidationApp.js";
import "./style.css";
import "./switcher.css";

const root = document.querySelector<HTMLElement>("#root");
if (!root) {
  throw new Error("Adventure Studio root element was not found.");
}

const workspace = new URLSearchParams(window.location.search).get("workspace");
const application: ReactNode =
  workspace === "evidence" ? (
    <AdventureEvidenceApp />
  ) : workspace === "authenticity" ? (
    <AdventureAuthenticityApp />
  ) : workspace === "design" ? (
    <AdventureDesignApp />
  ) : workspace === "geometry" ? (
    <GeometryApp />
  ) : workspace === "objects" ? (
    <ObjectApp />
  ) : workspace === "animation" ? (
    <AnimationApp />
  ) : workspace === "art" ? (
    <ArtDirectionApp />
  ) : workspace === "fonts" ? (
    <FontApp />
  ) : workspace === "interface" ? (
    <UiSkinApp />
  ) : workspace === "dialogue" ? (
    <DialogueApp />
  ) : workspace === "playtest" ? (
    <PlaytestApp />
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
  { id: "design", href: "/?workspace=design", label: "Design" },
  { id: "authenticity", href: "/?workspace=authenticity", label: "Authenticity" },
  { id: "evidence", href: "/?workspace=evidence", label: "Proof" },
  { id: "geometry", href: "/?workspace=geometry", label: "Geometry" },
  { id: "objects", href: "/?workspace=objects", label: "Objects" },
  { id: "animation", href: "/?workspace=animation", label: "Animation" },
  { id: "art", href: "/?workspace=art", label: "Art" },
  { id: "fonts", href: "/?workspace=fonts", label: "Fonts" },
  { id: "interface", href: "/?workspace=interface", label: "Interface" },
  { id: "dialogue", href: "/?workspace=dialogue", label: "Dialogue" },
  { id: "playtest", href: "/?workspace=playtest", label: "Playtest" },
  { id: "validation", href: "/?workspace=validation", label: "Validate" },
] as const;
const activeWorkspace =
  workspace === "evidence" ||
  workspace === "authenticity" ||
  workspace === "design" ||
  workspace === "geometry" ||
  workspace === "objects" ||
  workspace === "animation" ||
  workspace === "art" ||
  workspace === "fonts" ||
  workspace === "interface" ||
  workspace === "dialogue" ||
  workspace === "playtest" ||
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
