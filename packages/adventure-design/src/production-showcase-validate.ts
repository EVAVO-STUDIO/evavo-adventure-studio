import { adventureProductionProfileById, adventureProductionProfiles } from "./production-profiles.js";
import type {
  AdventureProductionShowcase,
  AdventureProductionShowcaseIssue,
} from "./production-showcase-types.js";

const requiredPlateKinds = ["title", "gameplay", "dialogue", "system"] as const;

const issue = (issues: AdventureProductionShowcaseIssue[], input: AdventureProductionShowcaseIssue): void => {
  issues.push(input);
};

const registerId = (
  ids: Map<string, string>,
  issues: AdventureProductionShowcaseIssue[],
  id: string,
  path: string,
): void => {
  const existing = ids.get(id);
  if (existing) {
    issue(issues, {
      severity: "error",
      code: "duplicate-id",
      path,
      message: `ID '${id}' is already declared at '${existing}'.`,
    });
    return;
  }
  ids.set(id, path);
};

const pointInside = (
  point: { readonly x: number; readonly y: number },
  width: number,
  height: number,
): boolean =>
  Number.isFinite(point.x) &&
  Number.isFinite(point.y) &&
  point.x >= 0 &&
  point.y >= 0 &&
  point.x <= width &&
  point.y <= height;

export const validateAdventureProductionShowcase = (
  showcase: AdventureProductionShowcase,
): readonly AdventureProductionShowcaseIssue[] => {
  const issues: AdventureProductionShowcaseIssue[] = [];
  const ids = new Map<string, string>();
  const profile = adventureProductionProfiles.find((candidate) => candidate.id === showcase.profileId);
  registerId(ids, issues, showcase.id, "id");

  if (!profile) {
    issue(issues, {
      severity: "error",
      code: "unknown-profile",
      path: "profileId",
      message: `Production profile '${showcase.profileId}' does not exist.`,
    });
    return issues;
  }

  if (profile.showcase.title !== showcase.title) {
    issue(issues, {
      severity: "error",
      code: "profile-showcase-mismatch",
      path: "title",
      message:
        `Showcase title '${showcase.title}' does not match profile brief ` + `'${profile.showcase.title}'.`,
    });
  }

  const plateIds = new Set<string>();
  showcase.plates.forEach((plate, plateIndex) => {
    const platePath = `plates[${plateIndex}]`;
    registerId(ids, issues, plate.id, `${platePath}.id`);
    plateIds.add(plate.id);

    if (!pointInside(plate.focalPoint, profile.nativeSize.width, profile.nativeSize.height)) {
      issue(issues, {
        severity: "error",
        code: "invalid-focal-point",
        path: `${platePath}.focalPoint`,
        message: `Plate '${plate.id}' focal point is outside the native canvas.`,
      });
    }
    if (
      !Number.isFinite(plate.horizonY) ||
      plate.horizonY < 0 ||
      plate.horizonY > profile.nativeSize.height
    ) {
      issue(issues, {
        severity: "error",
        code: "invalid-horizon",
        path: `${platePath}.horizonY`,
        message: `Plate '${plate.id}' horizon is outside the native canvas.`,
      });
    }

    plate.actors.forEach((actor, actorIndex) => {
      const actorPath = `${platePath}.actors[${actorIndex}]`;
      registerId(ids, issues, actor.id, `${actorPath}.id`);
      if (!pointInside(actor.position, profile.nativeSize.width, profile.nativeSize.height)) {
        issue(issues, {
          severity: "error",
          code: "invalid-actor-position",
          path: `${actorPath}.position`,
          message: `Actor beat '${actor.id}' is outside the native canvas.`,
        });
      }
      if (!Number.isFinite(actor.height) || actor.height <= 0 || actor.height > profile.nativeSize.height) {
        issue(issues, {
          severity: "error",
          code: "invalid-actor-height",
          path: `${actorPath}.height`,
          message: `Actor beat '${actor.id}' has an invalid native height.`,
        });
      }
    });

    if (plate.kind === "gameplay" && !plate.actors.some((actor) => actor.role === "player")) {
      issue(issues, {
        severity: "error",
        code: "missing-player-actor",
        path: `${platePath}.actors`,
        message: `Gameplay plate '${plate.id}' has no player actor beat.`,
      });
    }

    plate.props.forEach((prop, propIndex) => {
      const propPath = `${platePath}.props[${propIndex}]`;
      registerId(ids, issues, prop.id, `${propPath}.id`);
      const lowerRight = {
        x: prop.position.x + prop.size.width,
        y: prop.position.y + prop.size.height,
      };
      if (
        !Number.isFinite(prop.size.width) ||
        !Number.isFinite(prop.size.height) ||
        prop.size.width <= 0 ||
        prop.size.height <= 0 ||
        !pointInside(prop.position, profile.nativeSize.width, profile.nativeSize.height) ||
        !pointInside(lowerRight, profile.nativeSize.width, profile.nativeSize.height)
      ) {
        issue(issues, {
          severity: "error",
          code: "invalid-prop-geometry",
          path: propPath,
          message: `Prop beat '${prop.id}' is outside the native canvas or has no usable size.`,
        });
      }
    });

    if (plate.visualProofs.length < 3) {
      issue(issues, {
        severity: "warning",
        code: "insufficient-visual-proof",
        path: `${platePath}.visualProofs`,
        message: `Plate '${plate.id}' should document at least three native visual proofs.`,
      });
    }
  });

  for (const kind of requiredPlateKinds) {
    if (!showcase.plates.some((plate) => plate.kind === kind)) {
      issue(issues, {
        severity: "error",
        code: "missing-plate-kind",
        path: "plates",
        message: `Showcase '${showcase.id}' is missing a '${kind}' plate.`,
      });
    }
  }

  showcase.puzzleBeats.forEach((beat, beatIndex) => {
    const beatPath = `puzzleBeats[${beatIndex}]`;
    registerId(ids, issues, beat.id, `${beatPath}.id`);
    if (!plateIds.has(beat.setupPlateId)) {
      issue(issues, {
        severity: "error",
        code: "unknown-puzzle-plate",
        path: `${beatPath}.setupPlateId`,
        message: `Puzzle beat '${beat.id}' references missing plate '${beat.setupPlateId}'.`,
      });
    }
    if (!profile.puzzleGrammars.includes(beat.grammar)) {
      issue(issues, {
        severity: "error",
        code: "unsupported-puzzle-grammar",
        path: `${beatPath}.grammar`,
        message: `Puzzle grammar '${beat.grammar}' is not enabled by profile ` + `'${profile.id}'.`,
      });
    }
  });

  if (showcase.originalAssetsOnly !== true || showcase.originalityStatement.trim().length < 32) {
    issue(issues, {
      severity: "error",
      code: "missing-originality-boundary",
      path: "originalityStatement",
      message: `Showcase '${showcase.id}' must state an explicit original-content boundary.`,
    });
  }

  return issues.sort(
    (left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
};

export const adventureProductionShowcaseByProfileId = (
  profileId: AdventureProductionShowcase["profileId"],
  showcases: readonly AdventureProductionShowcase[],
): AdventureProductionShowcase => {
  adventureProductionProfileById(profileId);
  const showcase = showcases.find((candidate) => candidate.profileId === profileId);
  if (!showcase) {
    throw new Error(`No production showcase exists for profile '${profileId}'.`);
  }
  return showcase;
};
