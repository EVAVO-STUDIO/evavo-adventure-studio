import { actor, plate, prop, puzzle, showcase } from "./production-showcase-factory.js";

export const redLedgerShowcase = showcase({
  id: "the-red-ledger",
  profileId: "gothic-investigation-vga",
  title: "The Red Ledger",
  genre: "urban folklore investigation",
  logline:
    "A municipal archivist follows an impossible debt through a rain-bound harbour city.",
  motif: "rain-bookshop",
  titleTreatment:
    "Muted painted lettering emerges through rain-dark shelving and one vermilion account mark.",
  dialogueTreatment:
    "Directional portrait light, restrained expression and a separate topic ledger preserve investigative rhythm.",
  systemTreatment:
    "An evidence ledger connects testimony, dates and physical clues without turning deduction into a quest checklist.",
  plates: [
    plate(
      "plate.red-ledger.title",
      "title",
      "Rain archive title",
      "Establish the harbour investigation and the red evidence accent.",
      160,
      96,
      122,
      "THE RED LEDGER",
      [],
      [
        prop("prop.red-ledger.title-book", "clue", 124, 72, 72, 42, "account book", "closed", false),
        prop("prop.red-ledger.title-mark", "ambience", 178, 82, 10, 24, "red margin", "visible", false),
      ],
      [
        "The warm evidence accent is reserved and not repeated decoratively.",
        "Rain and shelf silhouettes preserve title contrast.",
        "The opening motif transitions directly into archive ambience.",
      ],
    ),
    plate(
      "plate.red-ledger.gameplay",
      "gameplay",
      "Municipal archive after hours",
      "Find why one account date predates the harbour office.",
      214,
      118,
      108,
      "The ink is newer than the paper.",
      [
        actor("actor.red-ledger.archivist", "player", 84, 166, 56, "right", "notebook inspection", "Coat, notebook and lamp-side face remain separate from the shelves."),
        actor("actor.red-ledger.clerk", "npc", 238, 154, 52, "left", "guarded counter pose", "Hands stay visible above the counter to carry suspicion."),
      ],
      [
        prop("prop.red-ledger.account", "clue", 192, 118, 38, 18, "red account", "disturbed"),
        prop("prop.red-ledger.drawer", "puzzle", 142, 126, 34, 24, "catalogue drawer", "misfiled"),
        prop("prop.red-ledger.alley-door", "exit", 286, 68, 24, 82, "service door", "locked"),
      ],
      [
        "Evidence, witness and exit occupy distinct light islands.",
        "Gothic texture never hides the account or drawer state.",
        "The topic interface opens without covering the witness's hands.",
      ],
    ),
    plate(
      "plate.red-ledger.dialogue",
      "dialogue",
      "Night clerk interview",
      "Expose the contradiction between the ledger date and the clerk's story.",
      160,
      98,
      112,
      "Ask about: ACCOUNT DATE · RIVER CHAPEL · MISSING WITNESS",
      [
        actor("actor.red-ledger.archivist-close", "player", 80, 166, 78, "right", "measured question", "Notebook edge and eye line remain readable under cool light."),
        actor("actor.red-ledger.clerk-close", "npc", 238, 164, 80, "left", "withheld answer", "A hand over the ledger changes as testimony narrows."),
      ],
      [
        prop("prop.red-ledger.topic-account", "clue", 126, 64, 54, 18, "account date", "active"),
        prop("prop.red-ledger.topic-chapel", "clue", 194, 64, 54, 18, "river chapel", "unlocked"),
      ],
      [
        "Portrait light reinforces testimony without flattening the room.",
        "Topic availability reflects discovered evidence rather than arbitrary sequence.",
        "The contradiction changes pose, line and later access.",
      ],
    ),
    plate(
      "plate.red-ledger.system",
      "system",
      "Contradiction ledger",
      "Connect the account date, paper stock and chapel registry.",
      160,
      100,
      118,
      "CONTRADICTION: OFFICE BUILT AFTER RECORDED DEBT",
      [
        actor("actor.red-ledger.ledger-marker", "player", 44, 150, 20, "right", "archivist marker", "A notebook silhouette marks the active line of inquiry."),
      ],
      [
        prop("prop.red-ledger.evidence-date", "clue", 54, 64, 68, 24, "account date", "verified"),
        prop("prop.red-ledger.evidence-paper", "clue", 138, 116, 60, 24, "paper stock", "modern"),
        prop("prop.red-ledger.evidence-chapel", "puzzle", 218, 70, 58, 32, "chapel registry", "linked"),
      ],
      [
        "The ledger visualises reasoning without auto-solving the conclusion.",
        "Evidence remains physical and tied to source locations.",
        "Chapter state changes the archive and witness after the deduction.",
      ],
    ),
  ],
  puzzleBeats: [
    puzzle(
      "puzzle.red-ledger.contradiction",
      "topic-investigation",
      "plate.red-ledger.dialogue",
      "The clerk's dates are internally plausible but conflict with physical evidence.",
      "Research paper stock, unlock the chapel topic and confront the account date.",
      "The clerk reveals the service alley route and the evidence ledger records the contradiction.",
      "Premature accusations close one topic temporarily but research reopens the interview.",
    ),
  ],
  originalityStatement:
    "Original archivist, harbour city, debt mystery, topic structure and evidence art; no existing gothic investigation scene or dialogue is reproduced.",
});
