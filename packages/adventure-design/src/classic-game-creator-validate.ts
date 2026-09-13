import type {
  ClassicAdventureCreatorFamily,
  ClassicAdventureCreatorInterface,
  ClassicAdventureCreatorIssue,
  ClassicAdventureCreatorIssueCode,
  ClassicAdventureCreatorProject,
  ClassicAdventureCreatorReport,
  ClassicAdventureCreatorScene,
  ClassicAdventureCreatorTiming,
} from "./classic-game-creator-types.js";

const expectedFamilyContract: Readonly<
  Record<
    ClassicAdventureCreatorFamily,
    {
      readonly profileId: ClassicAdventureCreatorProject["profileId"];
      readonly showcaseId: ClassicAdventureCreatorProject["showcaseId"];
      readonly interfaceFamily: ClassicAdventureCreatorInterface["family"];
    }
  >
> = {
  "storybook-icon": {
    profileId: "storybook-icon-vga",
    showcaseId: "the-glass-finch",
    interfaceFamily: "temporary-icon-bar",
  },
  "gothic-investigation": {
    profileId: "gothic-investigation-vga",
    showcaseId: "the-red-ledger",
    interfaceFamily: "portrait-topic-ledger",
  },
  "verb-panel-comedy": {
    profileId: "verb-panel-cartoon-vga",
    showcaseId: "saltwake-island",
    interfaceFamily: "persistent-verb-panel",
  },
};

const issue = (
  issues: ClassicAdventureCreatorIssue[],
  severity: ClassicAdventureCreatorIssue["severity"],
  code: ClassicAdventureCreatorIssueCode,
  path: string,
  message: string,
  recommendation: string,
  impact: number,
): void => {
  issues.push({
    severity,
    code,
    path,
    message,
    recommendation,
    impact,
  });
};

const registerId = (
  ids: Map<string, string>,
  issues: ClassicAdventureCreatorIssue[],
  id: string,
  path: string,
): void => {
  const previous = ids.get(id);
  if (previous) {
    issue(
      issues,
      "error",
      "duplicate-id",
      path,
      `ID '${id}' is already declared at '${previous}'.`,
      "Use one stable, globally unique ID for every creator entity.",
      12,
    );
    return;
  }
  ids.set(id, path);
};

const validHexColour = (value: string): boolean => /^#[0-9a-f]{6}$/iu.test(value);

const pointInside = (x: number, y: number, width: number, height: number): boolean =>
  x >= 0 && y >= 0 && x <= width && y <= height;

const sceneGeometry = (
  project: ClassicAdventureCreatorProject,
  scene: ClassicAdventureCreatorScene,
  sceneIndex: number,
  issues: ClassicAdventureCreatorIssue[],
): void => {
  const path = `scenes[${sceneIndex}]`;
  const viewportHeight = scene.interfaceSafeRect.height;
  if (
    !pointInside(scene.focalPoint.x, scene.focalPoint.y, project.nativeSize.width, viewportHeight) ||
    scene.horizonY < 0 ||
    scene.horizonY > viewportHeight ||
    scene.walkLane.top < 0 ||
    scene.walkLane.bottom > viewportHeight ||
    scene.walkLane.top >= scene.walkLane.bottom
  ) {
    issue(
      issues,
      "error",
      "invalid-scene-geometry",
      path,
      `Scene '${scene.id}' has focal, horizon or walk-lane geometry outside ` +
        "the active native gameplay viewport.",
      "Keep focal points, horizons and walk lanes inside the profile viewport.",
      14,
    );
  }
  const expectedSafeHeight =
    project.interface.openBehaviour === "persistent" &&
    (scene.kind === "gameplay" || scene.kind === "dialogue")
      ? project.interface.gameplayViewportHeight
      : project.nativeSize.height;
  if (
    scene.interfaceSafeRect.x !== 0 ||
    scene.interfaceSafeRect.y !== 0 ||
    scene.interfaceSafeRect.width !== project.nativeSize.width ||
    scene.interfaceSafeRect.height !== expectedSafeHeight
  ) {
    issue(
      issues,
      "warning",
      "invalid-scene-geometry",
      `${path}.interfaceSafeRect`,
      "The scene safe rectangle does not match the selected interface viewport.",
      "Regenerate the safe rectangle after changing interface chrome.",
      5,
    );
  }

  scene.actors.forEach((actor, actorIndex) => {
    if (
      !pointInside(actor.position.x, actor.position.y, project.nativeSize.width, viewportHeight) ||
      actor.height <= 0 ||
      actor.height > viewportHeight
    ) {
      issue(
        issues,
        "error",
        "invalid-scene-geometry",
        `${path}.actors[${actorIndex}]`,
        `Actor '${actor.id}' is outside the native gameplay viewport.`,
        "Move the actor foot point and silhouette entirely into the scene.",
        10,
      );
    }
  });

  scene.props.forEach((prop, propIndex) => {
    if (
      prop.size.width <= 0 ||
      prop.size.height <= 0 ||
      prop.position.x < 0 ||
      prop.position.y < 0 ||
      prop.position.x + prop.size.width > project.nativeSize.width ||
      prop.position.y + prop.size.height > viewportHeight
    ) {
      issue(
        issues,
        "error",
        "invalid-scene-geometry",
        `${path}.props[${propIndex}]`,
        `Prop '${prop.id}' exceeds the native gameplay viewport.`,
        "Keep the complete prop rectangle visible at one-times native scale.",
        10,
      );
    }
  });

  if (scene.kind === "gameplay" && !scene.props.some((prop) => prop.interactive)) {
    issue(
      issues,
      "error",
      "missing-interaction",
      `${path}.props`,
      `Gameplay scene '${scene.id}' contains no interactive prop.`,
      "Add at least one readable stateful target to every gameplay scene.",
      14,
    );
  }
};

const validateInterface = (
  project: ClassicAdventureCreatorProject,
  issues: ClassicAdventureCreatorIssue[],
): void => {
  const contract = expectedFamilyContract[project.family];
  const value = project.interface;
  if (value.family !== contract.interfaceFamily) {
    issue(
      issues,
      "error",
      "invalid-interface",
      "interface.family",
      `Family '${project.family}' requires '${contract.interfaceFamily}', not ` + `'${value.family}'.`,
      "Select the interface family governed by the production profile.",
      18,
    );
  }
  if (value.gameplayViewportHeight + value.chromeHeight !== project.nativeSize.height) {
    issue(
      issues,
      "error",
      "invalid-interface",
      "interface.gameplayViewportHeight",
      "Gameplay viewport and persistent chrome do not fill the native canvas.",
      "Make gameplay viewport height plus chrome height equal native height.",
      14,
    );
  }

  if (value.family === "temporary-icon-bar") {
    if (
      value.openBehaviour !== "temporary" ||
      value.chromeHeight !== 0 ||
      value.overlayHeight < 24 ||
      value.verbs.length < 6
    ) {
      issue(
        issues,
        "error",
        "invalid-interface",
        "interface",
        "The storybook icon interface must be temporary, non-persistent and " +
          "contain the complete symbolic action set.",
        "Use a 24–40 pixel temporary icon bar with at least six actions.",
        14,
      );
    }
  } else if (value.family === "portrait-topic-ledger") {
    if (value.openBehaviour !== "modal" || value.portraitSlots !== 2 || value.topicRows < 5) {
      issue(
        issues,
        "error",
        "invalid-interface",
        "interface",
        "The investigation interface requires two portrait anchors and a " + "substantial topic ledger.",
        "Use two portrait slots and at least five evidence-driven topic rows.",
        16,
      );
    }
  } else if (
    value.openBehaviour !== "persistent" ||
    value.chromeHeight < 52 ||
    value.chromeHeight > 72 ||
    !value.sentenceLine ||
    value.verbs.length < 9 ||
    value.inventorySlots < 6
  ) {
    issue(
      issues,
      "error",
      "invalid-interface",
      "interface",
      "The verb-panel family requires persistent chrome, a sentence line, " +
        "nine actions and visible inventory capacity.",
      "Reserve 52–72 native pixels for verbs, sentence construction and inventory.",
      18,
    );
  }
};

const validateTiming = (
  timing: ClassicAdventureCreatorTiming,
  issues: ClassicAdventureCreatorIssue[],
): void => {
  if (timing.logicalTicksPerSecond !== 60) {
    issue(
      issues,
      "error",
      "invalid-timing",
      "timing.logicalTicksPerSecond",
      "Classic creator projects use the canonical 60-tick runtime.",
      "Keep logical simulation at 60 ticks and vary authored holds instead.",
      16,
    );
  }
  const bounded: readonly [
    keyof Omit<ClassicAdventureCreatorTiming, "logicalTicksPerSecond">,
    number,
    number,
  ][] = [
    ["pointerAcknowledgeTicks", 0, 4],
    ["hoverCommitTicks", 0, 8],
    ["movementStartPoseTicks", 1, 12],
    ["turnPoseTicks", 1, 10],
    ["actionAnticipationTicks", 1, 16],
    ["actionRecoveryTicks", 1, 20],
    ["wrongActionHoldTicks", 18, 120],
    ["lineMinimumTicks", 48, 180],
    ["sceneFadeOutTicks", 4, 30],
    ["sceneDarkHoldTicks", 0, 18],
    ["sceneFadeInTicks", 4, 36],
  ];
  for (const [field, minimum, maximum] of bounded) {
    const value = timing[field];
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      issue(
        issues,
        "error",
        "invalid-timing",
        `timing.${field}`,
        `Timing '${field}' is ${value}; expected ${minimum}–${maximum} ticks.`,
        "Use deliberate but responsive native-tick holds.",
        8,
      );
    }
  }
};

export const validateClassicAdventureCreatorProject = (
  project: ClassicAdventureCreatorProject,
): ClassicAdventureCreatorReport => {
  const issues: ClassicAdventureCreatorIssue[] = [];
  const ids = new Map<string, string>();
  const contract = expectedFamilyContract[project.family];

  if (project.profileId !== contract.profileId) {
    issue(
      issues,
      "error",
      "profile-family-mismatch",
      "profileId",
      `Family '${project.family}' requires profile '${contract.profileId}'.`,
      "Restore the canonical production profile for this creator family.",
      20,
    );
  }
  if (project.showcaseId !== contract.showcaseId) {
    issue(
      issues,
      "error",
      "showcase-family-mismatch",
      "showcaseId",
      `Family '${project.family}' requires showcase '${contract.showcaseId}'.`,
      "Use the original showcase that proves this production family.",
      16,
    );
  }
  if (project.nativeSize.width !== 320 || project.nativeSize.height !== 200) {
    issue(
      issues,
      "error",
      "invalid-native-size",
      "nativeSize",
      "The three flagship creator examples are authored at 320 by 200.",
      "Author directly on the native canvas and integer-scale only at presentation.",
      20,
    );
  }

  const uniqueAnchors = new Set(project.palette.anchors.map((value) => value.toLowerCase()));
  if (
    project.palette.maxColours < 16 ||
    project.palette.maxColours > 256 ||
    project.palette.anchors.length < 6 ||
    uniqueAnchors.size !== project.palette.anchors.length ||
    project.palette.anchors.some((value) => !validHexColour(value)) ||
    project.palette.interfaceReservation < 0 ||
    project.palette.interfaceReservation >= project.palette.maxColours
  ) {
    issue(
      issues,
      "error",
      "invalid-palette",
      "palette",
      "Palette budget, anchor colours or interface reservation is invalid.",
      "Use 16–256 controlled colours, six unique hex anchors and reserved UI ink.",
      18,
    );
  }

  registerId(ids, issues, project.id, "id");
  const requiredKinds = new Set(["title", "gameplay", "dialogue", "system"]);
  project.scenes.forEach((scene, sceneIndex) => {
    registerId(ids, issues, scene.id, `scenes[${sceneIndex}].id`);
    for (const layer of scene.layers) {
      registerId(ids, issues, layer.id, `scenes[${sceneIndex}].layers`);
    }
    for (const actor of scene.actors) {
      registerId(ids, issues, actor.id, `scenes[${sceneIndex}].actors`);
    }
    for (const prop of scene.props) {
      registerId(ids, issues, prop.id, `scenes[${sceneIndex}].props`);
    }
    requiredKinds.delete(scene.kind);
    sceneGeometry(project, scene, sceneIndex, issues);
  });
  for (const missing of requiredKinds) {
    issue(
      issues,
      "error",
      "missing-scene-kind",
      "scenes",
      `Creator project is missing its '${missing}' construction scene.`,
      "Provide title, gameplay, dialogue and system proof for every flagship example.",
      14,
    );
  }

  validateInterface(project, issues);
  validateTiming(project.timing, issues);

  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  const propIds = new Set(project.scenes.flatMap((scene) => scene.props.map((prop) => prop.id)));
  project.puzzles.forEach((puzzle, puzzleIndex) => {
    registerId(ids, issues, puzzle.id, `puzzles[${puzzleIndex}].id`);
    if (!sceneIds.has(puzzle.setupSceneId) || !sceneIds.has(puzzle.resolutionSceneId)) {
      issue(
        issues,
        "error",
        "missing-puzzle-scene",
        `puzzles[${puzzleIndex}]`,
        `Puzzle '${puzzle.id}' references a missing setup or resolution scene.`,
        "Point every puzzle beat to stable creator scene IDs.",
        14,
      );
    }
    for (const propId of puzzle.requiredPropIds) {
      if (!propIds.has(propId)) {
        issue(
          issues,
          "error",
          "missing-puzzle-prop",
          `puzzles[${puzzleIndex}].requiredPropIds`,
          `Puzzle '${puzzle.id}' references missing prop '${propId}'.`,
          "Keep puzzle evidence tied to visible, stateful scene props.",
          12,
        );
      }
    }
    if (puzzle.irreversibleFailure || puzzle.recovery.trim().length < 40 || puzzle.steps.length < 3) {
      issue(
        issues,
        "error",
        "unsafe-puzzle-recovery",
        `puzzles[${puzzleIndex}]`,
        `Puzzle '${puzzle.id}' lacks a complete recoverable interaction path.`,
        "Provide at least three causal steps and a concrete recovery route.",
        18,
      );
    }
  });

  project.dialogues.forEach((dialogue, dialogueIndex) => {
    registerId(ids, issues, dialogue.id, `dialogues[${dialogueIndex}].id`);
    if (!sceneIds.has(dialogue.sceneId)) {
      issue(
        issues,
        "error",
        "missing-dialogue-scene",
        `dialogues[${dialogueIndex}].sceneId`,
        `Dialogue '${dialogue.id}' references missing scene '${dialogue.sceneId}'.`,
        "Attach every dialogue treatment to a stable creator scene.",
        12,
      );
    }
    if (project.family === "gothic-investigation" && dialogue.topics.length < 5) {
      issue(
        issues,
        "error",
        "insufficient-investigation-topics",
        `dialogues[${dialogueIndex}].topics`,
        "The flagship investigation requires at least five evidence-driven topics.",
        "Author topics that unlock from discovered testimony and physical clues.",
        16,
      );
    }
  });

  if (
    project.originalityStatement.length < 120 ||
    !project.originalityStatement.toLowerCase().includes("original")
  ) {
    issue(
      issues,
      "error",
      "missing-originality-boundary",
      "originalityStatement",
      "The creator project does not state a strong original-content boundary.",
      "Name the original cast, setting and puzzle language and reject direct copying.",
      20,
    );
  }

  const score = Math.max(
    0,
    100 -
      issues.reduce(
        (total, current) =>
          total +
          (current.severity === "error"
            ? current.impact
            : current.severity === "warning"
              ? Math.ceil(current.impact / 2)
              : 0),
        0,
      ),
  );
  const status = issues.some((current) => current.severity === "error")
    ? "blocked"
    : issues.some((current) => current.severity === "warning")
      ? "attention"
      : "ready";

  return {
    reportVersion: 1,
    projectId: project.id,
    status,
    score,
    issues: issues.sort(
      (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
    ),
    metrics: {
      sceneCount: project.scenes.length,
      interactivePropCount: project.scenes.reduce(
        (total, scene) => total + scene.props.filter((prop) => prop.interactive).length,
        0,
      ),
      puzzleCount: project.puzzles.length,
      dialogueTopicCount: project.dialogues.reduce((total, dialogue) => total + dialogue.topics.length, 0),
      nativeReviewProofCount: project.scenes.reduce((total, scene) => total + scene.reviewProofs.length, 0),
    },
  };
};
