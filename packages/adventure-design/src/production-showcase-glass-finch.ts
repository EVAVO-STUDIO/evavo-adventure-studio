import { actor, plate, prop, puzzle, showcase } from "./production-showcase-factory.js";

export const glassFinchShowcase = showcase({
  id: "the-glass-finch",
  profileId: "storybook-icon-vga",
  title: "The Glass Finch",
  genre: "storybook fantasy mystery",
  logline:
    "A bell keeper follows a crystal bird through a valley whose seasons change whenever the tower rings.",
  motif: "enchanted-belltower",
  titleTreatment:
    "Hand-painted lettering sits between a dark valley silhouette and one warm lantern window.",
  dialogueTreatment:
    "Short portrait exchanges preserve the room tableau and reserve expression changes for important beats.",
  systemTreatment:
    "A parchment valley map reveals routes through visible season and landmark changes.",
  plates: [
    plate(
      "plate.glass-finch.title",
      "title",
      "Lantern valley title",
      "Understand the fairytale promise before control begins.",
      160,
      92,
      122,
      "THE GLASS FINCH",
      [],
      [
        prop("prop.glass-finch.tower", "ambience", 232, 54, 44, 86, "bell tower", "distant", false),
        prop("prop.glass-finch.lantern", "clue", 246, 88, 8, 10, "lantern window", "lit", false),
      ],
      [
        "The title remains readable against a five-value valley silhouette.",
        "One warm window establishes the destination without a modern glow effect.",
        "Publisher mark and title remain separate timed beats.",
      ],
    ),
    plate(
      "plate.glass-finch.gameplay",
      "gameplay",
      "Orchard below the bell tower",
      "Recover the clapper pin before frost seals the orchard gate.",
      230,
      112,
      104,
      "The finch watches the broken bell rope.",
      [
        actor(
          "actor.glass-finch.keeper",
          "player",
          92,
          164,
          54,
          "right",
          "cautious reach",
          "A dark coat and pale scarf remain readable against the orchard floor.",
        ),
        actor(
          "actor.glass-finch.bird",
          "companion",
          212,
          106,
          18,
          "left",
          "perched warning",
          "A compact bright silhouette anchors the clue above actor height.",
        ),
      ],
      [
        prop("prop.glass-finch.rope", "puzzle", 235, 74, 14, 70, "bell rope", "frayed"),
        prop("prop.glass-finch.pin", "clue", 176, 151, 10, 6, "clapper pin", "half-hidden"),
        prop("prop.glass-finch.gate", "exit", 286, 112, 24, 58, "orchard gate", "frosting"),
      ],
      [
        "The walk lane stays clear across the lower third.",
        "Player, clue and exit use distinct value families at native size.",
        "The temporary icon bar never covers the bell mechanism.",
      ],
    ),
    plate(
      "plate.glass-finch.dialogue",
      "dialogue",
      "Finch warning portrait",
      "Learn which note reverses the frost without turning the bird into a hint dispenser.",
      160,
      88,
      110,
      "A bell remembers who rang it last.",
      [
        actor("actor.glass-finch.keeper-close", "player", 92, 168, 78, "right", "listening profile", "Scarf and nose line stay distinct in six value steps."),
        actor("actor.glass-finch.bird-close", "npc", 226, 118, 42, "left", "wing raised", "Crystal facets use hard clusters instead of transparency."),
      ],
      [
        prop("prop.glass-finch.bell-shadow", "ambience", 136, 34, 62, 48, "bell shadow", "still", false),
        prop("prop.glass-finch.note-rune", "clue", 254, 72, 16, 16, "note rune", "revealed"),
      ],
      [
        "Portraits preserve eye line instead of becoming modern talking heads.",
        "Dialogue text leaves the rune and bell shadow visible.",
        "The clue is delivered through image, line and later mechanism state.",
      ],
    ),
    plate(
      "plate.glass-finch.system",
      "system",
      "Season route map",
      "Choose the thaw route after repairing the bell.",
      160,
      100,
      120,
      "SPRING ROUTE RESTORED",
      [
        actor("actor.glass-finch.map-marker", "player", 80, 146, 20, "right", "map marker", "A tiny keeper silhouette distinguishes current location from route icons."),
      ],
      [
        prop("prop.glass-finch.map-orchard", "exit", 72, 112, 28, 20, "orchard", "visited"),
        prop("prop.glass-finch.map-tower", "puzzle", 224, 70, 28, 42, "tower", "repaired"),
        prop("prop.glass-finch.map-river", "exit", 246, 146, 42, 12, "thaw river", "open"),
      ],
      [
        "The map reads as a storybook object rather than a modern GPS.",
        "Route state is shown through season and landmark changes.",
        "The repaired tower remains the visible cause of the new route.",
      ],
    ),
  ],
  puzzleBeats: [
    puzzle(
      "puzzle.glass-finch.clapper",
      "environmental-state",
      "plate.glass-finch.gameplay",
      "The bell cannot ring and the orchard is freezing.",
      "Recover the pin, repair the clapper and ring the note shown by the finch.",
      "The frost retreats and the valley route changes on the map.",
      "A wrong note changes only the weather loop and can be corrected immediately.",
    ),
  ],
  originalityStatement:
    "Original characters, valley geography, bell mechanics, dialogue and visual motifs; no existing fairytale adventure scene or puzzle is reproduced.",
});
