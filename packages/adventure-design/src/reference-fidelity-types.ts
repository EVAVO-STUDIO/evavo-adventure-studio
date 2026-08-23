import type { AdventureProductionProfileId } from "./production-profile-types.js";

export type AdventureReferenceTitleId =
  | "kings-quest-v"
  | "quest-for-glory-iv"
  | "gabriel-knight-sins-of-the-fathers"
  | "police-quest-i-vga-remake"
  | "police-quest-iv"
  | "indiana-jones-fate-of-atlantis"
  | "heart-of-china"
  | "rise-of-the-dragon";

export type AdventureReferenceEngineDialectId =
  | "sierra-sci1-vga"
  | "sierra-sci32-vga"
  | "lucasarts-scumm5-vga"
  | "dynamix-dgds-vga";

export type AdventureReferencePlatform = "dos";
export type AdventureReferenceMedia = "floppy" | "cd" | "digital";
export type AdventureReferenceLanguage = "en";

export type AdventureReferenceCapabilityCategory =
  | "presentation"
  | "input"
  | "world"
  | "narrative"
  | "system"
  | "audio"
  | "rpg"
  | "investigation"
  | "procedure"
  | "routing"
  | "cinematic"
  | "action"
  | "time";

export type AdventureReferenceEvidenceKind =
  | "contract"
  | "unit-test"
  | "integration-test"
  | "deterministic-replay"
  | "reference-trace"
  | "screenshot"
  | "video"
  | "audio-capture"
  | "manual-review";

export type AdventureReferenceCapabilityId =
  | "native-320x200"
  | "indexed-256-colour"
  | "dos-pixel-aspect"
  | "integer-scaling"
  | "nearest-neighbour-sampling"
  | "binary-sprite-alpha"
  | "bitmap-typography"
  | "fixed-logical-ticks"
  | "walk-areas"
  | "depth-scaling"
  | "foreground-occlusion"
  | "scene-transitions"
  | "semantic-cursors"
  | "inventory-state"
  | "dialogue-state"
  | "save-slot-ui"
  | "exact-save-restore"
  | "deterministic-replay"
  | "terminal-outcome"
  | "audio-channel-structure"
  | "variant-specific-presentation"
  | "original-proof-content"
  | "temporary-icon-bar"
  | "narration-feedback"
  | "score-counter"
  | "death-restart-flow"
  | "storybook-room-state"
  | "rpg-attributes"
  | "skill-checks"
  | "class-specific-solutions"
  | "health-stamina-mana"
  | "equipment-economy"
  | "day-night-schedule"
  | "combat-system"
  | "character-import-export"
  | "encounter-travel"
  | "chapter-day-progression"
  | "topic-dialogue"
  | "evidence-research"
  | "portrait-conversation"
  | "close-up-investigation"
  | "investigation-gating"
  | "procedure-checks"
  | "evidence-chain"
  | "case-state"
  | "interrogation-flow"
  | "procedural-failure"
  | "location-progression"
  | "persistent-verb-panel"
  | "sentence-construction"
  | "multi-route-structure"
  | "companion-state"
  | "travel-map"
  | "alternative-puzzle-solutions"
  | "dialogue-tree"
  | "action-fight-system"
  | "route-dependent-world-state"
  | "full-screen-cinematic-panels"
  | "protagonist-switching"
  | "relationship-state"
  | "route-time-costs"
  | "editorial-travel-montage"
  | "knowledge-separation"
  | "action-sequence-windows"
  | "action-telegraph-timing"
  | "safe-action-retry"
  | "visible-game-clock"
  | "scheduled-contact-windows"
  | "time-costed-actions"
  | "deadline-outcomes";

export interface AdventureReferenceEngineDialect {
  readonly dialectVersion: 1;
  readonly id: AdventureReferenceEngineDialectId;
  readonly label: string;
  readonly summary: string;
  readonly nativeSize: { readonly width: 320; readonly height: 200 };
  readonly paletteMode: "indexed-8-bit";
  readonly logicalTicksPerSecond: 60;
  readonly baselineCapabilityIds: readonly AdventureReferenceCapabilityId[];
  readonly notes: readonly string[];
}

export interface AdventureReferenceEvidenceRequirement {
  readonly acceptedKinds: readonly AdventureReferenceEvidenceKind[];
  readonly minimumItems: number;
  readonly note: string;
}

export interface AdventureReferenceCapabilityRequirement {
  readonly id: AdventureReferenceCapabilityId;
  readonly label: string;
  readonly category: AdventureReferenceCapabilityCategory;
  readonly critical: boolean;
  readonly description: string;
  readonly evidence: AdventureReferenceEvidenceRequirement;
}

export interface AdventureReferenceVariant {
  readonly id: string;
  readonly titleId: AdventureReferenceTitleId;
  readonly engineDialectId: AdventureReferenceEngineDialectId;
  readonly platform: AdventureReferencePlatform;
  readonly media: AdventureReferenceMedia;
  readonly language: AdventureReferenceLanguage;
  readonly label: string;
  readonly notes: readonly string[];
}

export interface AdventureReferenceScenario {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly requiredCapabilityIds: readonly AdventureReferenceCapabilityId[];
  readonly steps: readonly string[];
  readonly expectedOutcome: string;
}

export interface AdventureReferenceOriginalProof {
  readonly showcaseId: string;
  readonly title: string;
  readonly profileId: AdventureProductionProfileId;
  readonly status: "available" | "planned";
  readonly originalAssetsOnly: true;
  readonly featuredSystems: readonly string[];
  readonly note: string;
}

export interface AdventureReferenceRedistributionBoundary {
  readonly permitted: readonly string[];
  readonly prohibited: readonly string[];
}

export interface AdventureReferenceTitlePack {
  readonly packVersion: 1;
  readonly id: string;
  readonly titleId: AdventureReferenceTitleId;
  readonly referenceTitle: string;
  readonly label: string;
  readonly summary: string;
  readonly engineDialectId: AdventureReferenceEngineDialectId;
  readonly profileId: AdventureProductionProfileId;
  readonly variants: readonly AdventureReferenceVariant[];
  readonly capabilities: readonly AdventureReferenceCapabilityRequirement[];
  readonly scenarios: readonly AdventureReferenceScenario[];
  readonly originalProof: AdventureReferenceOriginalProof;
  readonly redistributionBoundary: AdventureReferenceRedistributionBoundary;
}

export type AdventureReferencePackIssueSeverity = "error" | "warning";

export type AdventureReferencePackIssueCode =
  | "unknown-engine-dialect"
  | "invalid-profile-binding"
  | "duplicate-id"
  | "invalid-variant"
  | "missing-baseline-capability"
  | "invalid-capability"
  | "invalid-evidence-requirement"
  | "invalid-scenario"
  | "unknown-scenario-capability"
  | "insufficient-scenarios"
  | "invalid-original-proof"
  | "incomplete-redistribution-boundary";

export interface AdventureReferencePackIssue {
  readonly severity: AdventureReferencePackIssueSeverity;
  readonly code: AdventureReferencePackIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface AdventureReferenceCapabilityEvidence {
  readonly capabilityId: AdventureReferenceCapabilityId;
  readonly kind: AdventureReferenceEvidenceKind;
  readonly reference: string;
}

export interface AdventureReferenceAuditInput {
  readonly variantId: string;
  readonly implementedCapabilityIds: readonly AdventureReferenceCapabilityId[];
  readonly evidence: readonly AdventureReferenceCapabilityEvidence[];
  readonly observedProfileId: AdventureProductionProfileId;
  readonly observedProofShowcaseId: string;
}

export type AdventureReferenceAuditIssueCode =
  | "invalid-pack"
  | "unknown-variant"
  | "duplicate-implemented-capability"
  | "unknown-implemented-capability"
  | "unknown-evidence-capability"
  | "unsupported-evidence-kind"
  | "duplicate-evidence"
  | "profile-mismatch"
  | "proof-showcase-mismatch"
  | "missing-critical-capability"
  | "missing-capability"
  | "missing-critical-evidence"
  | "missing-evidence";

export interface AdventureReferenceAuditIssue {
  readonly severity: "error" | "warning";
  readonly code: AdventureReferenceAuditIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface AdventureReferenceAuditReport {
  readonly reportVersion: 1;
  readonly packId: string;
  readonly titleId: AdventureReferenceTitleId;
  readonly variantId: string;
  readonly status: "ready" | "attention" | "blocked";
  readonly score: number;
  readonly metrics: {
    readonly requiredCapabilities: number;
    readonly implementedCapabilities: number;
    readonly criticalCapabilities: number;
    readonly evidencedCapabilities: number;
    readonly evidenceItems: number;
  };
  readonly issues: readonly AdventureReferenceAuditIssue[];
}
