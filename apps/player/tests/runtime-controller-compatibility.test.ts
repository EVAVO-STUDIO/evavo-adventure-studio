import { describe, expect, it } from "vitest";
import { createPackagedRuntimeController as sharedController } from "@evavo/adventure-runtime-controller";
import {
  controlledActorRequestFromSave as sharedSaveActorRequest,
  verbForCursorId as sharedVerbForCursorId,
} from "@evavo/adventure-runtime-controller/input";
import { createParserBufferState as sharedParserBuffer } from "@evavo/adventure-runtime-controller/parser";
import { createPackagedRuntimeController as playerController } from "../src/packaged-controller.js";
import {
  controlledActorRequestFromSave as playerSaveActorRequest,
  verbForCursorId as playerVerbForCursorId,
} from "../src/input.js";
import { createParserBufferState as playerParserBuffer } from "../src/parser.js";

describe("Player runtime controller compatibility", () => {
  it("re-exports the shared controller implementation without wrapping it", () => {
    expect(playerController).toBe(sharedController);
    expect(playerVerbForCursorId).toBe(sharedVerbForCursorId);
    expect(playerSaveActorRequest).toBe(sharedSaveActorRequest);
    expect(playerParserBuffer).toBe(sharedParserBuffer);
  });
});
