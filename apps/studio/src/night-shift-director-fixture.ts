import { parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseSceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { sceneStagingManifestSchema } from "@evavo/adventure-scene-instances/staging";

export const nightShiftDirectorProject = parseAdventureProject({
  schemaVersion: 1,
  id: "project.night-shift-director",
  title: "Night Shift",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "icon-bar",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
    showScore: true,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.night-shift.station",
  startEntranceId: "entrance.night-shift.station.front",
  scenes: [
    {
      id: "scene.night-shift.station",
      name: "Municipal briefing room",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.night-shift.background.station",
      navigationAreas: [
        {
          id: "navigation.night-shift.station.main",
          shape: {
            points: [
              { x: 18, y: 116 },
              { x: 276, y: 116 },
              { x: 304, y: 190 },
              { x: 14, y: 190 },
            ],
          },
          elevation: 0,
        },
        {
          id: "navigation.night-shift.station.threshold",
          shape: {
            points: [
              { x: 268, y: 112 },
              { x: 316, y: 112 },
              { x: 316, y: 168 },
              { x: 268, y: 168 },
            ],
          },
          elevation: 1,
        },
      ],
      depthBands: [
        {
          id: "depth.night-shift.station.floor",
          farY: 112,
          nearY: 190,
          farScale: 0.7,
          nearScale: 1.02,
        },
      ],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.night-shift.station.front",
          position: { x: 48, y: 172 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing here needs your attention.",
    },
    {
      id: "scene.night-shift.roadside",
      name: "Wet roadside stop",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.night-shift.background.roadside",
      navigationAreas: [
        {
          id: "navigation.night-shift.roadside.main",
          shape: {
            points: [
              { x: 10, y: 110 },
              { x: 310, y: 110 },
              { x: 306, y: 193 },
              { x: 14, y: 193 },
            ],
          },
          elevation: 0,
        },
      ],
      depthBands: [
        {
          id: "depth.night-shift.roadside.floor",
          farY: 108,
          nearY: 193,
          farScale: 0.63,
          nearScale: 1.05,
        },
      ],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.night-shift.roadside.patrol",
          position: { x: 54, y: 174 },
          facing: "east",
        },
      ],
      fallbackText: "Rain and traffic swallow the attempt.",
    },
  ],
  actors: [
    {
      id: "actor.night-shift.officer",
      name: "Night officer",
      frames: [
        {
          id: "frame.night-shift.officer.idle-east",
          assetId: "asset.night-shift.actor.officer",
          sourceRect: { x: 0, y: 0, width: 20, height: 46 },
          sourceSize: { width: 24, height: 50 },
          trimOffset: { x: 2, y: 3 },
          pivot: { x: 12, y: 49 },
          footPoint: { x: 12, y: 49 },
          durationTicks: 12,
          mirrorEligible: true,
        },
        {
          id: "frame.night-shift.officer.walk-east",
          assetId: "asset.night-shift.actor.officer",
          sourceRect: { x: 22, y: 0, width: 20, height: 46 },
          sourceSize: { width: 24, height: 50 },
          trimOffset: { x: 2, y: 3 },
          pivot: { x: 12, y: 49 },
          footPoint: { x: 12, y: 49 },
          durationTicks: 7,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.night-shift.officer.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.night-shift.officer.idle-east"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.night-shift.officer.idle-west",
          state: "idle",
          facing: "west",
          frameIds: ["frame.night-shift.officer.idle-east"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.night-shift.officer.walk-east",
          state: "walk",
          facing: "east",
          frameIds: ["frame.night-shift.officer.walk-east", "frame.night-shift.officer.idle-east"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.night-shift.officer.walk-west",
          state: "walk",
          facing: "west",
          frameIds: ["frame.night-shift.officer.walk-east", "frame.night-shift.officer.idle-east"],
          loop: true,
          interruptible: true,
        },
      ],
    },
    {
      id: "actor.night-shift.sergeant",
      name: "Desk sergeant",
      frames: [
        {
          id: "frame.night-shift.sergeant.idle-west",
          assetId: "asset.night-shift.actor.sergeant",
          sourceRect: { x: 0, y: 0, width: 22, height: 42 },
          sourceSize: { width: 26, height: 46 },
          trimOffset: { x: 2, y: 3 },
          pivot: { x: 13, y: 45 },
          footPoint: { x: 13, y: 45 },
          durationTicks: 16,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.night-shift.sergeant.idle-west",
          state: "idle",
          facing: "west",
          frameIds: ["frame.night-shift.sergeant.idle-west"],
          loop: true,
          interruptible: true,
        },
      ],
    },
    {
      id: "actor.night-shift.driver",
      name: "Stopped driver",
      frames: [
        {
          id: "frame.night-shift.driver.idle-west",
          assetId: "asset.night-shift.actor.driver",
          sourceRect: { x: 0, y: 0, width: 18, height: 40 },
          sourceSize: { width: 22, height: 44 },
          trimOffset: { x: 2, y: 3 },
          pivot: { x: 11, y: 43 },
          footPoint: { x: 11, y: 43 },
          durationTicks: 14,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.night-shift.driver.idle-west",
          state: "idle",
          facing: "west",
          frameIds: ["frame.night-shift.driver.idle-west"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  dialogues: [],
  sequences: [],
  assets: [
    { id: "asset.night-shift.background.station", path: "art/night-shift/station.png", kind: "image" },
    { id: "asset.night-shift.background.roadside", path: "art/night-shift/roadside.png", kind: "image" },
    { id: "asset.night-shift.actor.officer", path: "art/night-shift/officer.aseprite", kind: "spritesheet" },
    { id: "asset.night-shift.actor.sergeant", path: "art/night-shift/sergeant.aseprite", kind: "spritesheet" },
    { id: "asset.night-shift.actor.driver", path: "art/night-shift/driver.aseprite", kind: "spritesheet" },
    { id: "asset.night-shift.object.radio", path: "art/night-shift/radio.png", kind: "image" },
    { id: "asset.night-shift.object.keys", path: "art/night-shift/keys.png", kind: "image" },
    { id: "asset.night-shift.object.door", path: "art/night-shift/door.png", kind: "image" },
    { id: "asset.night-shift.object.sedan", path: "art/night-shift/sedan.png", kind: "image" },
    { id: "asset.night-shift.foreground.desk", path: "art/night-shift/station-desk-front.png", kind: "image" },
    { id: "asset.night-shift.foreground.door-frame", path: "art/night-shift/door-frame.png", kind: "image" },
    { id: "asset.night-shift.foreground.sedan", path: "art/night-shift/sedan-front.png", kind: "image" },
  ],
  inventoryItems: [],
});

export const nightShiftDirectorInstances = parseSceneInstanceManifest({
  manifestVersion: 1,
  projectId: nightShiftDirectorProject.id,
  objectDefinitions: [
    {
      id: "object-definition.night-shift.radio",
      name: "Portable radio",
      initialStateId: "object-state.night-shift.radio.rack",
      states: [
        {
          id: "object-state.night-shift.radio.rack",
          visual: { kind: "image", assetId: "asset.night-shift.object.radio", pivot: { x: 8, y: 10 } },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 16, y: 0 },
              { x: 16, y: 14 },
              { x: 0, y: 14 },
            ],
          },
          walkToOffset: { x: -22, y: 18 },
          cursor: "use",
          interactions: [
            {
              id: "interaction.night-shift.radio.take",
              verb: "use",
              actions: [{ kind: "set-flag", flag: "radioReady", value: true }],
            },
          ],
        },
      ],
    },
    {
      id: "object-definition.night-shift.keys",
      name: "Vehicle keys",
      initialStateId: "object-state.night-shift.keys.hook",
      states: [
        {
          id: "object-state.night-shift.keys.hook",
          visual: { kind: "image", assetId: "asset.night-shift.object.keys", pivot: { x: 6, y: 4 } },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 12, y: 0 },
              { x: 12, y: 8 },
              { x: 0, y: 8 },
            ],
          },
          walkToOffset: { x: -18, y: 18 },
          cursor: "use",
          interactions: [
            {
              id: "interaction.night-shift.keys.take",
              verb: "use",
              actions: [{ kind: "set-flag", flag: "keysReady", value: true }],
            },
          ],
        },
      ],
    },
    {
      id: "object-definition.night-shift.station-door",
      name: "Station exit",
      initialStateId: "object-state.night-shift.station-door.closed",
      states: [
        {
          id: "object-state.night-shift.station-door.closed",
          visual: { kind: "image", assetId: "asset.night-shift.object.door", pivot: { x: 15, y: 58 } },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 30, y: 0 },
              { x: 30, y: 60 },
              { x: 0, y: 60 },
            ],
          },
          walkToOffset: { x: -20, y: 4 },
          faceDirection: "east",
          cursor: "enter",
          interactions: [
            {
              id: "interaction.night-shift.station-door.open",
              verb: "use",
              actions: [
                {
                  kind: "set-object-state",
                  objectId: "object.night-shift.station-door",
                  state: "object-state.night-shift.station-door.open",
                },
              ],
            },
          ],
        },
        {
          id: "object-state.night-shift.station-door.open",
          visible: false,
          interactions: [],
        },
      ],
    },
    {
      id: "object-definition.night-shift.sedan",
      name: "Stopped sedan",
      initialStateId: "object-state.night-shift.sedan.stopped",
      states: [
        {
          id: "object-state.night-shift.sedan.stopped",
          visual: { kind: "image", assetId: "asset.night-shift.object.sedan", pivot: { x: 42, y: 24 } },
          interactionShape: {
            points: [
              { x: 0, y: 0 },
              { x: 84, y: 0 },
              { x: 84, y: 34 },
              { x: 0, y: 34 },
            ],
          },
          walkToOffset: { x: -46, y: 20 },
          cursor: "look",
          interactions: [
            {
              id: "interaction.night-shift.sedan.observe",
              verb: "look",
              actions: [{ kind: "set-flag", flag: "vehicleObserved", value: true }],
            },
          ],
        },
      ],
    },
  ],
  scenes: [
    {
      sceneId: "scene.night-shift.station",
      actorInstances: [
        {
          id: "actor-instance.night-shift.station.officer",
          actorId: "actor.night-shift.officer",
          position: { x: 52, y: 172 },
          facing: "east",
          animationState: "idle",
          mobility: "walkable",
        },
        {
          id: "actor-instance.night-shift.station.sergeant",
          actorId: "actor.night-shift.sergeant",
          position: { x: 230, y: 149 },
          facing: "west",
          animationState: "idle",
          mobility: "fixed",
          scaleMultiplier: 0.9,
        },
      ],
      objectInstances: [
        {
          id: "object.night-shift.radio",
          definitionId: "object-definition.night-shift.radio",
          position: { x: 118, y: 127 },
          layer: "world",
          zOffset: 1,
        },
        {
          id: "object.night-shift.keys",
          definitionId: "object-definition.night-shift.keys",
          position: { x: 154, y: 130 },
          layer: "world",
          zOffset: 1,
        },
        {
          id: "object.night-shift.station-door",
          definitionId: "object-definition.night-shift.station-door",
          position: { x: 294, y: 162 },
          layer: "world",
          elevation: 1,
        },
      ],
      navigationPortals: [
        {
          id: "navigation-portal.night-shift.station.threshold",
          fromAreaId: "navigation.night-shift.station.main",
          toAreaId: "navigation.night-shift.station.threshold",
          fromPoint: { x: 272, y: 151 },
          toPoint: { x: 289, y: 144 },
          bidirectional: true,
          traversalCost: 1,
        },
      ],
    },
    {
      sceneId: "scene.night-shift.roadside",
      actorInstances: [
        {
          id: "actor-instance.night-shift.roadside.officer",
          actorId: "actor.night-shift.officer",
          position: { x: 56, y: 175 },
          facing: "east",
          animationState: "idle",
          mobility: "walkable",
        },
        {
          id: "actor-instance.night-shift.roadside.driver",
          actorId: "actor.night-shift.driver",
          position: { x: 244, y: 154 },
          facing: "west",
          animationState: "idle",
          mobility: "fixed",
          scaleMultiplier: 0.9,
        },
      ],
      objectInstances: [
        {
          id: "object.night-shift.sedan",
          definitionId: "object-definition.night-shift.sedan",
          position: { x: 220, y: 164 },
          layer: "world",
          zOffset: 0,
        },
      ],
      navigationPortals: [],
    },
  ],
});

export const nightShiftDirectorStaging = sceneStagingManifestSchema.parse({
  manifestVersion: 1,
  projectId: nightShiftDirectorProject.id,
  scenes: [
    {
      sceneId: "scene.night-shift.station",
      actorFootprints: {
        "actor.night-shift.officer": { width: 10, depth: 6, clearance: 2, collisionClass: "human" },
      },
      preferredWalkLanes: [
        {
          id: "preferred-walk-lane.night-shift.station.duty-lane",
          points: [
            { x: 48, y: 173 },
            { x: 126, y: 163 },
            { x: 206, y: 158 },
            { x: 270, y: 150 },
          ],
          influenceRadius: 18,
          costMultiplier: 0.68,
        },
      ],
      surfaceZones: [
        {
          id: "surface-zone.night-shift.station.vinyl",
          shape: {
            points: [
              { x: 22, y: 126 },
              { x: 274, y: 120 },
              { x: 302, y: 188 },
              { x: 16, y: 190 },
            ],
          },
          surface: "custom",
          customSurfaceId: "vinyl-tile",
          movementMultiplier: 1,
          footstepCueId: "audio-cue.night-shift.footstep.vinyl",
        },
      ],
      depthScaleCurves: [
        {
          id: "depth-scale-curve.night-shift.station.floor",
          interpolation: "linear",
          keys: [
            { y: 112, scale: 0.68 },
            { y: 136, scale: 0.78 },
            { y: 160, scale: 0.91 },
            { y: 190, scale: 1.03 },
          ],
        },
      ],
      navigationScaleOverrides: [
        {
          areaId: "navigation.night-shift.station.main",
          mode: "curve",
          curveId: "depth-scale-curve.night-shift.station.floor",
        },
        {
          areaId: "navigation.night-shift.station.threshold",
          mode: "fixed",
          fixedScale: 0.84,
        },
      ],
      navigationStateModifiers: [
        {
          id: "navigation-state-modifier.night-shift.station.closed-door",
          objectId: "object.night-shift.station-door",
          activeStateIds: ["object-state.night-shift.station-door.closed"],
          disabledAreaIds: [],
          disabledPortalIds: ["navigation-portal.night-shift.station.threshold"],
        },
      ],
      approachSlotsByObject: {
        "object.night-shift.radio": [
          {
            id: "approach-slot.night-shift.radio.front",
            position: { x: 94, y: 149 },
            facing: "north-east",
            validVerbs: ["use", "look"],
            validItemIds: [],
            preferred: true,
          },
        ],
        "object.night-shift.keys": [
          {
            id: "approach-slot.night-shift.keys.front",
            position: { x: 137, y: 151 },
            facing: "north-east",
            validVerbs: ["use", "look"],
            validItemIds: [],
            preferred: true,
          },
        ],
        "object.night-shift.station-door": [
          {
            id: "approach-slot.night-shift.station-door.main",
            position: { x: 266, y: 151 },
            facing: "east",
            validVerbs: ["use", "walk"],
            validItemIds: [],
            preferred: true,
          },
        ],
      },
      interactionComfortRegionsByObject: {
        "object.night-shift.radio": [
          {
            id: "interaction-comfort-region.night-shift.radio",
            shape: {
              points: [
                { x: 106, y: 112 },
                { x: 132, y: 112 },
                { x: 132, y: 139 },
                { x: 106, y: 139 },
              ],
            },
            priority: 2,
          },
        ],
        "object.night-shift.keys": [
          {
            id: "interaction-comfort-region.night-shift.keys",
            shape: {
              points: [
                { x: 144, y: 118 },
                { x: 166, y: 118 },
                { x: 166, y: 140 },
                { x: 144, y: 140 },
              ],
            },
            priority: 3,
          },
        ],
      },
      interactionChoreographies: [],
      entryChoreographies: [
        {
          entranceId: "entrance.night-shift.station.front",
          spawnPosition: { x: 25, y: 176 },
          entryPath: [
            { x: 36, y: 174 },
            { x: 48, y: 172 },
          ],
          speedPixelsPerSecond: 44,
          entryAnimationState: "walk",
          arrivalFacing: "east",
          arrivalAnimationState: "idle",
          unlockControlAt: "path-end",
        },
      ],
      occlusionPlanes: [
        {
          id: "occlusion-plane.night-shift.station.desk-front",
          assetId: "asset.night-shift.foreground.desk",
          position: { x: 178, y: 116 },
          pivot: { x: 0, y: 0 },
          baselineY: 154,
          elevation: 0,
          zOffset: 2,
          scale: { x: 1, y: 1 },
          mirrored: false,
          opacity: 1,
        },
        {
          id: "occlusion-plane.night-shift.station.door-frame",
          assetId: "asset.night-shift.foreground.door-frame",
          position: { x: 275, y: 72 },
          pivot: { x: 0, y: 0 },
          baselineY: 165,
          elevation: 1,
          zOffset: 3,
          scale: { x: 1, y: 1 },
          mirrored: false,
          opacity: 1,
        },
      ],
      paletteLightZones: [
        {
          id: "palette-light-zone.night-shift.station.fluorescent",
          shape: {
            points: [
              { x: 70, y: 116 },
              { x: 250, y: 112 },
              { x: 270, y: 176 },
              { x: 52, y: 184 },
            ],
          },
          paletteMapId: "palette-map.night-shift.station-fluorescent",
          blendMode: "hard",
          priority: 1,
        },
      ],
    },
    {
      sceneId: "scene.night-shift.roadside",
      actorFootprints: {
        "actor.night-shift.officer": { width: 10, depth: 6, clearance: 2, collisionClass: "human" },
      },
      preferredWalkLanes: [
        {
          id: "preferred-walk-lane.night-shift.roadside.safe-approach",
          points: [
            { x: 54, y: 176 },
            { x: 112, y: 169 },
            { x: 162, y: 165 },
            { x: 188, y: 160 },
          ],
          influenceRadius: 18,
          costMultiplier: 0.62,
        },
      ],
      surfaceZones: [
        {
          id: "surface-zone.night-shift.roadside.wet-asphalt",
          shape: {
            points: [
              { x: 10, y: 111 },
              { x: 310, y: 111 },
              { x: 306, y: 193 },
              { x: 14, y: 193 },
            ],
          },
          surface: "custom",
          customSurfaceId: "wet-asphalt",
          movementMultiplier: 0.96,
          footstepCueId: "audio-cue.night-shift.footstep.wet-asphalt",
        },
      ],
      depthScaleCurves: [
        {
          id: "depth-scale-curve.night-shift.roadside.floor",
          interpolation: "linear",
          keys: [
            { y: 108, scale: 0.62 },
            { y: 140, scale: 0.76 },
            { y: 168, scale: 0.92 },
            { y: 193, scale: 1.05 },
          ],
        },
      ],
      navigationScaleOverrides: [
        {
          areaId: "navigation.night-shift.roadside.main",
          mode: "curve",
          curveId: "depth-scale-curve.night-shift.roadside.floor",
        },
      ],
      navigationStateModifiers: [],
      approachSlotsByObject: {
        "object.night-shift.sedan": [
          {
            id: "approach-slot.night-shift.sedan.rear-quarter",
            position: { x: 169, y: 164 },
            facing: "east",
            validVerbs: ["look", "talk", "use"],
            validItemIds: [],
            preferred: true,
          },
        ],
      },
      interactionComfortRegionsByObject: {
        "object.night-shift.sedan": [
          {
            id: "interaction-comfort-region.night-shift.sedan",
            shape: {
              points: [
                { x: 174, y: 124 },
                { x: 275, y: 124 },
                { x: 275, y: 174 },
                { x: 174, y: 174 },
              ],
            },
            priority: 1,
          },
        ],
      },
      interactionChoreographies: [],
      entryChoreographies: [
        {
          entranceId: "entrance.night-shift.roadside.patrol",
          spawnPosition: { x: 24, y: 179 },
          entryPath: [
            { x: 39, y: 177 },
            { x: 54, y: 174 },
          ],
          speedPixelsPerSecond: 46,
          entryAnimationState: "walk",
          arrivalFacing: "east",
          arrivalAnimationState: "idle",
          unlockControlAt: "path-end",
        },
      ],
      occlusionPlanes: [
        {
          id: "occlusion-plane.night-shift.roadside.sedan-front",
          assetId: "asset.night-shift.foreground.sedan",
          position: { x: 178, y: 125 },
          pivot: { x: 0, y: 0 },
          baselineY: 166,
          elevation: 0,
          zOffset: 2,
          scale: { x: 1, y: 1 },
          mirrored: false,
          opacity: 1,
        },
      ],
      paletteLightZones: [
        {
          id: "palette-light-zone.night-shift.roadside.headlamp",
          shape: {
            points: [
              { x: 118, y: 132 },
              { x: 230, y: 126 },
              { x: 260, y: 182 },
              { x: 92, y: 190 },
            ],
          },
          paletteMapId: "palette-map.night-shift.roadside-headlamp",
          blendMode: "ordered-dither",
          priority: 2,
        },
      ],
    },
  ],
});
