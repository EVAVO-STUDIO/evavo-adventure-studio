import {
  createPackagedRuntimeController as sharedController,
  type PackagedRuntimeController as SharedPackagedRuntimeController,
} from "@evavo/adventure-runtime-controller";
import {
  controlledActorRequestFromSave as sharedSaveActorRequest,
  verbForCursorId as sharedVerbForCursorId,
} from "@evavo/adventure-runtime-controller/input";
import { createParserBufferState as sharedParserBuffer } from "@evavo/adventure-runtime-controller/parser";
import { describe, expect, it } from "vitest";
import {
  controlledActorRequestFromSave as playerSaveActorRequest,
  verbForCursorId as playerVerbForCursorId,
} from "../src/input.js";
import {
  createPackagedRuntimeController as playerController,
  type PackagedRuntimeController as PlayerPackagedRuntimeController,
} from "../src/packaged-controller.js";
import { createParserBufferState as playerParserBuffer } from "../src/parser.js";

const sharedControllerView = (
  controller: PlayerPackagedRuntimeController,
): SharedPackagedRuntimeController => controller;

describe("Player runtime controller compatibility", () => {
  it("keeps shared parser and input helpers by identity", () => {
    expect(playerVerbForCursorId).toBe(sharedVerbForCursorId);
    expect(playerSaveActorRequest).toBe(sharedSaveActorRequest);
    expect(playerParserBuffer).toBe(sharedParserBuffer);
  });

  it("uses a player-owned controller wrapper while preserving the shared controller contract", () => {
    expect(playerController).not.toBe(sharedController);
    expect(sharedControllerView).toEqual(expect.any(Function));
  });
});
