import { describe, expect, it } from "vitest";
import { idSchema } from "../src/index.js";
import {
  classicFrontEndManifestSchema,
  createDefaultClassicFrontEndManifest,
} from "../src/front-end.js";

describe("classic front-end manifest", () => {
  it("creates a complete deterministic default for a project", () => {
    const projectId = idSchema("project").parse("project.front-end");
    const manifest = createDefaultClassicFrontEndManifest(projectId);

    expect(manifest).toMatchObject({
      manifestVersion: 1,
      projectId,
      publisher: {
        name: "EVAVO",
        splashDurationTicks: 96,
        splashSkipAfterTicks: 18,
      },
      menu: {
        showContinue: true,
        showLoad: true,
        showOptions: true,
        showCredits: true,
        showQuit: true,
      },
      options: { allowFullscreen: true },
    });
  });

  it("rejects a splash skip point after the splash has already ended", () => {
    const input = createDefaultClassicFrontEndManifest(
      idSchema("project").parse("project.front-end"),
    );

    expect(() =>
      classicFrontEndManifestSchema.parse({
        ...input,
        publisher: {
          ...input.publisher,
          splashDurationTicks: 30,
          splashSkipAfterTicks: 31,
        },
      }),
    ).toThrow(/cannot exceed/i);
  });
});