import type { GameLifecycleOutcome } from "@evavo/adventure-project-schema/lifecycle";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { SaveGameSlotSnapshot } from "./save-storage.js";
import {
  createGameLifecycleScreenState,
  gameLifecycleScreenItems,
  transitionGameLifecycleScreen,
  type GameLifecycleScreenCapabilities,
  type GameLifecycleScreenEffect,
  type GameLifecycleScreenState,
} from "./lifecycle-screen-state.js";
import "./lifecycle-screen.css";

export interface GameLifecycleScreenOptions {
  readonly bundle: RuntimeBundle;
  readonly outcome: GameLifecycleOutcome;
  readonly snapshots: () => readonly SaveGameSlotSnapshot[];
  readonly loadSlot: (slot: number) => number;
  readonly quickRetry?: () => number;
}

export type GameLifecycleScreenResult =
  | { readonly kind: "loaded"; readonly tick: number; readonly slot: number }
  | { readonly kind: "retry"; readonly tick: number }
  | { readonly kind: "restart" }
  | { readonly kind: "title" };

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

const fitNativeFrame = (host: HTMLElement, frame: HTMLElement): void => {
  const scale = Math.max(
    0.1,
    Math.min(Math.max(1, host.clientWidth) / 320, Math.max(1, host.clientHeight) / 200),
  );
  frame.style.setProperty("--game-lifecycle-scale", String(scale));
};

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const heading = (state: GameLifecycleScreenState, outcome: GameLifecycleOutcome): string =>
  state.screen === "load" ? outcome.menu.labels.loadGame : outcome.title;

export const runGameLifecycleScreen = (
  host: HTMLElement,
  options: GameLifecycleScreenOptions,
): Promise<GameLifecycleScreenResult> =>
  new Promise((resolve) => {
    let state = createGameLifecycleScreenState();
    let notice: string | null = null;
    let settled = false;
    const capabilities: GameLifecycleScreenCapabilities = {
      ...(options.quickRetry ? { quickRetryAvailable: true } : {}),
    };

    const stage = element("div", `game-lifecycle-stage is-${options.outcome.kind}`);
    const shade = element("div", "game-lifecycle-shade");
    const frame = element("section", "game-lifecycle-frame");
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-modal", "true");
    frame.setAttribute("aria-label", `${options.outcome.title} game lifecycle screen`);
    stage.append(shade, frame);
    stage.addEventListener("pointerdown", (event) => event.stopPropagation());
    stage.addEventListener("pointerup", (event) => event.stopPropagation());
    stage.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    host.appendChild(stage);

    const resizeObserver = new ResizeObserver(() => fitNativeFrame(host, frame));
    resizeObserver.observe(host);
    fitNativeFrame(host, frame);

    const cleanup = (): void => {
      if (settled) return;
      settled = true;
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown, true);
      stage.remove();
    };

    const complete = (result: GameLifecycleScreenResult): void => {
      cleanup();
      resolve(result);
    };

    const applyEffect = (effect: GameLifecycleScreenEffect): void => {
      if (!effect) return;
      switch (effect.kind) {
        case "quick-retry":
          try {
            if (!options.quickRetry) {
              notice = "QUICK RETRY IS NOT AVAILABLE.";
              render();
              return;
            }
            complete({ kind: "retry", tick: options.quickRetry() });
          } catch (error) {
            notice = `RETRY FAILED — ${errorText(error)}`;
            render();
          }
          return;
        case "restart":
          complete({ kind: "restart" });
          return;
        case "title":
          complete({ kind: "title" });
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

    const apply = (command: Parameters<typeof transitionGameLifecycleScreen>[1]): void => {
      const transition = transitionGameLifecycleScreen(
        state,
        command,
        options.outcome,
        options.snapshots(),
        capabilities,
      );
      state = transition.state;
      applyEffect(transition.effect);
      if (!settled && !transition.effect) render();
    };

    const render = (): void => {
      const snapshots = options.snapshots();
      const items = gameLifecycleScreenItems(state, options.outcome, snapshots, capabilities);
      frame.replaceChildren();
      frame.dataset["screen"] = state.screen;
      frame.dataset["outcomeKind"] = options.outcome.kind;

      const title = element("header", "game-lifecycle-heading");
      title.append(
        element("span", "game-lifecycle-kicker", options.bundle.title),
        element("h2", "game-lifecycle-title", heading(state, options.outcome)),
      );
      title.appendChild(
        element(
          "p",
          "game-lifecycle-message",
          state.screen === "root"
            ? options.outcome.message
            : "Choose a compatible save. Empty and damaged slots cannot be loaded.",
        ),
      );
      frame.appendChild(title);

      const list = element("div", "game-lifecycle-items");
      items.forEach((item, index) => {
        const button = element("button", "game-lifecycle-item");
        button.type = "button";
        button.disabled = !item.enabled;
        button.dataset["selected"] = index === state.selectedIndex ? "true" : "false";
        button.appendChild(element("strong", "", item.label));
        if (item.detail) button.appendChild(element("small", "", item.detail));
        button.addEventListener("pointerenter", () => apply({ kind: "set-selection", index }));
        button.addEventListener("click", () => {
          const selected = transitionGameLifecycleScreen(
            state,
            { kind: "set-selection", index },
            options.outcome,
            options.snapshots(),
            capabilities,
          );
          state = selected.state;
          apply({ kind: "activate" });
        });
        list.appendChild(button);
      });
      frame.appendChild(list);

      if (notice) frame.appendChild(element("div", "game-lifecycle-notice", notice));
      frame.appendChild(
        element(
          "footer",
          "game-lifecycle-footer",
          state.screen === "load" ? "↑ ↓ SELECT   ENTER LOAD   ESC BACK" : "↑ ↓ SELECT   ENTER CHOOSE",
        ),
      );
      queueMicrotask(() => {
        frame.querySelector<HTMLButtonElement>('[data-selected="true"]')?.focus();
      });
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      event.stopPropagation();
      if (event.key === "ArrowUp") {
        apply({ kind: "move-selection", delta: -1 });
        event.preventDefault();
      } else if (event.key === "ArrowDown") {
        apply({ kind: "move-selection", delta: 1 });
        event.preventDefault();
      } else if (event.key === "Enter" || event.key === " ") {
        apply({ kind: "activate" });
        event.preventDefault();
      } else if (event.key === "Escape" && state.screen === "load") {
        apply({ kind: "back" });
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    render();
  });
