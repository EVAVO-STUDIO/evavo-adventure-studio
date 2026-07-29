import { sequenceSchema } from "@evavo/adventure-project-schema";

export const timelineSequence = sequenceSchema.parse({
  id: "sequence.office.blackout",
  name: "Office Blackout",
  mode: "cutscene",
  durationTicks: 360,
  loop: false,
  blocking: true,
  savePolicy: "boundary-only",
  skip: {
    allowed: true,
    safeAfterTick: 45,
    completionActions: [
      {
        kind: "set-flag",
        flag: "office.blackout-complete",
        value: true,
      },
    ],
  },
  tracks: [
    {
      id: "sequence-track.office.actor",
      kind: "actor",
      cues: [
        {
          kind: "actor-animation",
          atTick: 0,
          actorId: "actor.detective",
          animationState: "idle",
          facing: "east",
          awaitCompletion: false,
        },
        {
          kind: "actor-move",
          atTick: 72,
          durationTicks: 96,
          actorId: "actor.detective",
          destination: { x: 188, y: 166 },
          easing: "ease-in-out",
          faceOnArrival: "north",
        },
        {
          kind: "actor-animation",
          atTick: 174,
          actorId: "actor.detective",
          animationState: "inspect",
          facing: "north",
          awaitCompletion: true,
        },
      ],
    },
    {
      id: "sequence-track.office.camera",
      kind: "camera",
      cues: [
        {
          kind: "camera-shot",
          atTick: 24,
          durationTicks: 128,
          position: { x: 18, y: 0 },
          easing: "ease-in-out",
        },
        {
          kind: "camera-shot",
          atTick: 184,
          durationTicks: 76,
          position: { x: 0, y: 0 },
          easing: "ease-out",
        },
      ],
    },
    {
      id: "sequence-track.office.dialogue",
      kind: "dialogue",
      cues: [
        {
          kind: "speech",
          atTick: 196,
          speakerId: "actor.detective",
          text: "The switch was cut before the storm arrived.",
          durationTicks: 72,
          animationState: "talk",
        },
        {
          kind: "speech",
          atTick: 274,
          text: "Thunder folds over the office windows.",
          durationTicks: 48,
        },
      ],
    },
    {
      id: "sequence-track.office.audio",
      kind: "audio",
      cues: [
        {
          kind: "sound",
          atTick: 0,
          assetId: "asset.audio.office-rain",
          bus: "ambience",
          volume: 0.65,
          loop: true,
        },
        {
          kind: "sound",
          atTick: 44,
          assetId: "asset.audio.light-switch",
          bus: "effects",
          volume: 0.9,
          loop: false,
        },
        {
          kind: "sound",
          atTick: 274,
          assetId: "asset.audio.thunder-close",
          bus: "effects",
          volume: 1,
          loop: false,
        },
      ],
    },
    {
      id: "sequence-track.office.effects",
      kind: "effects",
      cues: [
        {
          kind: "layer-visibility",
          atTick: 45,
          layerId: "layer.office.lamp-glow",
          visible: false,
        },
        {
          kind: "palette-cycle",
          atTick: 274,
          paletteAssetId: "asset.palette.office",
          rangeStart: 32,
          rangeEnd: 39,
          ticksPerStep: 3,
          direction: "forward",
          enabled: true,
        },
      ],
    },
    {
      id: "sequence-track.office.story",
      kind: "story",
      cues: [
        {
          kind: "story-action",
          atTick: 330,
          action: {
            kind: "set-flag",
            flag: "clue.cut-switch",
            value: true,
          },
        },
        {
          kind: "story-action",
          atTick: 336,
          action: {
            kind: "award-score",
            awardId: "score.office.cut-switch",
            points: 5,
          },
        },
      ],
    },
  ],
});
