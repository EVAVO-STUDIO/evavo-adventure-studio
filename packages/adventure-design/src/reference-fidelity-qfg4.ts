import { commonCapabilities } from "./reference-fidelity-common-capabilities.js";
import { commonScenarios, ids, pack, scenario, titleCapability, variant } from "./reference-fidelity-foundation.js";

const qfg4Specific = [
  titleCapability(
    "rpg-attributes",
    "RPG attributes",
    "rpg",
    "Persist attributes and derived values across exploration.",
  ),
  titleCapability(
    "skill-checks",
    "Skill checks",
    "rpg",
    "Resolve authored skill thresholds without hidden nondeterminism.",
  ),
  titleCapability(
    "class-specific-solutions",
    "Class-specific solutions",
    "rpg",
    "Support materially different fighter, magic and stealth solution paths.",
  ),
  titleCapability(
    "health-stamina-mana",
    "Health, stamina and mana",
    "rpg",
    "Track and restore the three primary resource pools through actions and combat.",
  ),
  titleCapability(
    "equipment-economy",
    "Equipment and economy",
    "rpg",
    "Persist equipment, consumables and currency with title-specific feedback.",
  ),
  titleCapability(
    "day-night-schedule",
    "Day, night and schedules",
    "world",
    "Advance time, lighting, encounters and character availability deterministically.",
  ),
  titleCapability(
    "combat-system",
    "Combat system",
    "rpg",
    "Resolve bounded combat, damage, recovery and defeat without corrupting adventure state.",
  ),
  titleCapability(
    "character-import-export",
    "Character import and export",
    "system",
    "Validate and preserve character identity, class and progression through import and export.",
  ),
  titleCapability(
    "encounter-travel",
    "Encounter travel",
    "world",
    "Combine route traversal, random-seeming authored encounters and safe return state deterministically.",
  ),
] as const;

export const qfg4ReferenceTitlePack = pack({
    id: "reference.qfg4.dos-vga",
    titleId: "quest-for-glory-iv",
    referenceTitle: "Quest for Glory IV",
    label: "Quest for Glory IV technical grammar",
    summary:
      "SCI32 Gothic exploration with classes, skills, resources, schedules, combat " +
      "and character transfer.",
    engineDialectId: "sierra-sci32-vga",
    profileId: "gothic-investigation-vga",
    variants: [
      variant(
        "qfg4.dos.floppy.en",
        "quest-for-glory-iv",
        "sierra-sci32-vga",
        "floppy",
        "DOS VGA floppy",
        ["Interpreter, audio and combat timing are measured independently from the CD release."],
      ),
      variant(
        "qfg4.dos.cd.en",
        "quest-for-glory-iv",
        "sierra-sci32-vga",
        "cd",
        "DOS VGA CD",
        ["Speech, music and release-specific fixes require their own reference trace."],
      ),
    ],
    capabilities: [...commonCapabilities, ...qfg4Specific],
    scenarios: [
      ...commonScenarios("scenario.qfg4", ids(qfg4Specific)),
      scenario(
        "scenario.qfg4.class-route",
        "Class-specific route proof",
        "Prove that class identity changes available actions, resource pressure and puzzle outcomes.",
        [
          "rpg-attributes",
          "skill-checks",
          "class-specific-solutions",
          "health-stamina-mana",
          "combat-system",
          "day-night-schedule",
        ],
        [
          "Start equivalent fighter, magic and stealth character states.",
          "Resolve one shared obstacle through three materially different action chains.",
          "Save and replay each branch, then compare later room and schedule consequences.",
        ],
        "Each class reaches a valid but distinct consequence without sharing an " +
          "implausible generic solution.",
      ),
    ],
    originalProof: {
      showcaseId: "showcase.hollow-vale",
      title: "The Hollow Vale",
      profileId: "gothic-investigation-vga",
      status: "planned",
      originalAssetsOnly: true,
      featuredSystems: ["classes", "skill growth", "day and night", "combat", "character transfer"],
      note: "This requires a new original RPG showcase; it must not be represented by The Red Ledger.",
    },
  });
