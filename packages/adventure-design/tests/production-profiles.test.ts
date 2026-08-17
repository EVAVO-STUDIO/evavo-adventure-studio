import type { AdventureProject, Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  type AdventureProductionProfile,
  adventureProductionProfileById,
  adventureProductionProfileIds,
  adventureProductionProfiles,
  auditAdventureProductionProfile,
  createAdventureProductionProfileSeed,
  validateAdventureProductionProfile,
} from "../src/production-profiles.js";
import type { AdventureDesignDocument } from "../src/types.js";

const projectId = "project.production-profile-test" as Id<"project">;

const matchingDesign = (profile: AdventureProductionProfile): AdventureDesignDocument => {
  const seed = createAdventureProductionProfileSeed(profile);
  return {
    documentVersion: 1,
    projectId,
    title: profile.showcase.title,
    pitch: profile.showcase.logline,
    playerPromise: profile.summary,
    creativeDirection: seed.creativeDirection,
    map: {
      title: `${profile.showcase.title} world`,
      artBrief: profile.scene.cameraDoctrine,
      locations: [],
      routes: [],
    },
    chapters: [],
    clues: [],
    puzzles: [],
    cutscenes: [],
    reviewChecklist: seed.reviewChecklist,
  };
};

const matchingProject = (
  profile: AdventureProductionProfile,
): Pick<AdventureProject, "id" | "presentation"> => ({
  id: projectId,
  presentation: createAdventureProductionProfileSeed(profile).presentation,
});

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("adventure production profiles", () => {
  it("ships nine valid, distinct and original production families", () => {
    expect(adventureProductionProfileIds()).toEqual([
      "storybook-icon-vga",
      "comic-scifi-icon-vga",
      "gothic-investigation-vga",
      "gothic-rpg-vga",
      "procedural-investigation-vga",
      "verb-panel-cartoon-vga",
      "pulp-archaeology-vga",
      "cinematic-pulp-vga",
      "neo-noir-lowres",
    ]);
    expect(new Set(adventureProductionProfiles.map((entry) => entry.family)).size).toBe(9);
    expect(
      adventureProductionProfiles.flatMap((entry) =>
        validateAdventureProductionProfile(entry),
      ),
    ).toEqual([]);

    const serialized = JSON.stringify(adventureProductionProfiles).toLocaleLowerCase("en-US");
    for (const term of [
      "king's quest",
      "space quest",
      "quest for glory",
      "gabriel knight",
      "police quest",
      "gemini rue",
      "monkey island",
      "fate of atlantis",
      "rise of the dragon",
      "heart of china",
      "sierra",
      "lucasarts",
      "dynamix",
    ]) {
      expect(serialized).not.toContain(term);
    }
  });

  it("creates deterministic seeds and accepts matching project documents", () => {
    for (const profile of adventureProductionProfiles) {
      const seed = createAdventureProductionProfileSeed(profile);
      expect(seed).toEqual(createAdventureProductionProfileSeed(profile));
      expect(seed.presentation).toEqual(
        expect.objectContaining({
          nativeWidth: profile.nativeSize.width,
          nativeHeight: profile.nativeSize.height,
          interactionMode: profile.interface.primaryInteractionMode,
          integerScale: true,
          textureSampling: "nearest",
        }),
      );
      expect(
        auditAdventureProductionProfile(profile, {
          design: matchingDesign(profile),
          project: matchingProject(profile),
        }),
      ).toEqual(
        expect.objectContaining({
          status: "ready",
          score: 100,
          issues: [],
          projectId,
        }),
      );
    }
  });

  it("keeps RPG, investigation and procedure as materially separate contracts", () => {
    const rpg = adventureProductionProfileById("gothic-rpg-vga");
    const investigation = adventureProductionProfileById("gothic-investigation-vga");
    const procedure = adventureProductionProfileById("procedural-investigation-vga");

    expect(rpg.family).toBe("gothic-rpg");
    expect(rpg.puzzleGrammars).toEqual(
      expect.arrayContaining(["multi-route", "hybrid-action", "relationship-branch"]),
    );
    expect(rpg.showcase.title).toBe("The Hollow Vale");

    expect(investigation.family).toBe("portrait-investigation");
    expect(investigation.puzzleGrammars).toContain("topic-investigation");
    expect(investigation.showcase.title).toBe("The Red Ledger");

    expect(procedure.family).toBe("procedural-investigation");
    expect(procedure.puzzleGrammars).toEqual(
      expect.arrayContaining(["research-deduction", "topic-investigation"]),
    );
    expect(procedure.showcase.title).toBe("Open Case");

    expect(rpg.interface.family).toBe("top-icon-bar");
    expect(procedure.interface.family).toBe("top-icon-bar");
    expect(rpg.interface.persistentChromePercent).toBe(0);
    expect(procedure.interface.persistentChromePercent).toBe(0);
  });

  it("blocks incompatible canvas, rendering, interaction and art doctrine", () => {
    const profile = adventureProductionProfileById("storybook-icon-vga");
    const design = matchingDesign(profile);
    const project = matchingProject(profile);
    const report = auditAdventureProductionProfile(profile, {
      design: {
        ...design,
        creativeDirection: {
          ...design.creativeDirection,
          nativeSize: { width: 640, height: 480 },
          productionMode: "cinematic-photocollage",
          compositionMode: "travel",
          palette: { ...design.creativeDirection.palette, maxColours: 512 },
        },
      },
      project: {
        ...project,
        presentation: {
          ...project.presentation,
          nativeWidth: 640,
          nativeHeight: 480,
          interactionMode: "verb-list",
          integerScale: false,
          textureSampling: "linear",
          pixelMotionPolicy: "free",
        },
      },
    });
    expect(report.status).toBe("blocked");
    expect(new Set(report.issues.map((entry) => entry.code))).toEqual(
      new Set([
        "native-size-mismatch",
        "production-mode-mismatch",
        "composition-mode-mismatch",
        "palette-budget-exceeded",
        "interaction-mode-mismatch",
        "integer-scaling-disabled",
        "linear-sampling",
        "pixel-motion-mismatch",
      ]),
    );
  });

  it("keeps splash timelines deterministic and interface families materially different", () => {
    for (const profile of adventureProductionProfiles) {
      let expectedStart = 0;
      for (const beat of profile.splash.beats) {
        expect(beat.startTick).toBe(expectedStart);
        expectedStart += beat.durationTicks;
      }
      expect(expectedStart).toBe(profile.splash.totalTicks);
      expect(profile.splash.skippableAfterTick).toBeLessThanOrEqual(
        profile.splash.totalTicks,
      );
    }

    const storybook = adventureProductionProfileById("storybook-icon-vga");
    const cartoon = adventureProductionProfileById("verb-panel-cartoon-vga");
    const cinematic = adventureProductionProfileById("cinematic-pulp-vga");
    const noir = adventureProductionProfileById("neo-noir-lowres");
    expect(storybook.interface.family).toBe("top-icon-bar");
    expect(cartoon.interface.family).toBe("bottom-verb-panel");
    expect(cartoon.interface.sentenceLine).toBe(true);
    expect(cinematic.interface.family).toBe("cinematic-dossier");
    expect(cinematic.puzzleGrammars).toContain("relationship-branch");
    expect(noir.interface.family).toBe("minimal-context");
    expect(noir.palette.maxColours).toBeLessThan(storybook.palette.maxColours);
  });

  it("rejects malformed profile contracts and treats score policy as reviewable", () => {
    const malformed = clone(
      adventureProductionProfileById("pulp-archaeology-vga"),
    ) as AdventureProductionProfile;
    const input = malformed as unknown as {
      palette: {
        maxColours: number;
        keyColours: string[];
        reservedInterfaceColours: number;
      };
      interface: {
        allowedInteractionModes: string[];
        persistentChromePercent: number;
      };
      splash: {
        totalTicks: number;
        skippableAfterTick: number;
        beats: Array<{ startTick: number }>;
      };
      showcase: { sceneBriefs: string[]; featuredSystems: string[] };
      authenticityRules: string[];
    };
    input.palette = {
      maxColours: 512,
      keyColours: ["#ffffff", "#ffffff", "not-a-colour"],
      reservedInterfaceColours: 512,
    };
    input.interface.allowedInteractionModes = [];
    input.interface.persistentChromePercent = 70;
    input.splash.skippableAfterTick = input.splash.totalTicks + 1;
    if (input.splash.beats[1]) input.splash.beats[1].startTick += 3;
    input.showcase.sceneBriefs = ["Only one scene."];
    input.showcase.featuredSystems = [];
    input.authenticityRules = [];
    expect(validateAdventureProductionProfile(malformed).length).toBeGreaterThanOrEqual(10);

    const profile = adventureProductionProfileById("gothic-investigation-vga");
    const project = matchingProject(profile);
    const report = auditAdventureProductionProfile(profile, {
      project: {
        ...project,
        presentation: {
          ...project.presentation,
          showScore: !profile.interface.showScore,
        },
      },
    });
    expect(report).toEqual(
      expect.objectContaining({
        status: "ready",
        score: 98,
        issues: [
          expect.objectContaining({
            severity: "note",
            code: "score-policy-mismatch",
          }),
        ],
      }),
    );
  });
});
