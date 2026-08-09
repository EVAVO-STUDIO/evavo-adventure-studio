import type { Id } from "@evavo/adventure-project-schema";
import { adventureProductionProfiles } from "./production-profile-presets.js";
import { createAdventureProductionProfileSeed } from "./production-profile-seed.js";
import type {
  AdventureProductionProfile,
  AdventureProductionProfileAuditInput,
  AdventureProductionProfileId,
  AdventureProductionProfileIssue,
  AdventureProductionProfileReport,
} from "./production-profile-types.js";
import { validateAdventureProductionProfile } from "./production-profile-validate.js";
import { issue, severityOrder } from "./production-profile-validation-shared.js";

const sortedIssues = (
  issues: readonly AdventureProductionProfileIssue[],
): readonly AdventureProductionProfileIssue[] =>
  [...issues].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code),
  );

export const auditAdventureProductionProfile = (
  profile: AdventureProductionProfile,
  input: AdventureProductionProfileAuditInput = {},
): AdventureProductionProfileReport => {
  const issues: AdventureProductionProfileIssue[] = [...validateAdventureProductionProfile(profile)];
  const { design, project } = input;
  if (design && project && design.projectId !== project.id) {
    issues.push(
      issue(
        "error",
        "project-identity-mismatch",
        "projectId",
        `Design project '${design.projectId}' does not match canonical project '${project.id}'.`,
        "Attach the production profile to documents from one canonical project.",
      ),
    );
  }
  if (design) {
    if (
      design.creativeDirection.nativeSize.width !== profile.nativeSize.width ||
      design.creativeDirection.nativeSize.height !== profile.nativeSize.height
    ) {
      issues.push(
        issue(
          "error",
          "native-size-mismatch",
          "creativeDirection.nativeSize",
          `Design native size ${design.creativeDirection.nativeSize.width} × ` +
            `${design.creativeDirection.nativeSize.height} does not match profile ` +
            `${profile.nativeSize.width} × ${profile.nativeSize.height}.`,
          "Recompose the project at the selected profile canvas rather than resampling late.",
        ),
      );
    }
    if (!profile.productionModes.includes(design.creativeDirection.productionMode)) {
      issues.push(
        issue(
          "error",
          "production-mode-mismatch",
          "creativeDirection.productionMode",
          `Production mode '${design.creativeDirection.productionMode}' is outside profile '${profile.id}'.`,
          `Use one of: ${profile.productionModes.join(", ")}.`,
        ),
      );
    }
    if (!profile.compositionModes.includes(design.creativeDirection.compositionMode)) {
      issues.push(
        issue(
          "error",
          "composition-mode-mismatch",
          "creativeDirection.compositionMode",
          `Composition mode '${design.creativeDirection.compositionMode}' is outside profile '${profile.id}'.`,
          `Use one of: ${profile.compositionModes.join(", ")}.`,
        ),
      );
    }
    if (design.creativeDirection.palette.maxColours > profile.palette.maxColours) {
      issues.push(
        issue(
          "error",
          "palette-budget-exceeded",
          "creativeDirection.palette.maxColours",
          `Design budget ${design.creativeDirection.palette.maxColours} exceeds profile limit ` +
            `${profile.palette.maxColours}.`,
          "Reduce and re-author the palette before asset lock; do not rely on final automatic quantisation.",
        ),
      );
    }
  }
  if (project) {
    const presentation = project.presentation;
    if (
      presentation.nativeWidth !== profile.nativeSize.width ||
      presentation.nativeHeight !== profile.nativeSize.height
    ) {
      issues.push(
        issue(
          "error",
          "native-size-mismatch",
          "presentation",
          `Project presentation ${presentation.nativeWidth} × ${presentation.nativeHeight} ` +
            `does not match profile ${profile.nativeSize.width} × ${profile.nativeSize.height}.`,
          "Keep project, design, UI, geometry and compiled output on one native canvas.",
        ),
      );
    }
    if (!profile.interface.allowedInteractionModes.includes(presentation.interactionMode)) {
      issues.push(
        issue(
          "error",
          "interaction-mode-mismatch",
          "presentation.interactionMode",
          `Interaction mode '${presentation.interactionMode}' is outside profile '${profile.id}'.`,
          `Use one of: ${profile.interface.allowedInteractionModes.join(", ")}.`,
        ),
      );
    }
    if (!presentation.integerScale) {
      issues.push(
        issue(
          "error",
          "integer-scaling-disabled",
          "presentation.integerScale",
          "Integer scaling is disabled for an authored low-resolution profile.",
          "Enable integer scaling and letterbox unsupported host sizes.",
        ),
      );
    }
    if (presentation.textureSampling !== "nearest") {
      issues.push(
        issue(
          "error",
          "linear-sampling",
          "presentation.textureSampling",
          "Linear sampling would blur the authored native pixel structure.",
          "Use nearest-neighbour sampling from the native render target through presentation.",
        ),
      );
    }
    if (presentation.pixelMotionPolicy !== profile.pixelMotionPolicy) {
      issues.push(
        issue(
          presentation.pixelMotionPolicy === "free" ? "error" : "warning",
          "pixel-motion-mismatch",
          "presentation.pixelMotionPolicy",
          `Project motion policy '${presentation.pixelMotionPolicy}' differs from profile ` +
            `'${profile.pixelMotionPolicy}'.`,
          "Use the profile motion policy or document and test the deliberate exception at native scale.",
        ),
      );
    }
    if (presentation.showScore !== profile.interface.showScore) {
      issues.push(
        issue(
          "note",
          "score-policy-mismatch",
          "presentation.showScore",
          `Project score visibility is ${String(presentation.showScore)} while the profile default is ` +
            `${String(profile.interface.showScore)}.`,
          "Confirm that score visibility is a deliberate game identity decision.",
        ),
      );
    }
  }

  const ordered = sortedIssues(issues);
  const errors = ordered.filter((entry) => entry.severity === "error").length;
  const warnings = ordered.filter((entry) => entry.severity === "warning").length;
  const notes = ordered.filter((entry) => entry.severity === "note").length;
  const score = Math.max(0, 100 - errors * 20 - warnings * 7 - notes * 2);
  const status = errors > 0 ? "blocked" : warnings > 0 ? "attention" : "ready";
  const projectId: Id<"project"> | null = project?.id ?? design?.projectId ?? null;

  return {
    reportVersion: 1,
    profileId: profile.id,
    projectId,
    status,
    score,
    issues: ordered,
    seed: createAdventureProductionProfileSeed(profile),
  };
};

const profilesById = new Map(adventureProductionProfiles.map((profile) => [profile.id, profile] as const));

export const adventureProductionProfileById = (
  profileId: AdventureProductionProfileId,
): AdventureProductionProfile => {
  const profile = profilesById.get(profileId);
  if (!profile) {
    throw new Error(`Unknown adventure production profile '${profileId}'.`);
  }
  return profile;
};

export const adventureProductionProfileIds = (): readonly AdventureProductionProfileId[] =>
  adventureProductionProfiles.map((profile) => profile.id);
