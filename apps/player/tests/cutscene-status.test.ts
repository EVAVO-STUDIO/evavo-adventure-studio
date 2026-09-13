import {
  canonicalPlayerSystemText,
  type PlayerSystemTextResolver,
} from "@evavo/adventure-project-schema/localisation";
import { describe, expect, it } from "vitest";
import { playerCutsceneStatusText } from "../src/cutscene-status.js";

const translated: PlayerSystemTextResolver = (field, values = {}) => {
  const copy = {
    "status.cutscene": "CINÉMATIQUE",
    "status.cutsceneCaptionSkippable": "{caption} • ÉCHAP",
    "status.cutsceneNameSkippable": "{name} • ÉCHAP POUR PASSER",
  } as const;
  const template = copy[field as keyof typeof copy];
  return template
    ? template.replace(/\{(caption|name)\}/g, (placeholder, key: string) =>
        String(values[key] ?? placeholder),
      )
    : canonicalPlayerSystemText(field, values);
};

describe("Player cutscene status", () => {
  it("uses governed fallback and skip hints without changing authored captions", () => {
    expect(playerCutsceneStatusText(null, translated)).toBe("CINÉMATIQUE");
    expect(
      playerCutsceneStatusText(
        { name: "The red ledger", caption: "Do not open that drawer.", canSkip: false },
        translated,
      ),
    ).toBe("Do not open that drawer.");
    expect(
      playerCutsceneStatusText(
        { name: "The red ledger", caption: "Do not open that drawer.", canSkip: true },
        translated,
      ),
    ).toBe("Do not open that drawer. • ÉCHAP");
  });

  it("formats translated sequence-name skip guidance", () => {
    expect(
      playerCutsceneStatusText(
        { name: "The red ledger", caption: null, canSkip: true },
        translated,
      ),
    ).toBe("THE RED LEDGER • ÉCHAP POUR PASSER");
  });
});
