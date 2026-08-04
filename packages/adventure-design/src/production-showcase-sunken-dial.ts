import { actor, plate, prop, puzzle, showcase } from "./production-showcase-factory.js";

export const sunkenDialShowcase = showcase({
  id: "the-sunken-dial",
  profileId: "pulp-archaeology-vga",
  title: "The Sunken Dial",
  genre: "archaeological pulp mystery",
  logline:
    "A conservator races a private expedition to decode a machine that charts tides beneath a lost city.",
  motif: "museum-dig",
  titleTreatment:
    "Grounded illustrated lettering is framed by a conservation bench, map fragments and one copper mechanism arc.",
  dialogueTreatment:
    "Selective close-ups preserve material evidence, companion posture and route tension.",
  systemTreatment:
    "A dossier combines mechanism sections, field notes and genuinely different route strategies.",
  plates: [
    plate(
      "plate.sunken-dial.title",
      "title",
      "Conservation table title",
      "Establish researched material culture and a practical mystery object.",
      160,
      98,
      124,
      "THE SUNKEN DIAL",
      [],
      [
        prop("prop.sunken.title-dial", "clue", 130, 72, 62, 62, "tidal dial", "fragmented", false),
        prop("prop.sunken.title-notes", "ambience", 60, 110, 72, 24, "field notes", "annotated", false),
      ],
      [
        "The title shares the frame with a specific mechanism rather than generic treasure.",
        "Copper highlights remain limited to moving dial surfaces.",
        "The opening transition preserves paper, metal and water ambience.",
      ],
    ),
    plate(
      "plate.sunken-dial.gameplay",
      "gameplay",
      "Museum conservation workshop",
      "Identify which dial segment was replaced before choosing an expedition route.",
      250,
      110,
      106,
      "LOOK AT replacement alloy",
      [
        actor("actor.sunken.conservator", "player", 86, 164, 54, "right", "lens inspection", "Apron, lens and sample tray read as a working conservator silhouette."),
        actor("actor.sunken.companion", "companion", 202, 158, 52, "left", "route map held", "Map case and hat distinguish the companion's practical role."),
      ],
      [
        prop("prop.sunken.dial", "puzzle", 236, 88, 52, 52, "tidal dial", "partly restored"),
        prop("prop.sunken.alloy", "clue", 154, 140, 24, 14, "replacement alloy", "salt-stained"),
        prop("prop.sunken.dock-file", "exit", 22, 70, 42, 66, "dock records", "available"),
      ],
      [
        "Tools, evidence and route exit remain distinct above persistent verb chrome.",
        "The mechanism state is visible before the cursor moves.",
        "Material difference is shown through hue and edge treatment, not a glow outline.",
      ],
    ),
    plate(
      "plate.sunken-dial.dialogue",
      "dialogue",
      "Companion route argument",
      "Choose whether to trust the companion's river route or prove a safer engineering path.",
      160,
      100,
      112,
      "The river is faster. The machine says it is also wrong.",
      [
        actor("actor.sunken.conservator-close", "player", 78, 166, 76, "right", "measured challenge", "Lens and alloy sample stay visible during the close-up."),
        actor("actor.sunken.companion-close", "companion", 236, 164, 78, "left", "map defended", "Folded map and guarded shoulder line communicate route commitment."),
      ],
      [
        prop("prop.sunken.route-map", "clue", 132, 82, 54, 34, "river map", "marked"),
        prop("prop.sunken.alloy-close", "clue", 194, 102, 22, 14, "alloy sample", "compared"),
      ],
      [
        "The disagreement presents evidence and relationship consequence together.",
        "Close-ups preserve tools and documents instead of becoming decorative portraits.",
        "Either route remains playable and changes later access.",
      ],
    ),
    plate(
      "plate.sunken-dial.system",
      "system",
      "Mechanism and route dossier",
      "Compare the restored dial against river, coastal and excavation routes.",
      160,
      100,
      118,
      "COASTAL ROUTE · SLOW · MECHANICALLY CONSISTENT",
      [
        actor("actor.sunken.dossier-marker", "player", 44, 150, 20, "right", "conservator marker", "A lens symbol identifies the evidence-led route."),
      ],
      [
        prop("prop.sunken.route-river", "exit", 56, 68, 62, 28, "river route", "fast-risky"),
        prop("prop.sunken.route-coast", "exit", 130, 124, 62, 28, "coastal route", "slow-safe"),
        prop("prop.sunken.route-dig", "puzzle", 218, 68, 58, 36, "excavation route", "requires permit"),
      ],
      [
        "Routes differ in interaction, companion state and resource consequence.",
        "The dossier retains paper, mechanism and travel imagery in one coherent style.",
        "The selected route is explained by evidence, not an arbitrary difficulty label.",
      ],
    ),
  ],
  puzzleBeats: [
    puzzle(
      "puzzle.sunken.route",
      "multi-route",
      "plate.sunken-dial.dialogue",
      "The fastest route conflicts with evidence from the restored mechanism.",
      "Choose a diplomatic river path, a technical coastal path or secure an excavation permit.",
      "Each route reaches the field site with different companions, clues and later shortcuts.",
      "No route is a dead end; missed evidence is delivered through route-specific consequences.",
    ),
  ],
  originalityStatement:
    "Original conservator, tidal mechanism, expedition routes, companion dispute and museum setting; no existing archaeology-adventure scene or route puzzle is reproduced.",
});
