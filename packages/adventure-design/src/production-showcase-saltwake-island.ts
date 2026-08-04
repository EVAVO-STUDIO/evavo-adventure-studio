import { actor, plate, prop, puzzle, showcase } from "./production-showcase-factory.js";

export const saltwakeIslandShowcase = showcase({
  id: "saltwake-island",
  profileId: "verb-panel-cartoon-vga",
  title: "Saltwake Island",
  genre: "island comedy adventure",
  logline:
    "A lighthouse apprentice must recover a tide chart before the island council votes to move the sea.",
  motif: "island-harbour",
  titleTreatment:
    "Bold hand-lettered title sits over a clean harbour silhouette and a lighthouse beam with comic timing.",
  dialogueTreatment:
    "In-scene speech and readable reaction poses keep jokes attached to the current object problem.",
  systemTreatment:
    "A physical tide chart and sentence line make route construction feel like part of the island rather than a modern map UI.",
  plates: [
    plate(
      "plate.saltwake.title",
      "title",
      "Harbour vote title",
      "Establish the absurd civic problem and sunny object-comedy tone.",
      160,
      96,
      124,
      "SALTWAKE ISLAND",
      [],
      [
        prop("prop.saltwake.title-lighthouse", "ambience", 230, 38, 30, 90, "lighthouse", "sweeping", false),
        prop("prop.saltwake.title-ballot", "clue", 132, 104, 52, 24, "council ballot", "sea relocation", false),
      ],
      [
        "The title, harbour and lighthouse read as three bold shape groups.",
        "The joke premise appears through a physical ballot rather than exposition text.",
        "The original publisher mark finishes before the lighthouse beam reveals the title.",
      ],
    ),
    plate(
      "plate.saltwake.gameplay",
      "gameplay",
      "Harbour square above the verb panel",
      "Acquire the harbour master's tide chart without blocking the council meeting.",
      208,
      116,
      104,
      "USE folded permit WITH harbour office window",
      [
        actor("actor.saltwake.apprentice", "player", 86, 160, 52, "right", "confident point", "Large boots, scarf and rolled sleeve survive the reduced gameplay height."),
        actor("actor.saltwake.harbour-master", "npc", 226, 154, 50, "left", "window lean", "Cap, moustache and ledger form a readable comic silhouette."),
      ],
      [
        prop("prop.saltwake.office-window", "puzzle", 218, 82, 56, 50, "harbour office", "closed"),
        prop("prop.saltwake.chart-tube", "clue", 160, 134, 18, 32, "chart tube", "misdelivered"),
        prop("prop.saltwake.tavern", "exit", 18, 70, 52, 70, "tavern door", "open"),
      ],
      [
        "Targets remain legible above persistent verbs and inventory.",
        "The sentence line previews verb, prop and held item exactly.",
        "Wrong uses receive short authored responses without hiding the route.",
      ],
    ),
    plate(
      "plate.saltwake.dialogue",
      "dialogue",
      "Harbour master bargaining",
      "Discover which useless permit the office will accept as a chart request.",
      160,
      100,
      110,
      "I only accept forms stamped by someone less qualified than me.",
      [
        actor("actor.saltwake.apprentice-close", "player", 82, 164, 68, "right", "permit offered", "The folded permit and hopeful grin carry the command intent."),
        actor("actor.saltwake.master-close", "npc", 236, 160, 70, "left", "bureaucratic delight", "Ledger, cap and raised stamp create the punch-line pose."),
      ],
      [
        prop("prop.saltwake.permit", "clue", 132, 100, 34, 22, "folded permit", "unstamped"),
        prop("prop.saltwake.stamp", "puzzle", 220, 104, 22, 20, "office stamp", "guarded"),
      ],
      [
        "Dialogue remains anchored to the permit and stamp objects.",
        "Character poses support the joke before the final line.",
        "The player can return to object play immediately after the exchange.",
      ],
    ),
    plate(
      "plate.saltwake.system",
      "system",
      "Fold-out tide chart",
      "Combine tide marks, lighthouse intervals and the recovered harbour route.",
      160,
      100,
      118,
      "LOW TIDE ROUTE: BELL 3 TO BELL 5",
      [
        actor("actor.saltwake.chart-marker", "player", 54, 150, 20, "right", "apprentice marker", "A scarf marker shows the planned route origin."),
      ],
      [
        prop("prop.saltwake.chart-harbour", "exit", 54, 72, 56, 30, "harbour", "current"),
        prop("prop.saltwake.chart-reef", "puzzle", 146, 112, 52, 24, "laughing reef", "exposed"),
        prop("prop.saltwake.chart-lighthouse", "exit", 232, 68, 42, 48, "lighthouse", "reachable"),
      ],
      [
        "The chart looks folded, handled and annotated rather than like a HUD map.",
        "Route timing emerges from physical tide marks and bell intervals.",
        "The chosen route returns to the same inventory and sentence grammar.",
      ],
    ),
  ],
  puzzleBeats: [
    puzzle(
      "puzzle.saltwake.chart-permit",
      "inventory-chain",
      "plate.saltwake.gameplay",
      "The chart is visible but the harbour office refuses ordinary requests.",
      "Acquire the deliberately obsolete permit, have it stamped and use it at the office window.",
      "The chart tube enters inventory and the lighthouse route becomes constructible.",
      "Every consumed form can be reacquired from the council clerk until the chart is awarded.",
    ),
  ],
  originalityStatement:
    "Original island, council premise, apprentice, harbour office, tide-chart puzzle and dialogue; no existing pirate-comedy scene or inventory chain is reproduced.",
});
