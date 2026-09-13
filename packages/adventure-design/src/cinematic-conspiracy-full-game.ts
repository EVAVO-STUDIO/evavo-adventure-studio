import {
  currentAdventureCapabilityCoverage,
  type AdventureCapabilityCoverage,
  type AdventureCapabilityId,
} from "./full-game-capabilities.js";
import type { AdventureProductionProfileId } from "./production-profile-types.js";

export type CinematicConspiracyReferenceId = "broken-sword-templar-style";

export interface CinematicConspiracyFullGameProfile {
  readonly id: CinematicConspiracyReferenceId;
  readonly label: string;
  readonly family: "cinematic-handdrawn-conspiracy";
  readonly productionProfileId: AdventureProductionProfileId;
  readonly originalProofId: "the-ninth-reliquary";
  readonly summary: string;
  readonly required: readonly AdventureCapabilityId[];
  readonly signature: readonly AdventureCapabilityId[];
  readonly stressScenes: readonly string[];
  readonly productionRules: readonly string[];
}

export interface CinematicConspiracyReadiness {
  readonly referenceId: CinematicConspiracyReferenceId;
  readonly label: string;
  readonly requiredCount: number;
  readonly proofedCount: number;
  readonly implementedCount: number;
  readonly partialCount: number;
  readonly missingCount: number;
  readonly ready: boolean;
  readonly gaps: readonly AdventureCapabilityCoverage[];
  readonly stressScenes: readonly string[];
  readonly productionRules: readonly string[];
}

export const cinematicConspiracyFullGameProfile: CinematicConspiracyFullGameProfile = {
  id: "broken-sword-templar-style",
  label: "Broken Sword / Templar-style cinematic conspiracy",
  family: "cinematic-handdrawn-conspiracy",
  productionProfileId: "cinematic-handdrawn-conspiracy",
  originalProofId: "the-ninth-reliquary",
  summary:
    "Original globe-spanning hand-drawn conspiracy adventure pressure: restrained context interaction, investigation topics, autonomous NPC presence, travel, close-up dialogue, deterministic cutaways and model-sheet/X-sheet governed cel production.",
  required: [
    "deterministic-fixed-tick",
    "point-click-context",
    "context-cursor-interface",
    "context-sensitive-default-verbs",
    "inventory-items",
    "inventory-on-room",
    "stateful-props",
    "forgiving-click-regions",
    "approach-slots",
    "perspective-scaling",
    "foreground-occlusion",
    "scrolling-room",
    "panoramic-exterior",
    "topic-dialogue",
    "dialogue-fact-unlocks",
    "research-investigation-loop",
    "room-local-scripting",
    "room-cutaways",
    "closeup-inset",
    "travel-map",
    "npc-schedules",
    "chapter-day-progression",
    "sequence-cutscene-timeline",
    "camera-shots",
    "layer-visibility-cues",
    "audio-cues-buses",
    "save-restore",
    "replay-determinism",
    "production-family-profile",
    "production-evidence",
    "ui-layout-grammar",
    "release-readiness-gates",
  ],
  signature: [
    "point-click-context",
    "topic-dialogue",
    "research-investigation-loop",
    "npc-schedules",
    "travel-map",
    "room-cutaways",
    "closeup-inset",
    "production-family-profile",
    "production-evidence",
  ],
  stressScenes: [
    "Original metropolitan incident scene with moving bystanders, foreground depth and context-sensitive investigation targets.",
    "Archive or museum research hub where topics/facts unlock new locations and NPC conversations rather than only toggling generic flags.",
    "Globe/travel-map transition that changes the active location set while preserving investigation and inventory state.",
    "Street or institutional location with at least two autonomous NPC schedules that move or become unavailable as world state changes.",
    "Close-up conversation or inspection inset with hand-drawn performance that returns to the exact room state deterministically.",
    "Temporary chapel/monastery/conspiracy cutaway driven by the normal Sequence runtime and returning to the precise previous location.",
    "Foreground-heavy interior where cel characters pass behind transparent architectural plates without matte/halo contamination.",
    "Modern hand-drawn walk + inspect/action sequence reviewed from model sheet and X-sheet with exact frame IDs, anchors, exposures and neighbour-frame continuity.",
  ],
  productionRules: [
    "Use The Ninth Reliquary as the original proof; never copy proprietary Broken Sword characters, locations, dialogue, puzzles or Templar plot beats.",
    "Hand-painted environments and transparent character/foreground cels remain separate production layers.",
    "Anime-adjacent influence may inform silhouette economy, expressions and staging, but must not imitate a named studio or collapse into generic anime shorthand.",
    "Art Studio and Cel Animation Studio work must use Adventure Creative Production v3 with authoritative style/layout/model-sheet/X-sheet digests.",
    "Transparent deliverables require decoded alpha evidence; checkerboard pixels, baked mattes, halos and contaminated hidden RGB are blocking defects.",
    "Animation frames are an authored sequence. Independent frame regeneration is forbidden; targeted repair must preserve approved neighbours and anchors.",
    "NPC autonomy must be deterministic and inspectable rather than simulated by random movement that can break puzzle reachability.",
  ],
};

const coverageById = new Map(
  currentAdventureCapabilityCoverage.map((entry) => [entry.id, entry] as const),
);

export const evaluateCinematicConspiracyFullGame = (): CinematicConspiracyReadiness => {
  const required = cinematicConspiracyFullGameProfile.required.map(
    (id): AdventureCapabilityCoverage =>
      coverageById.get(id) ?? {
        id,
        status: "missing",
        evidence: "Capability has no coverage record.",
      },
  );
  const count = (status: AdventureCapabilityCoverage["status"]): number =>
    required.filter((entry) => entry.status === status).length;
  const gaps = required.filter((entry) => entry.status !== "proofed");
  return {
    referenceId: cinematicConspiracyFullGameProfile.id,
    label: cinematicConspiracyFullGameProfile.label,
    requiredCount: required.length,
    proofedCount: count("proofed"),
    implementedCount: count("implemented"),
    partialCount: count("partial"),
    missingCount: count("missing"),
    ready: gaps.length === 0,
    gaps,
    stressScenes: cinematicConspiracyFullGameProfile.stressScenes,
    productionRules: cinematicConspiracyFullGameProfile.productionRules,
  };
};

export const validateCinematicConspiracyFullGameProfile = (): readonly string[] => {
  const issues: string[] = [];
  const profile = cinematicConspiracyFullGameProfile;
  if (profile.productionProfileId !== "cinematic-handdrawn-conspiracy") {
    issues.push("Cinematic conspiracy full-game reference must use the cinematic-handdrawn-conspiracy production profile.");
  }
  if (profile.required.includes("native-vga-audit")) {
    issues.push("Modern cinematic conspiracy lane must not inherit the classic native-VGA audit requirement.");
  }
  for (const capability of profile.signature) {
    if (!profile.required.includes(capability)) {
      issues.push(`Signature capability '${capability}' must also be required.`);
    }
  }
  if (!profile.required.includes("npc-schedules")) {
    issues.push("Cinematic conspiracy lane must require deterministic NPC schedules/autonomy.");
  }
  if (!profile.required.includes("production-evidence")) {
    issues.push("Cinematic conspiracy lane must require governed creative production evidence.");
  }
  return issues;
};
