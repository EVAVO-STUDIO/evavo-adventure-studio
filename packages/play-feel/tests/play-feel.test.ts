import { describe, expect, it } from "vitest";
import {
  adventurePlayFeelProfileById,
  adventurePlayFeelProfileForProductionProfile,
  adventurePlayFeelProfileIds,
  adventurePlayFeelProfiles,
  advanceAdventureCamera,
  advanceAdventureFramePacing,
  advanceAdventureMotion,
  auditAdventureMotionTrace,
  auditAdventurePlayFeelProfile,
  createAdventureCameraState,
  createAdventureFramePacingState,
  interpolateAdventureCameraPresentation,
  createAdventureKinematicRoute,
  createAdventureMotionState,
  createAdventureMotionRuntimeExtension,
  advanceAdventureMotionRuntimeExtension,
  simulateAdventureMotion,
  validateAdventurePlayFeelProfile,
  type AdventurePlayFeelProfile,
} from "../src/index.js";

const routePoints = [
  { x: 18, y: 164 },
  { x: 142, y: 164 },
  { x: 184, y: 126 },
  { x: 302, y: 126 },
] as const;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("adventure play feel", () => {
  it("ships deterministic and original timing families for every production profile", () => {
    expect(adventurePlayFeelProfileIds()).toEqual([
      "classic-balanced",
      "storybook-deliberate",
      "comic-snappy",
      "gothic-measured",
      "verb-panel-responsive",
      "pulp-grounded",
      "cinematic-directed",
      "noir-restrained",
    ]);
    expect(
      adventurePlayFeelProfiles.flatMap((profile) =>
        validateAdventurePlayFeelProfile(profile),
      ),
    ).toEqual([]);
    expect(
      adventurePlayFeelProfileForProductionProfile("storybook-icon-vga").id,
    ).toBe("storybook-deliberate");
    expect(
      adventurePlayFeelProfileForProductionProfile("cinematic-pulp-vga").id,
    ).toBe("cinematic-directed");
    expect(
      adventurePlayFeelProfileForProductionProfile("neo-noir-lowres").id,
    ).toBe("noir-restrained");

    const runtimeData = JSON.stringify(adventurePlayFeelProfiles).toLocaleLowerCase("en-US");
    for (const term of [
      "king's quest",
      "space quest",
      "quest for glory",
      "gabriel knight",
      "monkey island",
      "fate of atlantis",
      "rise of the dragon",
      "heart of china",
      "gemini rue",
      "sierra",
      "dynamix",
      "lucasarts",
    ]) {
      expect(runtimeData).not.toContain(term);
    }
  });

  it("produces byte-stable motion whether advanced in one chunk or one tick at a time", () => {
    const profile = adventurePlayFeelProfileById("pulp-grounded");
    const route = createAdventureKinematicRoute(routePoints);
    const initial = createAdventureMotionState(route, profile);
    const chunked = advanceAdventureMotion(initial, route, profile, 180).state;
    let stepped = initial;
    for (let tick = 0; tick < 180; tick += 1) {
      stepped = advanceAdventureMotion(stepped, route, profile).state;
    }
    expect(chunked).toEqual(stepped);
  });

  it("serializes a versioned motion extension and rejects route drift", () => {
    const profile = adventurePlayFeelProfileById("gothic-measured");
    const route = createAdventureKinematicRoute(routePoints);
    const extension = createAdventureMotionRuntimeExtension(route, profile);
    const chunked = advanceAdventureMotionRuntimeExtension(
      extension,
      route,
      90,
    );
    let stepped = extension;
    for (let tick = 0; tick < 90; tick += 1) {
      stepped = advanceAdventureMotionRuntimeExtension(stepped, route).extension;
    }
    expect(chunked.extension).toEqual(stepped);
    const changedRoute = createAdventureKinematicRoute([
      ...routePoints.slice(0, -1),
      { x: 304, y: 128 },
    ]);
    expect(() =>
      advanceAdventureMotionRuntimeExtension(extension, changedRoute),
    ).toThrow(/fingerprint/u);
  });

  it("arrives exactly without overshoot and preserves native-pixel output when required", () => {
    for (const profile of adventurePlayFeelProfiles) {
      const trace = simulateAdventureMotion(routePoints, profile);
      expect(auditAdventureMotionTrace(trace, profile)).toEqual([]);
      expect(trace.samples.at(-1)).toEqual(
        expect.objectContaining({
          phase: "arrived",
          unquantizedPosition: routePoints.at(-1),
          velocityPixelsPerSecond: 0,
        }),
      );
      if (profile.movement.quantization === "native-pixel") {
        expect(
          trace.samples.every(
            (sample) =>
              Number.isInteger(sample.position.x) &&
              Number.isInteger(sample.position.y),
          ),
        ).toBe(true);
      }
    }
  });

  it("slows for a sharp authored corner and reports deterministic footfalls", () => {
    const profile = adventurePlayFeelProfileById("storybook-deliberate");
    const trace = simulateAdventureMotion(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      profile,
    );
    const cornerSamples = trace.samples.filter(
      (sample) => sample.distancePixels >= 96 && sample.distancePixels <= 104,
    );
    expect(
      Math.min(...cornerSamples.map((sample) => sample.velocityPixelsPerSecond)),
    ).toBeLessThan(profile.movement.topSpeedPixelsPerSecond);
    expect(trace.samples.some((sample) => sample.phase === "cornering")).toBe(true);
    expect(trace.samples.filter((sample) => sample.footfall !== null).length).toBeGreaterThan(4);
  });

  it("keeps a dead-zone camera clamped, quantized and chunk deterministic", () => {
    const profile = adventurePlayFeelProfileById("pulp-grounded");
    const viewport = { width: 160, height: 100 };
    const world = { width: 320, height: 200 };
    const target = {
      position: { x: 286, y: 176 },
      velocityPixelsPerSecond: { x: 47, y: 12 },
    };
    const initial = createAdventureCameraState();
    const chunked = advanceAdventureCamera(
      initial,
      target,
      viewport,
      world,
      profile,
      240,
    ).state;
    let stepped = initial;
    for (let tick = 0; tick < 240; tick += 1) {
      stepped = advanceAdventureCamera(
        stepped,
        target,
        viewport,
        world,
        profile,
      ).state;
    }
    expect(chunked).toEqual(stepped);
    expect(chunked.position.x).toBeGreaterThan(0);
    expect(chunked.position.x).toBeLessThanOrEqual(world.width - viewport.width);
    expect(chunked.position.y).toBeLessThanOrEqual(world.height - viewport.height);
    expect(Number.isInteger(chunked.position.x)).toBe(true);
    expect(Number.isInteger(chunked.position.y)).toBe(true);
  });


  it("interpolates only camera presentation authorized by the selected family", () => {
    const previous = {
      ...createAdventureCameraState({ x: 10, y: 20 }),
      unquantizedPosition: { x: 10, y: 20 },
    };
    const current = {
      ...createAdventureCameraState({ x: 30, y: 40 }),
      unquantizedPosition: { x: 30, y: 40 },
    };
    expect(
      interpolateAdventureCameraPresentation(
        previous,
        current,
        0.5,
        adventurePlayFeelProfileById("storybook-deliberate"),
      ),
    ).toEqual(current.position);
    expect(
      interpolateAdventureCameraPresentation(
        previous,
        current,
        0.5,
        adventurePlayFeelProfileById("pulp-grounded"),
      ),
    ).toEqual({ x: 20, y: 30 });
    expect(() =>
      interpolateAdventureCameraPresentation(
        previous,
        current,
        1.1,
        adventurePlayFeelProfileById("pulp-grounded"),
      ),
    ).toThrow(/alpha/u);
  });

  it("uses fixed-step simulation and exposes only profile-authorized interpolation", () => {
    const strictProfile = adventurePlayFeelProfileById("storybook-deliberate");
    const cameraProfile = adventurePlayFeelProfileById("pulp-grounded");
    const strict = advanceAdventureFramePacing(
      createAdventureFramePacingState(),
      17,
      strictProfile,
    );
    const camera = advanceAdventureFramePacing(
      createAdventureFramePacingState(),
      17,
      cameraProfile,
    );
    expect(strict.ticksToRun).toBe(1);
    expect(strict.interpolationAlpha).toBe(0);
    expect(camera.ticksToRun).toBe(1);
    expect(camera.interpolationAlpha).toBeGreaterThan(0);

    const clamped = advanceAdventureFramePacing(
      createAdventureFramePacingState(),
      2_000,
      strictProfile,
    );
    expect(clamped.ticksToRun).toBe(
      strictProfile.presentation.maximumCatchUpTicks,
    );
    expect(clamped.droppedMilliseconds).toBeGreaterThan(0);
  });


  it("rejects unsafe route units and invalid runtime tuning", () => {
    const profile = adventurePlayFeelProfileById("classic-balanced");
    const route = createAdventureKinematicRoute(routePoints);
    const state = createAdventureMotionState(route, profile);
    expect(() => createAdventureKinematicRoute([{ x: 0, y: 0 }])).toThrow(
      /at least two/u,
    );
    expect(() =>
      createAdventureKinematicRoute([
        { x: 0, y: 0 },
        { x: Number.MAX_VALUE, y: 0 },
      ]),
    ).toThrow(/fixed-unit range/u);
    expect(() =>
      advanceAdventureMotion(state, route, profile, 1, {
        topSpeedPixelsPerSecond: 0,
      }),
    ).toThrow(/positive finite/u);
  });

  it("reports timing drift and rejects malformed physical contracts", () => {
    const profile = adventurePlayFeelProfileById("noir-restrained");
    expect(
      auditAdventurePlayFeelProfile(profile, {
        logicalTicksPerSecond: 50,
        pixelMotionPolicy: "free",
        renderInterpolation: "camera-only",
      }),
    ).toEqual(
      expect.objectContaining({
        status: "blocked",
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "logical-tick-rate-mismatch" }),
          expect.objectContaining({ code: "free-pixel-motion" }),
          expect.objectContaining({ code: "render-interpolation-mismatch" }),
        ]),
      }),
    );

    const malformed = clone(profile) as AdventurePlayFeelProfile;
    const input = malformed as unknown as {
      movement: {
        topSpeedPixelsPerSecond: number;
        accelerationPixelsPerSecondSquared: number;
        turnSpeedMultiplier: number;
        quantization: string;
        retargetPolicy: string;
      };
      animation: { phaseMode: string };
      camera: {
        mode: string;
        quantization: string;
        deadZone: { left: number; right: number };
      };
      presentation: { renderInterpolation: string };
      authenticityRules: string[];
    };
    input.movement.topSpeedPixelsPerSecond = 0;
    input.movement.accelerationPixelsPerSecondSquared = -1;
    input.movement.turnSpeedMultiplier = 2;
    input.movement.quantization = "bad";
    input.movement.retargetPolicy = "bad";
    input.animation.phaseMode = "bad";
    input.camera.mode = "bad";
    input.camera.quantization = "bad";
    input.presentation.renderInterpolation = "bad";
    input.camera.deadZone.left = 0.8;
    input.camera.deadZone.right = 0.2;
    input.authenticityRules = [];
    expect(validateAdventurePlayFeelProfile(malformed).length).toBeGreaterThanOrEqual(11);
  });
});
