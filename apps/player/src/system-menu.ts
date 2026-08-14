import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGameSlotSnapshot } from "./save-storage.js";
import {
  classicSystemMenuItems,
  createClassicSystemMenuState,
  transitionClassicSystemMenu,
  type ClassicSystemMenuEffect,
  type ClassicSystemMenuState,
} from "./system-menu-state.js";
import "./system-menu.css";

export interface ClassicSystemMenuOptions {
  readonly bundle: RuntimeBundle;
  readonly snapshots: () => readonly SaveGameSlotSnapshot[];
  readonly saveSlot: (slot: number) => void;
  readonly loadSlot: (slot: number) => number;
}

export type ClassicSystemMenuResult =
  | { readonly kind: "resume" }
  | { readonly kind: "loaded"; readonly tick: number; readonly slot: number }
  | { readonly kind: "return-to-title" };

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const fitNativeFrame = (host: HTMLElement, frame: HTMLElement): void => {
  const scale = Math.max(
    0.1,
    Math.min(Math.max(1, host.clientWidth) / 320, Math.max(1, host.clientHeight) / 200),
  );
  frame.style.setProperty("--classic-system-menu-scale", String(scale));
};

const requestFullscreen = async (): Promise<void> => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  const target = document.querySelector<HTMLElement>(".player-shell") ?? document.documentElement;
  await target.requestFullscreen();
};

const screenHeading = (state: ClassicSystemMenuState): string => {
  switch (state.screen) {
    case "root":
      return "GAME PAUSED";
    case "save":
      return "SAVE GAME";
    case "load":
      return "LOAD GAME";
    case "options":
      return "OPTIONS";
    case "title-confirm":
      return "RETURN TO TITLE?";
  }
};

const screenDescription = (state: ClassicSystemMenuState): string | null => {
  switch (state.screen) {
    case "save":
      return "Choose a slot. Existing saves in that slot will be replaced.";
    case "load":
      return "Choose a compatible save to restore its exact logical game state.";
    case "options":
      return "System display settings do not alter game state or replay history.";
    case "title-confirm":
      return "Unsaved progress since the last save will be lost.";
    case "root":
      return null;
  }
};

export const runClassicSystemMenu = (
  host: HTMLElement,
  options: ClassicSystemMenuOptions,
): Promise<ClassicSystemMenuResult> =>
  new Promise((resolve) => {
    let state = createClassicSystemMenuState();
    let notice: string | null = null;
    let settled = false;

    const stage = element("div", "classic-system-menu-stage");
    const shade = element("div", "classic-system-menu-shade");
    const frame = element("section", "classic-system-menu-frame");
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-modal", "true");
    frame.setAttribute("aria-label", `${options.bundle.title} system menu`);
    stage.append(shade, frame);
    host.appendChild(stage);

    const resizeObserver = new ResizeObserver(() => fitNativeFrame(host, frame));
    resizeObserver.observe(host);
    fitNativeFrame(host, frame);

    const cleanup = (): void => {
      if (settled) return;
      settled = true;
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      stage.remove();
    };

    const complete = (result: ClassicSystemMenuResult): void => {
      cleanup();
      resolve(result);
    };

    const applyEffect = (effect: ClassicSystemMenuEffect): void => {
      if (!effect) return;
      switch (effect.kind) {
        case "resume":
          complete({ kind: "resume" });
          return;
        case "return-to-title":
          complete({ kind: "return-to-title" });
          return;
        case "request-fullscreen":
          void requestFullscreen()
            .then(() => {
              notice = document.fullscreenElement ? "FULLSCREEN ENABLED." : "FULLSCREEN DISABLED.";
              render();
            })
            .catch(() => {
              notice = "FULLSCREEN IS NOT AVAILABLE IN THIS HOST.";
              render();
            });
          return;
        case "save-slot":
          try {
            options.saveSlot(effect.slot);
            notice = effect.slot === 0 ? "QUICK SAVE WRITTEN." : `SAVE SLOT ${effect.slot} WRITTEN.`;
            render();
          } catch (error) {
            notice = `SAVE FAILED — ${errorText(error)}`;
            render();
          }
          return;
        case "load-slot":
          try {
            const tick = options.loadSlot(effect.slot);
            complete({ kind: "loaded", tick, slot: effect.slot });
          } catch (error) {
            notice = `LOAD FAILED — ${errorText(error)}`;
            render();
          }
          return;
      }
    };

    const apply = (command: Parameters<typeof transitionClassicSystemMenu>[1]): void => {
      const transition = transitionClassicSystemMenu(state, command, options.snapshots());
      state = transition.state;
      applyEffect(transition.effect);
      if (!settled && !transition.effect) render();
    };

    const render = (): void => {
      const snapshots = options.snapshots();
      const items = classicSystemMenuItems(state, snapshots);
      frame.replaceChildren();
      frame.dataset["screen"] = state.screen;

      const heading = element("header", "classic-system-menu-heading");
      heading.append(
        element("span", "classic-system-menu-kicker", options.bundle.title),
        element("h2", "classic-system-menu-title", screenHeading(state)),
      );
      const description = screenDescription(state);
      if (description) heading.appendChild(element("p", "classic-system-menu-description", description));
      frame.appendChild(heading);

      const list = element("div", "classic-system-menu-items");
      items.forEach((item, index) => {
        const button = element("button", "classic-system-menu-item");
        button.type = "button";
        button.disabled = !item.enabled;
        button.dataset["selected"] = index === state.selectedIndex ? "true" : "false";
        const label = element("strong", "", item.label);
        button.appendChild(label);
        if (item.detail) button.appendChild(element("small", "", item.detail));
        button.addEventListener("pointerenter", () => apply({ kind: "set-selection", index }));
        button.addEventListener("click", () => {
          const selected = transitionClassicSystemMenu(
            state,
            { kind: "set-selection", index },
            options.snapshots(),
          );
          state = selected.state;
          apply({ kind: "activate" });
        });
        list.appendChild(button);
      });
      frame.appendChild(list);

      if (notice) frame.appendChild(element("div", "classic-system-menu-notice", notice));
      frame.appendChild(
        element("footer", "classic-system-menu-footer", "↑ ↓ SELECT   ENTER CHOOSE   ESC BACK / RESUME"),
      );
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "ArrowUp") {
        apply({ kind: "move-selection", delta: -1 });
        event.preventDefault();
      } else if (event.key === "ArrowDown") {
        apply({ kind: "move-selection", delta: 1 });
        event.preventDefault();
      } else if (event.key === "Enter" || event.key === " ") {
        apply({ kind: "activate" });
        event.preventDefault();
      } else if (event.key === "Escape") {
        apply({ kind: "back" });
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    render();
    const selected = frame.querySelector<HTMLButtonElement>('[data-selected="true"]');
    selected?.focus();
  });
