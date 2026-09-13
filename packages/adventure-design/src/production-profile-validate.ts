import type {
  AdventureProductionProfile,
  AdventureProductionProfileIssue,
} from "./production-profile-types.js";
import {
  duplicates,
  hexColour,
  issue,
  severityOrder,
  validateStringList,
} from "./production-profile-validation-shared.js";

export const validateAdventureProductionProfile = (
  profile: AdventureProductionProfile,
): readonly AdventureProductionProfileIssue[] => {
  const findings: AdventureProductionProfileIssue[] = [];
  if (profile.profileVersion !== 1) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "profileVersion",
        `Unsupported production profile version '${profile.profileVersion}'.`,
        "Migrate the profile to version 1 before use.",
      ),
    );
  }
  if (profile.label.trim().length === 0 || profile.summary.trim().length === 0) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "label",
        "A production profile requires a label and production summary.",
        "Describe the visual, interface and game-design promise in project language.",
      ),
    );
  }
  if (
    !Number.isSafeInteger(profile.nativeSize.width) ||
    !Number.isSafeInteger(profile.nativeSize.height) ||
    profile.nativeSize.width <= 0 ||
    profile.nativeSize.height <= 0
  ) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "nativeSize",
        "Native dimensions must be positive safe integers.",
        "Choose the exact canvas used for authoring, rendering and input.",
      ),
    );
  }
  if (
    !Number.isSafeInteger(profile.palette.maxColours) ||
    profile.palette.maxColours < 16 ||
    profile.palette.maxColours > 256
  ) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "palette.maxColours",
        "The built-in VGA production profiles require a palette budget from 16 to 256 colours.",
        "Set a deliberate indexed-colour budget for the final encoded output.",
      ),
    );
  }
  if (
    !Number.isSafeInteger(profile.palette.reservedInterfaceColours) ||
    profile.palette.reservedInterfaceColours < 0 ||
    profile.palette.reservedInterfaceColours >= profile.palette.maxColours
  ) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "palette.reservedInterfaceColours",
        "Reserved interface colours must fit inside the complete palette budget.",
        "Reserve a small stable UI ramp without consuming the full scene palette.",
      ),
    );
  }
  if (profile.palette.keyColours.length < 4) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "palette.keyColours",
        "A profile requires at least four palette anchors.",
        "Define shadow, middle-value, accent and highlight anchors.",
      ),
    );
  }
  profile.palette.keyColours.forEach((colour, index) => {
    if (!hexColour.test(colour)) {
      findings.push(
        issue(
          "error",
          "invalid-profile",
          `palette.keyColours[${index}]`,
          `Palette anchor '${colour}' is not a six-digit hexadecimal colour.`,
          "Use canonical #RRGGBB palette anchors.",
        ),
      );
    }
  });
  for (const duplicate of duplicates(profile.palette.keyColours)) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "palette.keyColours",
        `Palette anchor '${duplicate}' is duplicated.`,
        "Keep each anchor unique so value and role decisions remain explicit.",
      ),
    );
  }
  if (profile.productionModes.length === 0 || profile.compositionModes.length === 0) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "productionModes",
        "A profile requires at least one production mode and one composition mode.",
        "Declare the allowed visual construction and scene-composition languages.",
      ),
    );
  }
  if (
    profile.interface.allowedInteractionModes.length === 0 ||
    !profile.interface.allowedInteractionModes.includes(profile.interface.primaryInteractionMode)
  ) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "interface.allowedInteractionModes",
        "The primary interaction mode must be present in the allowed mode set.",
        "Add the primary mode or choose a supported primary mode.",
      ),
    );
  }
  for (const duplicate of duplicates(profile.interface.allowedInteractionModes)) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "interface.allowedInteractionModes",
        `Interaction mode '${duplicate}' is duplicated.`,
        "Keep the compatibility set unique and deterministic.",
      ),
    );
  }
  if (
    !Number.isFinite(profile.interface.persistentChromePercent) ||
    profile.interface.persistentChromePercent < 0 ||
    profile.interface.persistentChromePercent > 45
  ) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "interface.persistentChromePercent",
        "Persistent interface chrome must occupy from 0 to 45 percent of the native canvas.",
        "Reserve enough gameplay space for the selected interface family.",
      ),
    );
  }
  const [minimumActorHeight, maximumActorHeight] = profile.actors.relativeHeightPercent;
  if (minimumActorHeight <= 0 || maximumActorHeight < minimumActorHeight || maximumActorHeight > 100) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "actors.relativeHeightPercent",
        "Actor height guidance must be an ordered positive percentage range.",
        "Set a useful native-size silhouette range for ordinary gameplay scenes.",
      ),
    );
  }
  const [minimumWalkFrames, maximumWalkFrames] = profile.animation.walkFrames;
  if (
    !Number.isSafeInteger(minimumWalkFrames) ||
    !Number.isSafeInteger(maximumWalkFrames) ||
    minimumWalkFrames <= 0 ||
    maximumWalkFrames < minimumWalkFrames
  ) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "animation.walkFrames",
        "Walk-frame guidance must be an ordered positive integer range.",
        "Choose an economical authored frame range for the profile.",
      ),
    );
  }
  if (profile.puzzleGrammars.length === 0) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "puzzleGrammars",
        "A profile requires at least one puzzle grammar.",
        "Declare how puzzles normally advance story, access or understanding.",
      ),
    );
  }
  for (const duplicate of duplicates(profile.puzzleGrammars)) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "puzzleGrammars",
        `Puzzle grammar '${duplicate}' is duplicated.`,
        "Keep the grammar set unique and ordered by production priority.",
      ),
    );
  }

  const splash = profile.splash;
  if (
    !Number.isSafeInteger(splash.totalTicks) ||
    splash.totalTicks <= 0 ||
    !Number.isSafeInteger(splash.skippableAfterTick) ||
    splash.skippableAfterTick < 0 ||
    splash.skippableAfterTick > splash.totalTicks
  ) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "splash",
        "Splash duration and skip boundary must form a valid deterministic timeline.",
        "Use positive safe-integer ticks and keep the skip boundary inside the timeline.",
      ),
    );
  }
  if (splash.beats.length < 3) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "splash.beats",
        "An original splash requires at least a hold, mark reveal and transition.",
        "Author a concise period-appropriate publisher sequence.",
      ),
    );
  }
  const beatIds = splash.beats.map((entry) => entry.id);
  for (const duplicate of duplicates(beatIds)) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "splash.beats",
        `Splash beat '${duplicate}' is duplicated.`,
        "Use stable unique beat IDs for editing, replay and skip validation.",
      ),
    );
  }
  let expectedStart = 0;
  splash.beats.forEach((entry, index) => {
    if (
      !Number.isSafeInteger(entry.startTick) ||
      !Number.isSafeInteger(entry.durationTicks) ||
      entry.startTick < 0 ||
      entry.durationTicks <= 0
    ) {
      findings.push(
        issue(
          "error",
          "invalid-profile",
          `splash.beats[${index}]`,
          "Splash beat timing must use non-negative starts and positive durations.",
          "Author each beat on the logical tick timeline.",
        ),
      );
    }
    if (entry.startTick !== expectedStart) {
      findings.push(
        issue(
          "error",
          "invalid-profile",
          `splash.beats[${index}].startTick`,
          `Splash beat '${entry.id}' starts at ${entry.startTick}; expected contiguous tick ${expectedStart}.`,
          "Keep the publisher sequence ordered and gap-free so skip and completion are deterministic.",
        ),
      );
    }
    expectedStart = entry.startTick + entry.durationTicks;
  });
  if (expectedStart !== splash.totalTicks) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "splash.totalTicks",
        `Splash timeline ends at ${expectedStart}, not declared tick ${splash.totalTicks}.`,
        "Derive totalTicks from the final authored beat.",
      ),
    );
  }

  if (profile.showcase.title.trim().length === 0) {
    findings.push(
      issue(
        "error",
        "invalid-profile",
        "showcase.title",
        "An original showcase requires a title.",
        "Name the original vertical slice without reusing a commercial property.",
      ),
    );
  }
  validateStringList(profile.showcase.sceneBriefs, "showcase.sceneBriefs", 3, findings);
  validateStringList(profile.showcase.featuredSystems, "showcase.featuredSystems", 4, findings);
  validateStringList(profile.authenticityRules, "authenticityRules", 3, findings);
  validateStringList(profile.prohibitedShortcuts, "prohibitedShortcuts", 3, findings);
  validateStringList(profile.reviewQuestions, "reviewQuestions", 3, findings);

  return [...findings].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.path.localeCompare(right.path) ||
      left.message.localeCompare(right.message),
  );
};
