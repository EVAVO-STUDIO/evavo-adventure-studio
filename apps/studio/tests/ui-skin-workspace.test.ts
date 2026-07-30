import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import {
  createUiSkinWorkspace,
  replaceSelectedUiSkinCommand,
  replaceUiVerbCommand,
  selectedUiSkin,
  uiSkinWorkspaceIsDirty,
  uiSkinWorkspaceIssues,
  uiSkinWorkspacePreviewNodes,
  uiSkinWorkspaceReducer,
} from "../src/ui-skin-workspace.js";
import {
  studioUiBitmapFonts,
  studioUiProject,
  studioUiSkins,
} from "../src/ui-skin-fixture.js";

const skinId = (value: string): Id<"ui-skin"> => value as Id<"ui-skin">;

describe("interface skin Studio workspace", () => {
  it("loads six valid interaction modes with a context default", () => {
    const state = createUiSkinWorkspace(
      studioUiProject,
      studioUiBitmapFonts,
      studioUiSkins,
    );

    expect(
      state.history.document.manifest.skins.map((skin) => skin.interactionMode),
    ).toEqual([
      "context",
      "verb-list",
      "icon-bar",
      "two-button",
      "verb-coin",
      "parser-assisted",
    ]);
    expect(selectedUiSkin(state)).toMatchObject({
      id: "ui-skin.context-noir",
      interactionMode: "context",
    });
    expect(
      uiSkinWorkspaceIssues(state).filter((issue) => issue.severity === "error"),
    ).toEqual([]);
  });

  it("composes status score inventory and dialogue nodes from the runtime composer", () => {
    const state = createUiSkinWorkspace(
      studioUiProject,
      studioUiBitmapFonts,
      studioUiSkins,
    );
    const ids = uiSkinWorkspacePreviewNodes(state).map((node) => node.id);

    expect(ids).toContain("studio.ui-preview.status.text");
    expect(ids).toContain("studio.ui-preview.score.text");
    expect(ids).toContain("studio.ui-preview.inventory.item.item.notebook");
    expect(ids).toContain(
      "studio.ui-preview.dialogue.choice.dialogue-choice.preview.ledger.text",
    );
  });

  it("composes parser and verb-coin modes from preview state", () => {
    let state = createUiSkinWorkspace(
      studioUiProject,
      studioUiBitmapFonts,
      studioUiSkins,
    );
    state = uiSkinWorkspaceReducer(state, {
      type: "select-skin",
      skinId: skinId("ui-skin.parser-assisted"),
    });
    expect(uiSkinWorkspacePreviewNodes(state).map((node) => node.id)).toContain(
      "studio.ui-preview.parser.text",
    );

    state = uiSkinWorkspaceReducer(state, {
      type: "select-skin",
      skinId: skinId("ui-skin.verb-coin"),
    });
    expect(
      uiSkinWorkspacePreviewNodes(state).filter((node) =>
        String(node.id).startsWith("studio.ui-preview.coin."),
      ).length,
    ).toBeGreaterThan(4);
  });

  it("edits native regions with undo redo and save tracking", () => {
    let state = createUiSkinWorkspace(
      studioUiProject,
      studioUiBitmapFonts,
      studioUiSkins,
    );
    const current = selectedUiSkin(state);
    state = uiSkinWorkspaceReducer(state, {
      type: "execute",
      command: replaceSelectedUiSkinCommand(state, {
        ...current,
        status: {
          ...current.status,
          rect: { ...current.status.rect, height: 18 },
        },
      }),
    });
    expect(selectedUiSkin(state).status.rect.height).toBe(18);
    expect(uiSkinWorkspaceIsDirty(state)).toBe(true);

    state = uiSkinWorkspaceReducer(state, { type: "undo" });
    expect(selectedUiSkin(state).status.rect.height).toBe(16);
    expect(uiSkinWorkspaceIsDirty(state)).toBe(false);

    state = uiSkinWorkspaceReducer(state, { type: "redo" });
    expect(selectedUiSkin(state).status.rect.height).toBe(18);
    state = uiSkinWorkspaceReducer(state, { type: "mark-saved" });
    expect(uiSkinWorkspaceIsDirty(state)).toBe(false);
  });

  it("preserves authored verb order while editing labels", () => {
    let state = createUiSkinWorkspace(
      studioUiProject,
      studioUiBitmapFonts,
      studioUiSkins,
    );
    state = uiSkinWorkspaceReducer(state, {
      type: "select-skin",
      skinId: skinId("ui-skin.verb-list"),
    });
    const skin = selectedUiSkin(state);
    const talk = skin.verbs.find((verb) => verb.verb === "talk")!;
    const order = skin.verbs.map((verb) => verb.id);

    state = uiSkinWorkspaceReducer(state, {
      type: "execute",
      command: replaceUiVerbCommand(state, { ...talk, label: "SPEAK" }),
    });

    expect(selectedUiSkin(state).verbs.map((verb) => verb.id)).toEqual(order);
    expect(
      selectedUiSkin(state).verbs.find((verb) => verb.id === talk.id)?.label,
    ).toBe("SPEAK");
  });

  it("keeps rejected interface edits out of history and reports a notice", () => {
    const state = createUiSkinWorkspace(
      studioUiProject,
      studioUiBitmapFonts,
      studioUiSkins,
    );
    const current = selectedUiSkin(state);
    const rejected = uiSkinWorkspaceReducer(state, {
      type: "execute",
      command: replaceSelectedUiSkinCommand(state, {
        ...current,
        status: {
          ...current.status,
          rect: { x: 0, y: 195, width: 320, height: 20 },
        },
      }),
    });

    expect(rejected.history).toBe(state.history);
    expect(selectedUiSkin(rejected).status.rect).toEqual(current.status.rect);
    expect(rejected.notice).toMatch(/interface edit rejected/i);
    expect(uiSkinWorkspaceIsDirty(rejected)).toBe(false);
  });
});
