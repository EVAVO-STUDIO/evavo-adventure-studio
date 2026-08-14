import {
  classicFrontEndMenuItems,
  createClassicFrontEndState,
  DEFAULT_CLASSIC_FRONT_END_POLICY,
  transitionClassicFrontEnd,
  type ClassicFrontEndCommand,
  type ClassicFrontEndEffect,
  type ClassicFrontEndStartMode,
  type ClassicFrontEndState,
} from "./classic-front-end-state.js";
import "./classic-front-end.css";

export interface ClassicFrontEndOptions {
  readonly title: string;
  readonly hasSave: boolean;
  readonly notice?: string;
}

export const classicFrontEndSkipped = (search: string): boolean => {
  const value = new URLSearchParams(search).get("shell");
  return value === "skip" || value === "off" || value === "0";
};

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
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  const scale = Math.max(0.1, Math.min(width / 320, height / 200));
  frame.style.setProperty("--classic-front-end-scale", String(scale));
};

const requestFullscreen = async (): Promise<void> => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  const target = document.querySelector<HTMLElement>(".player-shell") ?? document.documentElement;
  await target.requestFullscreen();
};

export const runClassicFrontEnd = (
  host: HTMLElement,
  options: ClassicFrontEndOptions,
): Promise<ClassicFrontEndStartMode> =>
  new Promise((resolve) => {
    let state = createClassicFrontEndState(options.hasSave);
    let notice = options.notice ?? null;
    let previousTime = performance.now();
    let tickRemainder = 0;
    let animationFrame = 0;
    let settled = false;

    host.dataset["mode"] = "classic-front-end";
    host.style.cursor = "default";
    host.tabIndex = 0;
    host.setAttribute("aria-label", `${options.title} classic game front end`);

    const stage = element("div", "classic-front-end-stage");
    const frame = element("section", "classic-front-end-frame");
    frame.setAttribute("aria-live", "polite");
    stage.appendChild(frame);
    host.replaceChildren(stage);

    const resizeObserver = new ResizeObserver(() => fitNativeFrame(host, frame));
    resizeObserver.observe(host);
    fitNativeFrame(host, frame);

    const cleanup = (): void => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      host.removeEventListener("pointerdown", onSplashPointer);
    };

    const complete = (mode: ClassicFrontEndStartMode): void => {
      cleanup();
      resolve(mode);
    };

    const applyEffect = (effect: ClassicFrontEndEffect): void => {
      if (!effect) return;
      if (effect.kind === "start") {
        complete(effect.mode);
        return;
      }
      void requestFullscreen().catch(() => {
        notice = "FULLSCREEN IS NOT AVAILABLE IN THIS HOST.";
        render();
      });
    };

    const apply = (command: ClassicFrontEndCommand): void => {
      const transition = transitionClassicFrontEnd(
        state,
        command,
        DEFAULT_CLASSIC_FRONT_END_POLICY,
      );
      state = transition.state;
      applyEffect(transition.effect);
      if (!settled) render();
    };

    const menu = (heading: string, description?: string): HTMLElement => {
      const panel = element("div", "classic-front-end-menu");
      panel.appendChild(element("h2", "classic-front-end-menu-title", heading));
      if (description) panel.appendChild(element("p", "classic-front-end-copy", description));
      const items = classicFrontEndMenuItems(state);
      const list = element("div", "classic-front-end-menu-items");
      items.forEach((item, index) => {
        const button = element("button", "classic-front-end-menu-item", item.label);
        button.type = "button";
        button.disabled = !item.enabled;
        button.dataset["selected"] = index === state.selectedIndex ? "true" : "false";
        button.addEventListener("pointerenter", () => apply({ kind: "set-selection", index }));
        button.addEventListener("click", () => {
          const selection = transitionClassicFrontEnd(state, { kind: "set-selection", index });
          state = selection.state;
          apply({ kind: "activate" });
        });
        list.appendChild(button);
      });
      panel.appendChild(list);
      return panel;
    };

    const footer = (): HTMLElement =>
      element(
        "div",
        "classic-front-end-footer",
        "↑ ↓ SELECT   ENTER CHOOSE   ESC BACK",
      );

    const render = (): void => {
      frame.replaceChildren();
      frame.dataset["screen"] = state.screen;
      if (state.screen === "publisher-splash") {
        const splash = element("div", "classic-front-end-splash");
        const mark = element("strong", "classic-front-end-publisher", "EVAVO");
        const studio = element("span", "classic-front-end-presents", "ADVENTURE STUDIO PRESENTS");
        splash.append(mark, studio);
        if (state.splashTick >= DEFAULT_CLASSIC_FRONT_END_POLICY.splashSkipAfterTicks) {
          splash.appendChild(element("small", "classic-front-end-skip", "PRESS ANY KEY"));
        }
        frame.appendChild(splash);
        return;
      }

      const title = element("header", "classic-front-end-title");
      title.append(
        element("span", "classic-front-end-kicker", "A CLASSIC POINT & CLICK ADVENTURE"),
        element("h1", "classic-front-end-game-title", options.title),
      );
      frame.appendChild(title);

      switch (state.screen) {
        case "title-menu":
          frame.appendChild(menu("MAIN MENU"));
          break;
        case "load-menu":
          frame.appendChild(
            menu(
              "LOAD GAME",
              state.hasSave
                ? "One verified browser quick-save slot is available."
                : "No compatible quick save is available.",
            ),
          );
          break;
        case "options": {
          const panel = menu("OPTIONS");
          const facts = element("div", "classic-front-end-options-facts");
          facts.append(
            element("span", "", "NATIVE CANVAS  320 × 200"),
            element("span", "", "PIXEL SCALE    INTEGER / NEAREST"),
            element("span", "", "LANGUAGE       STATUS RAIL SELECTOR"),
          );
          panel.insertBefore(facts, panel.querySelector(".classic-front-end-menu-items"));
          frame.appendChild(panel);
          break;
        }
        case "credits": {
          const panel = menu("CREDITS");
          const credits = element("div", "classic-front-end-credits-copy");
          credits.append(
            element("p", "", options.title),
            element("p", "", "RUNNING ON EVAVO ADVENTURE STUDIO"),
            element("p", "", "ORIGINAL GAME CONTENT REMAINS THE PUBLISHER'S WORK."),
          );
          panel.insertBefore(credits, panel.querySelector(".classic-front-end-menu-items"));
          frame.appendChild(panel);
          break;
        }
        case "quit":
          frame.appendChild(
            menu(
              "QUIT",
              "This browser session is paused. Close the tab or return to the title screen.",
            ),
          );
          break;
        case "publisher-splash":
          break;
      }
      if (notice) frame.appendChild(element("div", "classic-front-end-notice", notice));
      frame.appendChild(footer());
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (state.screen === "publisher-splash") {
        apply({ kind: "skip-splash" });
        event.preventDefault();
        return;
      }
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

    const onSplashPointer = (): void => {
      if (state.screen === "publisher-splash") apply({ kind: "skip-splash" });
    };

    const animate = (now: number): void => {
      if (settled) return;
      if (state.screen === "publisher-splash") {
        const elapsed = Math.max(0, Math.min(250, now - previousTime));
        const exactTicks = tickRemainder + (elapsed * 60) / 1000;
        const wholeTicks = Math.floor(exactTicks);
        tickRemainder = exactTicks - wholeTicks;
        if (wholeTicks > 0) apply({ kind: "tick", ticks: wholeTicks });
      }
      previousTime = now;
      animationFrame = requestAnimationFrame(animate);
    };

    window.addEventListener("keydown", onKeyDown);
    host.addEventListener("pointerdown", onSplashPointer);
    host.focus();
    render();
    animationFrame = requestAnimationFrame(animate);
  });