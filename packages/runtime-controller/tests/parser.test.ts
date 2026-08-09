import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import type { UiSkin } from "@evavo/adventure-ui-skin";
import { describe, expect, it } from "vitest";
import {
  createParserBufferState,
  editParserBuffer,
  parserKeyInputFromKeyboardEvent,
  resolveParserCommand,
} from "../src/parser.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const skin = {
  id: id<"ui-skin">("ui-skin.parser"),
  name: "Parser",
  interactionMode: "parser-assisted",
  nativeSize: { width: 320, height: 200 },
  status: {
    id: id<"ui-region">("ui-region.status"),
    rect: { x: 0, y: 0, width: 320, height: 16 },
    padding: 2,
    panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
  },
  verbs: [
    {
      id: id<"ui-verb">("ui-verb.look"),
      verb: "look",
      label: "LOOK",
      cursorId: "look",
      primary: true,
    },
    {
      id: id<"ui-verb">("ui-verb.open"),
      verb: "open",
      label: "OPEN",
      cursorId: "open",
      primary: false,
    },
    {
      id: id<"ui-verb">("ui-verb.use"),
      verb: "use",
      label: "USE",
      cursorId: "use",
      primary: false,
    },
  ],
  parser: {
    region: {
      id: id<"ui-region">("ui-region.parser"),
      rect: { x: 0, y: 164, width: 320, height: 36 },
      padding: 4,
      panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
    },
    prompt: "> ",
    cursorCharacter: "_",
    historyLimit: 20,
  },
  fonts: {
    status: {
      fontId: id<"bitmap-font">("bitmap-font.ui"),
      color: 0xffffff,
      align: "left",
    },
    parser: {
      fontId: id<"bitmap-font">("bitmap-font.ui"),
      color: 0xffffff,
      align: "left",
    },
  },
} as UiSkin;

const bundle = {
  presentation: {
    pixelMotionPolicy: "strict",
  },
  scenes: [
    {
      id: id<"scene">("scene.office"),
      name: "Rainy Office",
      depthBands: [],
    },
  ],
  inventoryItems: [
    {
      id: id<"item">("item.office-key"),
      name: "Office key",
      description: "A brass key",
      iconAssetId: id<"asset">("asset.key"),
    },
  ],
  sceneInstances: {
    manifestVersion: 1,
    projectId: id<"project">("project.parser"),
    objectDefinitions: [
      {
        id: id<"object-definition">("object-definition.office-door"),
        name: "Office Door",
        initialStateId: id<"object-state">("object-state.office-door.closed"),
        states: [
          {
            id: id<"object-state">("object-state.office-door.closed"),
            visible: true,
            interactionShape: {
              points: [
                { x: -12, y: -48 },
                { x: 12, y: -48 },
                { x: 12, y: 0 },
                { x: -12, y: 0 },
              ],
            },
            interactions: [],
          },
        ],
      },
    ],
    scenes: [
      {
        sceneId: id<"scene">("scene.office"),
        actorInstances: [],
        objectInstances: [
          {
            id: id<"object">("object.office-door"),
            definitionId: id<"object-definition">("object-definition.office-door"),
            position: { x: 250, y: 130 },
            layer: "world",
            elevation: 0,
            zOffset: 0,
            scaleMultiplier: 1,
            mirrored: false,
          },
        ],
        navigationPortals: [],
      },
    ],
  },
} as unknown as RuntimeBundle;

const world = {
  story: {
    currentSceneId: id<"scene">("scene.office"),
    inventory: [id<"item">("item.office-key")],
    objectStates: {},
  },
  actorInstances: {},
} as unknown as InteractiveRuntimeWorldState;

describe("parser input buffer", () => {
  it("edits Unicode text, submits history and navigates previous commands", () => {
    let state = editParserBuffer(createParserBufferState(), { kind: "focus" }).state;
    state = editParserBuffer(state, { kind: "text", text: "look at door" }).state;
    state = editParserBuffer(state, { kind: "backspace" }).state;
    state = editParserBuffer(state, { kind: "text", text: "r" }).state;
    const submitted = editParserBuffer(state, { kind: "submit" });

    expect(submitted.submitted).toBe("look at door");
    expect(submitted.state.text).toBe("");
    expect(submitted.state.history).toEqual(["look at door"]);

    const previous = editParserBuffer(submitted.state, {
      kind: "history-previous",
    });
    expect(previous.state.text).toBe("look at door");
  });

  it("translates browser keys without capturing modified shortcuts", () => {
    expect(
      parserKeyInputFromKeyboardEvent({
        key: "A",
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      }),
    ).toEqual({ kind: "text", text: "A" });
    expect(
      parserKeyInputFromKeyboardEvent({
        key: "Backspace",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
      }),
    ).toEqual({ kind: "delete-word" });
    expect(
      parserKeyInputFromKeyboardEvent({
        key: "s",
        ctrlKey: true,
        metaKey: false,
        altKey: false,
      }),
    ).toBeNull();
  });
});

describe("parser command resolution", () => {
  it("resolves scene looks and authored object nouns", () => {
    expect(resolveParserCommand(bundle, world, skin, "look")).toEqual({
      kind: "scene-look",
      text: "RAINY OFFICE",
    });
    expect(resolveParserCommand(bundle, world, skin, "open the office door")).toMatchObject({
      kind: "object-command",
      verb: "open",
      objectInstanceId: "object.office-door",
      targetName: "Office Door",
    });
  });

  it("resolves carried items in USE item ON object phrases", () => {
    expect(resolveParserCommand(bundle, world, skin, "use office key on office door")).toMatchObject({
      kind: "object-command",
      verb: "use",
      objectInstanceId: "object.office-door",
      itemId: "item.office-key",
    });
  });

  it("returns deterministic help and rejection feedback", () => {
    expect(resolveParserCommand(bundle, world, skin, "help")).toEqual({
      kind: "help",
      text: "LOOK • OPEN • USE",
    });
    expect(resolveParserCommand(bundle, world, skin, "dance")).toEqual({
      kind: "rejected",
      reason: "unknown-verb",
      text: "I DO NOT KNOW THAT VERB",
    });
    expect(resolveParserCommand(bundle, world, skin, "open safe")).toEqual({
      kind: "rejected",
      reason: "unknown-target",
      text: "I CANNOT SEE THAT HERE",
    });
  });
});
