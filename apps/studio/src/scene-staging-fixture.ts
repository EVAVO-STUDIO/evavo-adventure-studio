import { sceneStagingManifestSchema } from "@evavo/adventure-scene-instances/staging";
import { studioProject } from "./fixture.js";

export const studioSceneStaging = sceneStagingManifestSchema.parse({
  manifestVersion: 1,
  projectId: studioProject.id,
  scenes: [
    {
      sceneId: "scene.office",
      actorFootprints: {
        "actor.detective": {
          width: 12,
          depth: 7,
          clearance: 2,
          collisionClass: "human",
        },
      },
      preferredWalkLanes: [
        {
          id: "preferred-walk-lane.office.carpet",
          points: [
            { x: 48, y: 170 },
            { x: 126, y: 158 },
            { x: 202, y: 156 },
            { x: 270, y: 146 },
          ],
          influenceRadius: 18,
          costMultiplier: 0.68,
        },
      ],
      surfaceZones: [
        {
          id: "surface-zone.office.carpet",
          shape: {
            points: [
              { x: 36, y: 143 },
              { x: 247, y: 135 },
              { x: 278, y: 178 },
              { x: 28, y: 188 },
            ],
          },
          surface: "carpet",
          movementMultiplier: 0.94,
          footstepCueId: "audio-cue.footstep.carpet",
        },
      ],
      depthScaleCurves: [
        {
          id: "depth-scale-curve.office.floor",
          interpolation: "linear",
          keys: [
            { y: 112, scale: 0.66 },
            { y: 136, scale: 0.76 },
            { y: 158, scale: 0.89 },
            { y: 188, scale: 1.04 },
          ],
        },
      ],
      navigationScaleOverrides: [
        {
          areaId: "navigation.office.main",
          mode: "curve",
          curveId: "depth-scale-curve.office.floor",
        },
        {
          areaId: "navigation.office.threshold",
          mode: "fixed",
          fixedScale: 0.82,
        },
      ],
      navigationStateModifiers: [
        {
          id: "navigation-state-modifier.office.closed-door",
          objectId: "object.office.door",
          activeStateIds: ["object-state.door.closed"],
          disabledAreaIds: [],
          disabledPortalIds: ["navigation-portal.office.threshold"],
        },
      ],
      approachSlotsByObject: {
        "object.office.lamp": [
          {
            id: "approach-slot.office.lamp.front",
            position: { x: 157, y: 148 },
            facing: "north-east",
            validVerbs: ["use", "look"],
            validItemIds: [],
            preferred: true,
          },
        ],
        "object.office.door": [
          {
            id: "approach-slot.office.door.main",
            position: { x: 269, y: 149 },
            facing: "east",
            validVerbs: ["enter", "use"],
            validItemIds: [],
            preferred: true,
          },
        ],
      },
      interactionComfortRegionsByObject: {
        "object.office.lamp": [
          {
            id: "interaction-comfort-region.office.lamp",
            shape: {
              points: [
                { x: 172, y: 96 },
                { x: 202, y: 96 },
                { x: 202, y: 132 },
                { x: 172, y: 132 },
              ],
            },
            priority: 2,
          },
        ],
      },
      interactionChoreographies: [],
      entryChoreographies: [
        {
          entranceId: "entrance.office.front",
          spawnPosition: { x: 24, y: 174 },
          entryPath: [
            { x: 34, y: 172 },
            { x: 42, y: 170 },
          ],
          speedPixelsPerSecond: 42,
          entryAnimationState: "walk",
          arrivalFacing: "east",
          arrivalAnimationState: "idle",
          unlockControlAt: "path-end",
        },
      ],
      occlusionPlanes: [],
      paletteLightZones: [
        {
          id: "palette-light-zone.office.lamp",
          shape: {
            points: [
              { x: 137, y: 116 },
              { x: 223, y: 110 },
              { x: 240, y: 170 },
              { x: 128, y: 174 },
            ],
          },
          paletteMapId: "palette-map.office-lamp-warm",
          blendMode: "ordered-dither",
          priority: 5,
          enabledWhen: {
            kind: "object-state",
            objectId: "object.office.lamp",
            state: "object-state.lamp.on",
          },
        },
      ],
    },
    {
      sceneId: "scene.alley",
      actorFootprints: {
        "actor.detective": {
          width: 12,
          depth: 7,
          clearance: 2,
          collisionClass: "human",
        },
      },
      preferredWalkLanes: [
        {
          id: "preferred-walk-lane.alley.pavement",
          points: [
            { x: 286, y: 166 },
            { x: 210, y: 157 },
            { x: 120, y: 160 },
            { x: 28, y: 176 },
          ],
          influenceRadius: 20,
          costMultiplier: 0.72,
        },
      ],
      surfaceZones: [
        {
          id: "surface-zone.alley.wet-stone",
          shape: {
            points: [
              { x: 9, y: 110 },
              { x: 311, y: 110 },
              { x: 305, y: 191 },
              { x: 15, y: 191 },
            ],
          },
          surface: "stone",
          movementMultiplier: 0.96,
          footstepCueId: "audio-cue.footstep.wet-stone",
        },
      ],
      depthScaleCurves: [
        {
          id: "depth-scale-curve.alley.floor",
          interpolation: "linear",
          keys: [
            { y: 104, scale: 0.64 },
            { y: 138, scale: 0.78 },
            { y: 168, scale: 0.94 },
            { y: 192, scale: 1.05 },
          ],
        },
      ],
      navigationScaleOverrides: [
        {
          areaId: "navigation.alley.main",
          mode: "curve",
          curveId: "depth-scale-curve.alley.floor",
        },
      ],
      navigationStateModifiers: [],
      approachSlotsByObject: {},
      interactionComfortRegionsByObject: {},
      interactionChoreographies: [],
      entryChoreographies: [
        {
          entranceId: "entrance.alley.office",
          spawnPosition: { x: 305, y: 155 },
          entryPath: [
            { x: 292, y: 160 },
            { x: 280, y: 164 },
          ],
          speedPixelsPerSecond: 42,
          entryAnimationState: "walk",
          arrivalFacing: "west",
          arrivalAnimationState: "idle",
          unlockControlAt: "path-end",
        },
      ],
      occlusionPlanes: [],
      paletteLightZones: [
        {
          id: "palette-light-zone.alley.shadow",
          shape: {
            points: [
              { x: 0, y: 104 },
              { x: 130, y: 104 },
              { x: 146, y: 192 },
              { x: 0, y: 192 },
            ],
          },
          paletteMapId: "palette-map.alley-cool-shadow",
          blendMode: "hard",
          priority: 1,
        },
      ],
    },
  ],
});
