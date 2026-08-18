import type {
  DynamixCinematicContract,
  DynamixCinematicIssue,
  DynamixCinematicIssueCode,
} from "./dynamix-cinematic-types.js";

const issue = (
  issues: DynamixCinematicIssue[],
  code: DynamixCinematicIssueCode,
  path: string,
  message: string,
  severity: DynamixCinematicIssue["severity"] = "error",
): void => {
  issues.push({ severity, code, path, message });
};

const duplicates = (values: readonly string[]): readonly string[] => {
  const observed = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (observed.has(value)) repeated.add(value);
    observed.add(value);
  }
  return [...repeated].sort();
};

const finiteInteger = (
  value: number,
  minimum: number,
  maximum: number,
): boolean =>
  Number.isSafeInteger(value) && value >= minimum && value <= maximum;

const registerIds = (
  issues: DynamixCinematicIssue[],
  values: readonly string[],
  path: string,
): void => {
  for (const duplicate of duplicates(values)) {
    issue(issues, "duplicate-id", path, `ID '${duplicate}' is duplicated.`);
  }
};

const validateVisual = (
  contract: DynamixCinematicContract,
  issues: DynamixCinematicIssue[],
): void => {
  const visual = contract.visual;
  if (
    visual.nativeWidth !== 320 ||
    visual.nativeHeight !== 200 ||
    visual.intendedDisplayAspect !== "4:3" ||
    visual.paletteMode !== "indexed-8-bit" ||
    visual.maxColours !== 256 ||
    visual.integerScale !== true ||
    visual.textureSampling !== "nearest" ||
    visual.spriteTransparency !== "binary" ||
    visual.sceneConstruction !== "native-first"
  ) {
    issue(
      issues,
      "invalid-visual-contract",
      "visual",
      "Dynamix cinematic production requires native 320 × 200 indexed VGA, four-by-three " +
        "display review, integer scaling, nearest sampling and binary sprite transparency.",
    );
  }
  if (
    visual.panelLanguage.trim().length < 20 ||
    visual.backgroundDoctrine.length < 4 ||
    visual.animationDoctrine.length < 4 ||
    visual.prohibitedShortcuts.length < 4
  ) {
    issue(
      issues,
      "invalid-visual-contract",
      "visual",
      "Visual doctrine requires complete panel, background, animation and prohibited-shortcut guidance.",
    );
  }
  const prohibited = visual.prohibitedShortcuts.join(" ").toLocaleLowerCase("en-US");
  for (const term of ["linear", "bloom", "soft-alpha", "commercial"]) {
    if (!prohibited.includes(term)) {
      issue(
        issues,
        "invalid-visual-contract",
        "visual.prohibitedShortcuts",
        `Visual contract does not explicitly prohibit '${term}' shortcuts.`,
      );
    }
  }
};

const validateTiming = (
  contract: DynamixCinematicContract,
  issues: DynamixCinematicIssue[],
): void => {
  const timing = contract.timing;
  if (timing.logicalTicksPerSecond !== 60) {
    issue(issues, "invalid-timing", "timing.logicalTicksPerSecond", "Logical timing must remain 60 Hz.");
  }
  if (
    timing.clockMode === "continuous"
      ? timing.ticksPerGameMinute !== 300
      : timing.ticksPerGameMinute !== 0
  ) {
    issue(
      issues,
      "invalid-timing",
      "timing.ticksPerGameMinute",
      "Continuous DGDS-style clocking uses 300 logical ticks per game minute; costed-only clocks use zero.",
    );
  }
  const bounded: readonly [keyof Omit<
    typeof timing,
    "logicalTicksPerSecond" | "clockMode" | "ticksPerGameMinute"
  >, number, number][] = [
    ["pointerAcknowledgeTicks", 0, 3],
    ["hotspotCommitTicks", 0, 6],
    ["portraitRevealTicks", 6, 30],
    ["dialogueMinimumTicks", 48, 150],
    ["locationCutTicks", 4, 30],
    ["montagePanelTicks", 18, 90],
    ["actionTelegraphTicks", 6, 36],
    ["actionRecoveryTicks", 8, 42],
    ["failureHoldTicks", 24, 90],
  ];
  for (const [field, minimum, maximum] of bounded) {
    if (!finiteInteger(timing[field], minimum, maximum)) {
      issue(
        issues,
        "invalid-timing",
        `timing.${field}`,
        `Timing '${field}' must remain between ${minimum} and ${maximum} logical ticks.`,
      );
    }
  }
};

export const validateDynamixCinematicContract = (
  contract: DynamixCinematicContract,
): readonly DynamixCinematicIssue[] => {
  const issues: DynamixCinematicIssue[] = [];
  if (
    contract.contractVersion !== 1 ||
    contract.label.trim().length < 3 ||
    contract.summary.trim().length < 30
  ) {
    issue(issues, "invalid-profile", "contractVersion", "Contract identity or summary is incomplete.");
  }
  if (contract.productionProfileId !== "cinematic-pulp-vga") {
    issue(
      issues,
      "invalid-profile",
      "productionProfileId",
      "DGDS cinematic contracts must use the cinematic-pulp-vga production profile.",
    );
  }
  if (contract.originalAssetsOnly !== true || contract.originalProofTitle.trim().length < 3) {
    issue(
      issues,
      "missing-originality-boundary",
      "originalAssetsOnly",
      "A named original EVAVO proof and explicit original-assets-only boundary are required.",
    );
  }
  validateVisual(contract, issues);
  validateTiming(contract, issues);

  const protagonistIds = contract.protagonists.map((value) => value.id);
  const relationshipIds = contract.relationships.map((value) => value.id);
  const routeIds = contract.routes.map((value) => value.id);
  const choiceIds = contract.choices.map((value) => value.id);
  const actionIds = contract.actions.map((value) => value.id);
  const deadlineIds = contract.deadlines.map((value) => value.id);
  const outcomeIds = contract.outcomes.map((value) => value.id);
  registerIds(issues, protagonistIds, "protagonists");
  registerIds(issues, relationshipIds, "relationships");
  registerIds(issues, routeIds, "routes");
  registerIds(issues, choiceIds, "choices");
  registerIds(issues, actionIds, "actions");
  registerIds(issues, deadlineIds, "deadlines");
  registerIds(issues, outcomeIds, "outcomes");

  if (
    !finiteInteger(contract.start.day, 0, 3650) ||
    !finiteInteger(contract.start.hour, 0, 23) ||
    !finiteInteger(contract.start.minute, 0, 59) ||
    contract.start.locationId.trim().length < 3 ||
    !protagonistIds.includes(contract.start.protagonistId)
  ) {
    issue(issues, "invalid-start", "start", "Start time, location or protagonist is invalid.");
  }

  contract.protagonists.forEach((protagonist, index) => {
    if (
      protagonist.name.trim().length < 2 ||
      protagonist.portraitDirection.trim().length < 20 ||
      protagonist.movementDirection.trim().length < 20 ||
      protagonist.knowledgeFlags.length < 1
    ) {
      issue(
        issues,
        "invalid-protagonist",
        `protagonists[${index}]`,
        `Protagonist '${protagonist.id}' lacks complete identity, knowledge or performance direction.`,
      );
    }
  });

  contract.relationships.forEach((relationship, index) => {
    const labels = relationship.visibleLabels;
    if (
      relationship.minimum >= relationship.maximum ||
      relationship.initialValue < relationship.minimum ||
      relationship.initialValue > relationship.maximum ||
      labels.length < 3 ||
      labels.at(-1)?.maximumValue !== relationship.maximum ||
      labels.some(
        (label, labelIndex) =>
          label.label.trim().length < 2 ||
          (labelIndex > 0 &&
            label.maximumValue <= (labels[labelIndex - 1]?.maximumValue ?? Number.NEGATIVE_INFINITY)),
      )
    ) {
      issue(
        issues,
        "invalid-relationship",
        `relationships[${index}]`,
        `Relationship '${relationship.id}' has invalid bounds or visible labels.`,
      );
    }
  });

  const relationshipIdSet = new Set(relationshipIds);
  const protagonistIdSet = new Set(protagonistIds);
  const validateRelationshipChanges = (
    changes: Readonly<Record<string, number>>,
    path: string,
  ): void => {
    for (const [id, value] of Object.entries(changes)) {
      if (!relationshipIdSet.has(id) || !Number.isFinite(value)) {
        issue(
          issues,
          "invalid-relationship",
          path,
          `Relationship change '${id}' is unknown or not finite.`,
        );
      }
    }
  };

  contract.routes.forEach((route, index) => {
    if (
      route.label.trim().length < 3 ||
      route.fromLocationId.trim().length < 3 ||
      route.toLocationId.trim().length < 3 ||
      route.fromLocationId === route.toLocationId ||
      !finiteInteger(route.costMinutes, 0, 24 * 60) ||
      route.allowedProtagonistIds.length < 1 ||
      route.allowedProtagonistIds.some((id) => !protagonistIdSet.has(id)) ||
      route.montagePanels.length < 3 ||
      route.consequence.trim().length < 30
    ) {
      issue(issues, "invalid-route", `routes[${index}]`, `Route '${route.id}' is incomplete.`);
    }
    validateRelationshipChanges(route.relationshipChanges, `routes[${index}].relationshipChanges`);
  });

  contract.choices.forEach((choice, index) => {
    if (
      choice.label.trim().length < 3 ||
      !finiteInteger(choice.timeCostMinutes, 0, 12 * 60) ||
      choice.consequence.trim().length < 30
    ) {
      issue(issues, "invalid-choice", `choices[${index}]`, `Choice '${choice.id}' is incomplete.`);
    }
    validateRelationshipChanges(choice.relationshipChanges, `choices[${index}].relationshipChanges`);
  });

  contract.actions.forEach((action, index) => {
    const path = `actions[${index}]`;
    if (
      action.label.trim().length < 3 ||
      action.locationId.trim().length < 3 ||
      action.safeAnchorId.trim().length < 3 ||
      !finiteInteger(action.durationTicks, 30, 60 * 60) ||
      !finiteInteger(action.timeCostMinutes, 0, 12 * 60) ||
      action.windows.length < 2 ||
      action.successFlags.length < 1 ||
      action.failureFlags.length < 1 ||
      action.successConsequence.trim().length < 30 ||
      action.failureConsequence.trim().length < 30
    ) {
      issue(issues, "invalid-action", path, `Action '${action.id}' is incomplete.`);
    }
    if (!action.safeAnchorId.includes("anchor")) {
      issue(
        issues,
        "missing-safe-anchor",
        `${path}.safeAnchorId`,
        `Action '${action.id}' must declare an explicit safe retry anchor.`,
      );
    }
    registerIds(issues, action.windows.map((window) => window.id), `${path}.windows`);
    const ordered = [...action.windows].sort(
      (left, right) => left.opensAtTick - right.opensAtTick,
    );
    ordered.forEach((window, windowIndex) => {
      if (
        !finiteInteger(window.opensAtTick, 0, action.durationTicks) ||
        !finiteInteger(window.closesAtTick, window.opensAtTick, action.durationTicks) ||
        window.telegraph.trim().length < 15 ||
        window.successBeat.trim().length < 15
      ) {
        issue(
          issues,
          "invalid-action",
          `${path}.windows[${windowIndex}]`,
          `Action window '${window.id}' is invalid.`,
        );
      }
      const previous = ordered[windowIndex - 1];
      if (previous && window.opensAtTick <= previous.closesAtTick) {
        issue(
          issues,
          "overlapping-action-window",
          `${path}.windows[${windowIndex}]`,
          `Action window '${window.id}' overlaps '${previous.id}'.`,
        );
      }
    });
    validateRelationshipChanges(
      action.successRelationshipChanges,
      `${path}.successRelationshipChanges`,
    );
    validateRelationshipChanges(
      action.failureRelationshipChanges,
      `${path}.failureRelationshipChanges`,
    );
  });

  const outcomeIdSet = new Set(outcomeIds);
  contract.deadlines.forEach((deadline, index) => {
    if (
      !finiteInteger(deadline.gameMinute, 1, 3650 * 24 * 60) ||
      deadline.requiredFlag.trim().length < 3 ||
      !outcomeIdSet.has(deadline.failureOutcomeId) ||
      deadline.warningMinutes.length < 1 ||
      deadline.warningMinutes.some((value) => !finiteInteger(value, 1, 7 * 24 * 60))
    ) {
      issue(
        issues,
        "invalid-deadline",
        `deadlines[${index}]`,
        `Deadline '${deadline.id}' is incomplete.`,
      );
    }
  });

  if (
    contract.outcomes.length < 2 ||
    !contract.outcomes.some((outcome) => outcome.kind === "success") ||
    !contract.outcomes.some((outcome) => outcome.kind === "failure")
  ) {
    issue(
      issues,
      "invalid-outcome",
      "outcomes",
      "Each cinematic contract requires at least one success and one failure outcome.",
    );
  }
  contract.outcomes.forEach((outcome, index) => {
    if (
      outcome.title.trim().length < 3 ||
      outcome.message.trim().length < 20 ||
      Object.keys(outcome.minimumRelationships).some((id) => !relationshipIdSet.has(id))
    ) {
      issue(
        issues,
        "invalid-outcome",
        `outcomes[${index}]`,
        `Outcome '${outcome.id}' is incomplete.`,
      );
    }
  });

  if (contract.designRules.length < 4) {
    issue(
      issues,
      "invalid-profile",
      "designRules",
      "At least four game-design rules are required for the cinematic production language.",
    );
  }

  return issues.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
};

export const validateDynamixCinematicContracts = (
  contracts: readonly DynamixCinematicContract[],
): readonly DynamixCinematicIssue[] => {
  const issues = contracts.flatMap((contract) => validateDynamixCinematicContract(contract));
  for (const duplicate of duplicates(contracts.map((contract) => contract.id))) {
    issue(issues, "duplicate-id", "contracts", `Contract '${duplicate}' is duplicated.`);
  }
  return issues.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
};
