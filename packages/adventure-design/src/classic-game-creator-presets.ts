import {
  createClassicAdventureCreatorProject,
  type ClassicAdventureCreatorRecipe,
} from "./classic-game-creator-factory.js";
import type {
  ClassicAdventureCreatorProject,
} from "./classic-game-creator-types.js";

const storybookRecipe: ClassicAdventureCreatorRecipe = {
  id: "creator.the-glass-finch",
  title: "The Glass Finch Creator Project",
  family: "storybook-icon",
  profileId: "storybook-icon-vga",
  showcaseId: "the-glass-finch",
  interface: {
    family: "temporary-icon-bar",
    gameplayViewportHeight: 200,
    chromeHeight: 0,
    overlayHeight: 28,
    openBehaviour: "temporary",
    verbs: ["walk", "look", "use", "talk", "inventory", "options"],
    inventorySlots: 8,
    sentenceLine: false,
    topicRows: 0,
    portraitSlots: 2,
    scoreVisible: true,
    statusPlacement: "narrator panel or short room-preserving subtitle",
    cursorDoctrine:
      "Large symbolic cursors switch only after the player commits an action.",
  },
  timing: {
    logicalTicksPerSecond: 60,
    pointerAcknowledgeTicks: 1,
    hoverCommitTicks: 2,
    movementStartPoseTicks: 4,
    turnPoseTicks: 3,
    actionAnticipationTicks: 5,
    actionRecoveryTicks: 6,
    wrongActionHoldTicks: 45,
    lineMinimumTicks: 90,
    sceneFadeOutTicks: 12,
    sceneDarkHoldTicks: 4,
    sceneFadeInTicks: 16,
  },
  puzzles: [
    {
      id: "creator-puzzle.glass-finch.clapper",
      title: "Repair the bell and reverse the frost",
      grammar: "environmental-state",
      setupSceneId: "scene.creator.the-glass-finch.gameplay",
      resolutionSceneId: "scene.creator.the-glass-finch.system",
      requiredPropIds: [
        "prop.glass-finch.pin",
        "prop.glass-finch.rope",
      ],
      steps: [
        "Inspect the frayed rope and establish that the bell cannot ring.",
        "Recover the clapper pin from the orchard floor.",
        "Repair the mechanism before selecting the learned note.",
        "Ring the note and verify the thaw on the physical valley map.",
      ],
      result:
        "The orchard thaws, the map redraws the river route and the tower " +
        "remains visibly repaired on every return.",
      recovery:
        "A wrong note changes only the weather loop; the mechanism remains " +
        "usable and the finch repeats a visual clue without solving the puzzle.",
      irreversibleFailure: false,
    },
  ],
  dialogues: [
    {
      id: "creator-dialogue.glass-finch.warning",
      sceneId: "scene.creator.the-glass-finch.dialogue",
      mode: "storybook-exchange",
      openingLine: "A bell remembers who rang it last.",
      topics: ["the broken bell", "the frost", "the remembered note"],
      stateChanges: [
        "reveal the note rune",
        "change the bird from warning pose to waiting pose",
      ],
    },
  ],
  productionPromise:
    "A painterly 320 by 200 fairytale where every room reads as an illustrated " +
    "tableau, actor silhouettes stay clear and magical state changes remain physical.",
  originalityStatement:
    "This creator project uses an original bell keeper, crystal bird, valley, " +
    "season mechanism, dialogue and map language. It studies period storybook " +
    "production grammar without reproducing any existing character, room or puzzle.",
};

const investigationRecipe: ClassicAdventureCreatorRecipe = {
  id: "creator.the-red-ledger",
  title: "The Red Ledger Creator Project",
  family: "gothic-investigation",
  profileId: "gothic-investigation-vga",
  showcaseId: "the-red-ledger",
  interface: {
    family: "portrait-topic-ledger",
    gameplayViewportHeight: 200,
    chromeHeight: 0,
    overlayHeight: 0,
    openBehaviour: "modal",
    verbs: ["walk", "look", "use", "talk", "inventory", "ledger", "options"],
    inventorySlots: 10,
    sentenceLine: false,
    topicRows: 7,
    portraitSlots: 2,
    scoreVisible: false,
    statusPlacement: "bottom narration strip with evidence accents",
    cursorDoctrine:
      "Small contextual icons retain a grounded hand-drawn silhouette and " +
      "never pulse, glow or expose hidden hotspots.",
  },
  timing: {
    logicalTicksPerSecond: 60,
    pointerAcknowledgeTicks: 1,
    hoverCommitTicks: 3,
    movementStartPoseTicks: 5,
    turnPoseTicks: 4,
    actionAnticipationTicks: 6,
    actionRecoveryTicks: 8,
    wrongActionHoldTicks: 54,
    lineMinimumTicks: 105,
    sceneFadeOutTicks: 18,
    sceneDarkHoldTicks: 8,
    sceneFadeInTicks: 20,
  },
  puzzles: [
    {
      id: "creator-puzzle.red-ledger.contradiction",
      title: "Prove the impossible account date",
      grammar: "topic-investigation",
      setupSceneId: "scene.creator.the-red-ledger.gameplay",
      resolutionSceneId: "scene.creator.the-red-ledger.system",
      requiredPropIds: [
        "prop.red-ledger.account",
        "prop.red-ledger.drawer",
        "prop.red-ledger.evidence-date",
        "prop.red-ledger.evidence-paper",
        "prop.red-ledger.evidence-chapel",
      ],
      steps: [
        "Inspect the account and notice that its ink and paper disagree.",
        "Search the misfiled drawer for the harbour office construction record.",
        "Unlock the chapel topic by comparing the registry and account date.",
        "Confront the clerk only after the physical evidence supports the claim.",
      ],
      result:
        "The contradiction ledger records the reasoning, the clerk changes " +
        "pose and testimony, and the service alley becomes a visible route.",
      recovery:
        "A premature accusation temporarily closes one topic, but returning " +
        "with researched evidence reopens the interview and preserves progress.",
      irreversibleFailure: false,
    },
  ],
  dialogues: [
    {
      id: "creator-dialogue.red-ledger.clerk",
      sceneId: "scene.creator.the-red-ledger.dialogue",
      mode: "portrait-topics",
      openingLine: "The archive closes when the rain reaches the lower stair.",
      topics: [
        "account date",
        "paper stock",
        "harbour office",
        "river chapel",
        "missing witness",
        "service alley",
        "the clerk",
      ],
      stateChanges: [
        "unlock chapel topic after paper research",
        "replace guarded pose after contradiction",
        "open service alley route after testimony",
      ],
    },
  ],
  productionPromise:
    "A rain-dark 320 by 200 investigation where rooms feel inhabited, portraits " +
    "carry subtext, evidence remains physical and chapter state visibly changes locations.",
  originalityStatement:
    "This creator project uses an original archivist, harbour city, impossible " +
    "debt mystery, evidence ledger, witnesses and dialogue topics. It studies " +
    "gothic investigation craft without copying any commercial story, portrait or scene.",
};

const verbPanelRecipe: ClassicAdventureCreatorRecipe = {
  id: "creator.saltwake-island",
  title: "Saltwake Island Creator Project",
  family: "verb-panel-comedy",
  profileId: "verb-panel-cartoon-vga",
  showcaseId: "saltwake-island",
  interface: {
    family: "persistent-verb-panel",
    gameplayViewportHeight: 144,
    chromeHeight: 56,
    overlayHeight: 0,
    openBehaviour: "persistent",
    verbs: [
      "give",
      "pick up",
      "use",
      "open",
      "look at",
      "push",
      "close",
      "talk to",
      "pull",
    ],
    inventorySlots: 8,
    sentenceLine: true,
    topicRows: 0,
    portraitSlots: 0,
    scoreVisible: false,
    statusPlacement: "sentence line directly above the command grid",
    cursorDoctrine:
      "A compact crosshair commits object targets while the sentence line " +
      "shows the exact verb, item and destination before execution.",
  },
  timing: {
    logicalTicksPerSecond: 60,
    pointerAcknowledgeTicks: 0,
    hoverCommitTicks: 0,
    movementStartPoseTicks: 2,
    turnPoseTicks: 2,
    actionAnticipationTicks: 3,
    actionRecoveryTicks: 4,
    wrongActionHoldTicks: 30,
    lineMinimumTicks: 72,
    sceneFadeOutTicks: 10,
    sceneDarkHoldTicks: 3,
    sceneFadeInTicks: 12,
  },
  puzzles: [
    {
      id: "creator-puzzle.saltwake.chart-permit",
      title: "Acquire the tide chart through useless paperwork",
      grammar: "inventory-chain",
      setupSceneId: "scene.creator.saltwake-island.gameplay",
      resolutionSceneId: "scene.creator.saltwake-island.system",
      requiredPropIds: [
        "prop.saltwake.office-window",
        "prop.saltwake.chart-tube",
        "prop.saltwake.permit",
        "prop.saltwake.stamp",
      ],
      steps: [
        "Read the office refusal and establish the exact missing form.",
        "Acquire the obsolete permit from the council clerk.",
        "Use the permit with the guarded office stamp.",
        "Use the stamped permit at the window and collect the chart tube.",
      ],
      result:
        "The chart enters inventory, the sentence line confirms the action and " +
        "the low-tide route becomes constructible on the fold-out chart.",
      recovery:
        "Every consumed or misplaced permit can be reacquired until the chart " +
        "is awarded, and failed uses receive short authored comic responses.",
      irreversibleFailure: false,
    },
  ],
  dialogues: [
    {
      id: "creator-dialogue.saltwake.master",
      sceneId: "scene.creator.saltwake-island.dialogue",
      mode: "in-scene-choices",
      openingLine:
        "I only accept forms stamped by someone less qualified than me.",
      topics: [
        "the tide chart",
        "the obsolete permit",
        "the council vote",
        "the lighthouse bells",
      ],
      stateChanges: [
        "reveal the stamp requirement",
        "change the harbour master reaction pose",
      ],
    },
  ],
  productionPromise:
    "A bright 320 by 200 object-comedy adventure with a persistent command " +
    "panel, exact sentence construction, readable reactions and recoverable inventory play.",
  originalityStatement:
    "This creator project uses an original island, apprentice, harbour office, " +
    "council premise, tide chart and inventory chain. It studies classic verb-panel " +
    "comedy without reproducing any existing pirate, location, dialogue or puzzle.",
};

export const classicAdventureCreatorProjects: readonly ClassicAdventureCreatorProject[] = [
  createClassicAdventureCreatorProject(storybookRecipe),
  createClassicAdventureCreatorProject(investigationRecipe),
  createClassicAdventureCreatorProject(verbPanelRecipe),
];

export const classicAdventureCreatorProjectById = (
  id: string,
): ClassicAdventureCreatorProject => {
  const project = classicAdventureCreatorProjects.find(
    (candidate) => candidate.id === id,
  );
  if (!project) {
    throw new Error(`Classic adventure creator project '${id}' is missing.`);
  }
  return project;
};

export const classicAdventureCreatorProjectByFamily = (
  family: ClassicAdventureCreatorProject["family"],
): ClassicAdventureCreatorProject => {
  const project = classicAdventureCreatorProjects.find(
    (candidate) => candidate.family === family,
  );
  if (!project) {
    throw new Error(`Classic adventure creator family '${family}' is missing.`);
  }
  return project;
};
