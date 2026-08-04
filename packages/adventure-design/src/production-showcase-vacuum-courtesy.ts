import { actor, plate, prop, puzzle, showcase } from "./production-showcase-factory.js";

export const vacuumCourtesyShowcase = showcase({
  id: "vacuum-courtesy",
  profileId: "comic-scifi-icon-vga",
  title: "Vacuum Courtesy",
  genre: "comic science-fiction service adventure",
  logline:
    "A maintenance clerk must stop a diplomatic banquet from being vented through a station's customer-service airlock.",
  motif: "orbital-service-bay",
  titleTreatment:
    "A crooked transmission card assembles from utility panels, warning chevrons and one absurdly polite status light.",
  dialogueTreatment:
    "Compact in-scene dialogue favours strong reaction poses and specific machine feedback.",
  systemTreatment:
    "A maintenance schematic exposes valves, pressure zones and bureaucratic ownership without becoming a generic hacking screen.",
  plates: [
    plate(
      "plate.vacuum-courtesy.title",
      "title",
      "Transmission title card",
      "Establish machine comedy and a bright service-station identity.",
      160,
      96,
      126,
      "VACUUM COURTESY",
      [],
      [
        prop("prop.vacuum.title-console", "ambience", 92, 64, 136, 58, "service console", "booting", false),
        prop("prop.vacuum.title-light", "clue", 214, 76, 12, 12, "courtesy light", "green", false),
      ],
      [
        "Hard-edged colour clusters keep the title readable at CRT scale.",
        "The station mark has a silhouette distinct from the game title.",
        "Machine animation is limited to two purposeful status changes.",
      ],
    ),
    plate(
      "plate.vacuum-courtesy.gameplay",
      "gameplay",
      "Diplomatic service bay",
      "Reroute banquet pressure before the courtesy airlock opens.",
      252,
      104,
      106,
      "PLEASE REMAIN CALM WHILE OXYGEN IS REASSIGNED.",
      [
        actor("actor.vacuum.clerk", "player", 84, 166, 52, "right", "toolbox ready", "Square helmet, toolbox and bent knees read before suit detail."),
        actor("actor.vacuum.attendant", "npc", 198, 158, 48, "left", "polite panic", "Raised tray and rigid smile form the comic reaction silhouette."),
      ],
      [
        prop("prop.vacuum.valve", "puzzle", 226, 86, 32, 44, "pressure valve", "mislabelled"),
        prop("prop.vacuum.airlock", "exit", 272, 62, 38, 82, "courtesy airlock", "counting down"),
        prop("prop.vacuum.manual", "clue", 134, 142, 26, 16, "service manual", "upside-down"),
      ],
      [
        "Machines, actors and exit remain readable despite saturated colour.",
        "Every warning light corresponds to a visible mechanical state.",
        "The icon bar preserves enough room for the countdown and reaction pose.",
      ],
    ),
    plate(
      "plate.vacuum-courtesy.dialogue",
      "dialogue",
      "Attendant complaint",
      "Learn why the correct valve has the wrong label.",
      160,
      100,
      112,
      "The blue handle is red on weekends. Union regulation.",
      [
        actor("actor.vacuum.clerk-close", "player", 88, 166, 72, "right", "flat stare", "The visor reflection stays one simple shape."),
        actor("actor.vacuum.attendant-close", "npc", 228, 164, 74, "left", "tray explanation", "Tray, smile and one raised finger carry the line."),
      ],
      [
        prop("prop.vacuum.label-card", "clue", 142, 66, 48, 20, "weekend label", "folded"),
        prop("prop.vacuum.warning-panel", "ambience", 246, 48, 40, 22, "warning panel", "flashing", false),
      ],
      [
        "The punch line is supported by pose and prop before text completes.",
        "The clue is specific enough to test without random trial.",
        "Dialogue remains inside the active machinery scene.",
      ],
    ),
    plate(
      "plate.vacuum-courtesy.system",
      "system",
      "Pressure ownership schematic",
      "Trace which department owns the banquet air circuit.",
      160,
      102,
      118,
      "CIRCUIT 7B · OWNER: HOSPITALITY ADJACENT",
      [
        actor("actor.vacuum.schematic-marker", "player", 58, 150, 20, "right", "service marker", "A compact helmet marker shows current maintenance access."),
      ],
      [
        prop("prop.vacuum.zone-banquet", "puzzle", 68, 70, 58, 32, "banquet zone", "low pressure"),
        prop("prop.vacuum.zone-airlock", "exit", 222, 70, 58, 32, "airlock zone", "armed"),
        prop("prop.vacuum.zone-valve", "clue", 146, 130, 42, 24, "weekend valve", "cross-owned"),
      ],
      [
        "The schematic retains physical pipes and labels instead of abstract code rain.",
        "Ownership bureaucracy is part of the puzzle cause.",
        "Correct routing produces an immediate room-state change.",
      ],
    ),
  ],
  puzzleBeats: [
    puzzle(
      "puzzle.vacuum.weekend-valve",
      "comic-misapplication",
      "plate.vacuum-courtesy.gameplay",
      "The obvious valve worsens the countdown because its label changes on weekends.",
      "Use the manual and attendant clue to operate the physically mismatched handle.",
      "Pressure returns to the banquet and the airlock resumes customer-service mode.",
      "Wrong valves trigger short specific reactions and remain reversible.",
    ),
  ],
  originalityStatement:
    "Original station, service bureaucracy, characters, machine states and dialogue; no existing comic space-adventure room or puzzle is reproduced.",
});
