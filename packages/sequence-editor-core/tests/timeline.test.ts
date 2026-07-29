import { describe, expect, it } from "vitest";
import { sequenceSchema } from "@evavo/adventure-project-schema";
import {
  cueDurationTicks,
  insertionIndexForTick,
  layoutSequenceTimeline,
  sameTimelineCueLocator,
  snapTimelineTick,
  timelineTickForX,
  timelineVisibleTickRange,
  timelineXForTick,
} from "../src/timeline.js";

const sequence = sequenceSchema.parse({
  id: "sequence.timeline.fixture",
  name: "Timeline fixture",
  mode: "cutscene",
  durationTicks: 180,
  skip: { allowed: true, safeAfterTick: 20, completionActions: [] },
  tracks: [
    {
      id: "sequence-track.timeline.dialogue",
      kind: "dialogue",
      cues: [
        {
          kind: "speech",
          atTick: 20,
          text: "The rain started before midnight.",
          durationTicks: 45,
        },
        {
          kind: "speech",
          atTick: 90,
          text: "Then the lights failed.",
        },
      ],
    },
    {
      id: "sequence-track.timeline.story",
      kind: "story",
      cues: [
        {
          kind: "story-action",
          atTick: 150,
          action: { kind: "set-flag", flag: "timeline.done", value: true },
        },
      ],
    },
  ],
});

const viewport = {
  pixelsPerTick: 2,
  scrollTick: 10,
  widthPixels: 240,
};

describe("timeline geometry", () => {
  it("maps ticks and pixels through the visible scroll range", () => {
    expect(timelineXForTick(35, viewport)).toBe(50);
    expect(timelineTickForX(50, viewport)).toBe(35);
    expect(timelineVisibleTickRange(viewport)).toEqual({
      startTick: 10,
      endTick: 130,
    });
  });

  it("snaps ticks deterministically within sequence bounds", () => {
    expect(snapTimelineTick(22.4, 5, 179)).toBe(20);
    expect(snapTimelineTick(177.8, 5, 179)).toBe(179);
    expect(snapTimelineTick(-12, 5, 179)).toBe(0);
  });

  it("lays out cue duration and labels without mutating cues", () => {
    const before = JSON.stringify(sequence);
    const layout = layoutSequenceTimeline(sequence, viewport);

    expect(layout[0]?.cues[0]).toMatchObject({
      left: 20,
      width: 90,
      startTick: 20,
      endTick: 65,
      label: "The rain started before midnight.",
    });
    expect(cueDurationTicks(sequence.tracks[0]!.cues[1]!)).toBe(1);
    expect(layout[0]?.cues[1]?.width).toBe(2);
    expect(JSON.stringify(sequence)).toBe(before);
  });

  it("preserves stale-safe cue locators", () => {
    const layout = layoutSequenceTimeline(sequence, viewport);
    const left = layout[0]!.cues[0]!.locator;
    const right = {
      ...left,
      expectedCue: JSON.parse(JSON.stringify(left.expectedCue)),
    };

    expect(sameTimelineCueLocator(left, right)).toBe(true);
    expect(
      sameTimelineCueLocator(left, {
        ...right,
        expectedCue: { ...right.expectedCue, atTick: 21 },
      }),
    ).toBe(false);
  });

  it("finds stable insertion positions for same-tick cue groups", () => {
    const track = sequence.tracks[0]!;
    expect(insertionIndexForTick(track, 10)).toBe(0);
    expect(insertionIndexForTick(track, 20)).toBe(1);
    expect(insertionIndexForTick(track, 89)).toBe(1);
    expect(insertionIndexForTick(track, 90)).toBe(2);
  });
});
