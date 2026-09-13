import type { AdventureProject, Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  AdventureSceneReadabilityError,
  createAdventureSceneReadabilityReports,
  evaluateAdventureSceneReadability,
  pointInAdventurePolygon,
} from "../src/scene-readability.js";
import type { AdventureDesignDocument, AdventureDesignId } from "../src/types.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const designId = <T extends string>(value: string): AdventureDesignId<T> => value as AdventureDesignId<T>;

const project = (): AdventureProject =>
  ({
    id: id<"project">("project.readability"),
    presentation: { nativeWidth: 320, nativeHeight: 200 },
    scenes: [
      {
        id: id<"scene">("scene.office"),
        name: "Rain Office",
        width: 320,
        height: 200,
        navigationAreas: [
          {
            id: id<"navigation-area">("navigation.office"),
            elevation: 0,
            shape: {
              points: [
                { x: 12, y: 104 },
                { x: 308, y: 104 },
                { x: 308, y: 192 },
                { x: 12, y: 192 },
              ],
            },
          },
        ],
        depthBands: [
          {
            id: id<"depth-band">("depth.office"),
            farY: 104,
            nearY: 192,
            farScale: 0.68,
            nearScale: 1.04,
          },
        ],
        entrances: [
          {
            id: id<"entrance">("entrance.office.front"),
            position: { x: 42, y: 170 },
            facing: "east",
          },
        ],
        hotspots: [
          {
            id: id<"hotspot">("hotspot.office.door"),
            name: "Frosted door",
            shape: {
              points: [
                { x: 268, y: 92 },
                { x: 312, y: 92 },
                { x: 312, y: 174 },
                { x: 268, y: 174 },
              ],
            },
            walkTo: { x: 252, y: 160 },
            interactions: [
              {
                actions: [
                  {
                    kind: "change-scene",
                    sceneId: "scene.alley",
                    entranceId: "entrance.alley.office",
                  },
                ],
              },
            ],
            fallbackText: "The rain makes the glass look older than it is.",
          },
        ],
        occluders: [
          {
            id: id<"occluder">("occluder.office.desk"),
            position: { x: 128, y: 126 },
            baselineY: 158,
            mask: {
              points: [
                { x: 96, y: 126 },
                { x: 210, y: 126 },
                { x: 210, y: 172 },
                { x: 96, y: 172 },
              ],
            },
          },
        ],
        fallbackText: "Nothing else in the office answers the question yet.",
      },
      {
        id: id<"scene">("scene.alley"),
        name: "Service Alley",
        width: 320,
        height: 200,
        navigationAreas: [
          {
            id: id<"navigation-area">("navigation.alley"),
            elevation: 0,
            shape: {
              points: [
                { x: 8, y: 108 },
                { x: 312, y: 108 },
                { x: 304, y: 194 },
                { x: 16, y: 194 },
              ],
            },
          },
        ],
        depthBands: [
          {
            id: id<"depth-band">("depth.alley"),
            farY: 108,
            nearY: 194,
            farScale: 0.65,
            nearScale: 1.05,
          },
        ],
        entrances: [
          {
            id: id<"entrance">("entrance.alley.office"),
            position: { x: 280, y: 164 },
            facing: "west",
          },
        ],
        hotspots: [],
        occluders: [],
        fallbackText: "The rain swallows the attempt before it reaches the street.",
      },
    ],
  }) as AdventureProject;

const design = (): AdventureDesignDocument => ({
  documentVersion: 1,
  projectId: id<"project">("project.readability"),
  title: "The Red Ledger",
  pitch: "A municipal mystery told through exact native-resolution staging.",
  playerPromise: "Read each room clearly, follow the evidence, and never lose the route forward.",
  creativeDirection: {
    nativeSize: { width: 320, height: 200 },
    productionMode: "painted-pixel",
    compositionMode: "stage",
    palette: {
      maxColours: 64,
      keyColours: ["rain-blue", "paper-ivory", "ledger-red"],
      shadowRule: "Cool grouped shadows preserve silhouettes.",
      highlightRule: "Warm practical highlights identify evidence.",
      ditherRule: "Use ordered dithering only for broad atmospheric transitions.",
    },
    perspective: "Front-on rooms with shallow cinematic depth.",
    lighting: "Rain-cool ambient light with restrained warm practicals.",
    materialLanguage: "Wet stone, worn timber, paper and oxidised municipal metal.",
    actorSilhouette: "Actors remain distinct from the evidence plane at native scale.",
    backgroundHierarchy: "Navigation, evidence and exits read before decoration.",
    portraitTreatment: "Tight low-colour portraits with controlled value groups.",
    animationCadence: "Held key poses with deliberate transitions.",
    interfaceTreatment: "Compact bitmap text and restrained evidence-red accents.",
    musicDirection: "Sparse nocturnal chamber motifs.",
    ambienceDirection: "Rain, distant trams and interior paper movement.",
    authenticityRules: ["Compose and review at the native 320 by 200 canvas."],
    prohibitedShortcuts: ["Do not hide required evidence through pixel hunting."],
  },
  map: {
    title: "Night Archive District",
    artBrief: "A compact municipal quarter connected by rain-dark service routes.",
    locations: [
      {
        id: designId<"location">("location.office"),
        name: "Municipal Archive Night Office",
        kind: "interior",
        position: { x: 80, y: 96 },
        sceneId: id<"scene">("scene.office"),
        chapterIds: [],
        unlockedByPuzzleIds: [],
        artBrief:
          "A low, rain-lit records office where desk, clerk, frosted exit and red ledger " +
          "form four distinct value groups.",
        arrivalBeat:
          "The archivist enters beside the desk, sees the ledger before the clerk, and " +
          "understands the locked street exit immediately.",
      },
      {
        id: designId<"location">("location.alley"),
        name: "Service Alley",
        kind: "scene",
        position: { x: 196, y: 116 },
        sceneId: id<"scene">("scene.alley"),
        chapterIds: [],
        unlockedByPuzzleIds: [],
        artBrief:
          "A compressed wet alley with a broad lower walk lane, one bright tram " +
          "reflection and deep doorway silhouettes.",
        arrivalBeat:
          "The player arrives from the office door and reads the quay route before " +
          "investigating the drain or service stairs.",
      },
    ],
    routes: [],
  },
  chapters: [],
  clues: [],
  puzzles: [],
  cutscenes: [],
  reviewChecklist: [],
});

describe("native scene readability", () => {
  it("produces a deterministic native-overlay report for a coherent scene", () => {
    const source = project();
    const report = evaluateAdventureSceneReadability(source, id<"scene">("scene.office"), design());

    expect(report.status).toBe("ready");
    expect(report.score).toBe(100);
    expect(report.metrics.navigationCoveragePercent).toBeGreaterThan(30);
    expect(report.metrics.hotspotCoveragePercent).toBeLessThan(20);
    expect(report.metrics.exitHotspotCount).toBe(1);
    expect(report.designLink?.locationName).toBe("Municipal Archive Night Office");
    expect(report.overlay.navigationAreas).toHaveLength(1);
    expect(report.overlay.hotspots[0]).toMatchObject({
      name: "Frosted door",
      changesScene: true,
    });
    expect(evaluateAdventureSceneReadability(source, id<"scene">("scene.office"), design())).toEqual(report);
  });

  it("blocks unreachable entrances, invalid depth, bad geometry and occlusion", () => {
    const source = project();
    const office = source.scenes[0]!;
    const broken = {
      ...source,
      scenes: [
        {
          ...office,
          width: 640,
          navigationAreas: [
            {
              ...office.navigationAreas[0]!,
              shape: {
                points: [
                  { x: -10, y: 104 },
                  { x: 250, y: 104 },
                  { x: 250, y: 150 },
                  { x: -10, y: 150 },
                ],
              },
            },
          ],
          depthBands: [
            {
              ...office.depthBands[0]!,
              farY: 180,
              nearY: 120,
              farScale: 1.2,
              nearScale: 0.7,
            },
          ],
          entrances: [
            {
              ...office.entrances[0]!,
              position: { x: 300, y: 40 },
            },
          ],
          hotspots: [
            {
              ...office.hotspots[0]!,
              walkTo: { x: 300, y: 40 },
            },
          ],
          occluders: [
            {
              ...office.occluders[0]!,
              baselineY: 260,
            },
          ],
        },
      ],
    } as AdventureProject;

    const report = evaluateAdventureSceneReadability(broken, id<"scene">("scene.office"), design());
    expect(report.status).toBe("blocked");
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "scene-native-size-mismatch",
        "navigation-outside-canvas-navigation.office",
        "entrance-outside-navigation-entrance.office.front",
        "depth-range-invalid-depth.office",
        "depth-scale-reversed-depth.office",
        "hotspot-walkto-unreachable-hotspot.office.door",
        "occluder-baseline-outside-occluder.office.desk",
      ]),
    );
  });

  it("detects degenerate geometry and uncovered depth intervals", () => {
    const source = project();
    const office = source.scenes[0]!;
    const broken = {
      ...source,
      scenes: [
        {
          ...office,
          navigationAreas: [
            office.navigationAreas[0]!,
            {
              ...office.navigationAreas[0]!,
              id: id<"navigation-area">("navigation.office.degenerate"),
              shape: {
                points: [
                  { x: 20, y: 120 },
                  { x: 20, y: 120 },
                  { x: 20, y: 120 },
                ],
              },
            },
          ],
          depthBands: [
            {
              ...office.depthBands[0]!,
              farY: 104,
              nearY: 128,
            },
            {
              ...office.depthBands[0]!,
              id: id<"depth-band">("depth.office.foreground"),
              farY: 150,
              nearY: 192,
            },
          ],
          hotspots: [
            {
              ...office.hotspots[0]!,
              shape: {
                points: [
                  { x: 280, y: 100 },
                  { x: 280, y: 100 },
                  { x: 280, y: 100 },
                ],
              },
            },
          ],
          occluders: [
            {
              ...office.occluders[0]!,
              mask: {
                points: [
                  { x: 100, y: 130 },
                  { x: 100, y: 130 },
                  { x: 100, y: 130 },
                ],
              },
            },
          ],
        },
      ],
    } as AdventureProject;

    const report = evaluateAdventureSceneReadability(broken, id<"scene">("scene.office"), design());
    expect(report.status).toBe("blocked");
    expect(report.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "navigation-degenerate-navigation.office.degenerate",
        "hotspot-degenerate-hotspot.office.door",
        "occluder-mask-degenerate-occluder.office.desk",
        "depth-does-not-cover-navigation",
      ]),
    );
  });

  it("protects project identity and rejects unknown scenes", () => {
    const mismatchedDesign = {
      ...design(),
      projectId: id<"project">("project.other"),
    };
    const report = evaluateAdventureSceneReadability(
      project(),
      id<"scene">("scene.office"),
      mismatchedDesign,
    );

    expect(report.status).toBe("blocked");
    expect(report.designLink).toBeNull();
    expect(report.findings.map((finding) => finding.id)).toContain("composition-design-project-mismatch");
    expect(() =>
      evaluateAdventureSceneReadability(project(), id<"scene">("scene.missing"), design()),
    ).toThrow(AdventureSceneReadabilityError);
  });

  it("returns reports in canonical project scene order", () => {
    const reports = createAdventureSceneReadabilityReports(project(), design());
    expect(reports.map((report) => report.sceneId)).toEqual(["scene.office", "scene.alley"]);
    expect(reports[1]?.findings.map((finding) => finding.id)).toContain("hotspots-not-yet-authored");
  });

  it("treats polygon boundaries as part of the authored region", () => {
    const polygon = {
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ],
    };
    expect(pointInAdventurePolygon({ x: 10, y: 15 }, polygon)).toBe(true);
    expect(pointInAdventurePolygon({ x: 15, y: 15 }, polygon)).toBe(true);
    expect(pointInAdventurePolygon({ x: 9, y: 15 }, polygon)).toBe(false);

    const duplicatedEdge = {
      points: [
        { x: 10, y: 10 },
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 20, y: 20 },
        { x: 10, y: 20 },
      ],
    };
    expect(pointInAdventurePolygon({ x: 100, y: 100 }, duplicatedEdge)).toBe(false);
  });
});
