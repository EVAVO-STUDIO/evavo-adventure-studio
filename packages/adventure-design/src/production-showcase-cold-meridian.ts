import { actor, plate, prop, puzzle, showcase } from "./production-showcase-factory.js";

export const coldMeridianShowcase = showcase({
  id: "cold-meridian",
  profileId: "neo-noir-lowres",
  title: "Cold Meridian",
  genre: "low-resolution neo-noir investigation",
  logline:
    "Two estranged signal technicians investigate broadcasts that describe crimes several minutes before they occur.",
  motif: "rain-tenement",
  titleTreatment:
    "A broken signal line resolves into spare bitmap lettering against a nearly black city grid.",
  dialogueTreatment:
    "Minimal captions and rare close-ups preserve negative space and distrust.",
  systemTreatment:
    "A communicator archive separates what each technician heard, recorded and inferred.",
  plates: [
    plate(
      "plate.cold-meridian.title",
      "title",
      "Dead channel title",
      "Establish sparse noir atmosphere and a distinct signal identity.",
      160,
      98,
      126,
      "COLD MERIDIAN",
      [],
      [
        prop("prop.cold.title-signal", "clue", 84, 82, 152, 24, "signal trace", "broken", false),
        prop("prop.cold.title-window", "ambience", 246, 54, 26, 50, "tenement window", "single light", false),
      ],
      [
        "The title uses negative space and one limited signal accent.",
        "No scanline or tape filter substitutes for authored low-resolution composition.",
        "The sparse sound mark leaves room for the first rain ambience.",
      ],
    ),
    plate(
      "plate.cold-meridian.gameplay",
      "gameplay",
      "Rain tenement service alley",
      "Reach the relay cabinet before the predicted assault occurs upstairs.",
      242,
      112,
      94,
      "The relay repeats your badge number.",
      [
        actor("actor.cold.technician", "player", 76, 166, 48, "right", "low flashlight", "A square coat, cable bag and narrow light cone form a restrained silhouette."),
        actor("actor.cold.witness", "npc", 224, 154, 44, "left", "doorway watch", "A pale face cluster and doorway frame distinguish the witness from rain."),
      ],
      [
        prop("prop.cold.relay", "puzzle", 258, 92, 28, 54, "relay cabinet", "broadcasting"),
        prop("prop.cold.badge", "clue", 142, 144, 16, 10, "security badge", "dropped"),
        prop("prop.cold.stair", "exit", 302, 70, 18, 86, "service stair", "locked"),
      ],
      [
        "The relay reads without a glow outline or oversized icon.",
        "Rain remains a sparse directional texture rather than full-screen noise.",
        "The minimal caption never obscures the walk lane or witness.",
      ],
    ),
    plate(
      "plate.cold-meridian.dialogue",
      "dialogue",
      "Doorway witness exchange",
      "Determine whether the witness heard the same prediction or only its echo.",
      160,
      100,
      110,
      "It said your name first. Then mine.",
      [
        actor("actor.cold.technician-dialogue", "player", 88, 164, 64, "right", "held recorder", "The recorder changes the hand silhouette and signals active evidence."),
        actor("actor.cold.witness-dialogue", "npc", 230, 160, 68, "left", "half-hidden doorway", "Only face, hand and coat edge are lit, preserving uncertainty."),
      ],
      [
        prop("prop.cold.recorder", "clue", 132, 104, 24, 16, "signal recorder", "playing"),
        prop("prop.cold.door-chain", "puzzle", 256, 96, 12, 30, "door chain", "fastened"),
      ],
      [
        "Dialogue retains negative space and avoids decorative portrait chrome.",
        "Evidence playback and witness response remain one continuous scene beat.",
        "Ambiguity comes from testimony rather than unreadable UI.",
      ],
    ),
    plate(
      "plate.cold-meridian.system",
      "system",
      "Communicator signal archive",
      "Compare the two technicians' recordings without merging their knowledge.",
      160,
      100,
      118,
      "CHANNEL 04 · PREDICTION OFFSET 02:13",
      [
        actor("actor.cold.archive-tech-a", "player", 54, 150, 18, "right", "channel marker", "One square marker identifies the active technician."),
        actor("actor.cold.archive-tech-b", "companion", 80, 150, 18, "right", "alternate marker", "A split marker preserves the second knowledge boundary."),
      ],
      [
        prop("prop.cold.archive-wave", "clue", 64, 66, 192, 36, "waveform", "aligned"),
        prop("prop.cold.archive-name", "puzzle", 108, 122, 78, 22, "name fragment", "mismatched"),
        prop("prop.cold.archive-offset", "clue", 212, 122, 54, 22, "time offset", "verified"),
      ],
      [
        "The archive uses signal structure rather than generic terminal decoration.",
        "Protagonist knowledge stays separate until an authored exchange occurs.",
        "The time offset becomes a playable planning constraint in the next room.",
      ],
    ),
  ],
  puzzleBeats: [
    puzzle(
      "puzzle.cold.signal",
      "topic-investigation",
      "plate.cold-meridian.system",
      "Two recordings contain the same names but different prediction offsets.",
      "Compare waveform, speaker order and timestamp while preserving each technician's knowledge.",
      "The correct relay and intervention window become available.",
      "A wrong inference sends the player to a recoverable late-arrival scene with new evidence.",
    ),
  ],
  originalityStatement:
    "Original technicians, city block, predictive signal mystery, communicator archive and visual language; no existing neo-noir adventure scene or plot is reproduced.",
});
