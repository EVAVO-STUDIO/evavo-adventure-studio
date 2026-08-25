export type ReferenceProofDevelopmentStage =
  | "production-contract"
  | "gameplay-kernel"
  | "semantic-runtime-source"
  | "packaged-playable"
  | "final-media"
  | "retained-evidence";

export type ReferenceProofStageStatus = "ready" | "partial" | "blocked";

export interface ReferenceProofDevelopmentStageStatus {
  readonly stage: ReferenceProofDevelopmentStage;
  readonly status: ReferenceProofStageStatus;
  readonly note: string;
}

export interface ReferenceProofDevelopmentStatus {
  readonly laneId: string;
  readonly stages: readonly ReferenceProofDevelopmentStageStatus[];
}

const stage = (
  name: ReferenceProofDevelopmentStage,
  status: ReferenceProofStageStatus,
  note: string,
): ReferenceProofDevelopmentStageStatus => ({ stage: name, status, note });

export const referenceProofDevelopmentStatuses: readonly ReferenceProofDevelopmentStatus[] = [
  {
    laneId: "late-sierra-procedural",
    stages: [
      stage("production-contract", "ready", "Open Case has a four-plate production showcase, late-Sierra procedural profile and first-class PQ4 fidelity pack."),
      stage("gameplay-kernel", "ready", "Protected entry, evidence handling, recoverable procedure, interrogation and location progression execute through the Open Case deterministic gameplay proof."),
      stage("semantic-runtime-source", "partial", "Open Case now has a first-class investigation graph for evidence provenance, lab research, hidden witness topic and case progression; full project/interaction bindings are still being assembled."),
      stage("packaged-playable", "blocked", "No packaged Open Case Runtime Bundle/replay has yet demonstrated the complete procedural chain through the feature-session player."),
      stage("final-media", "blocked", "Final native room art, actor animation, evidence props, UI/audio and indexed runtime media are not yet approved."),
      stage("retained-evidence", "blocked", "Required native screenshots plus success/failure/save-restore replays are not yet retained."),
    ],
  },
  {
    laneId: "sierra-social-comedy-vga",
    stages: [
      stage("production-contract", "ready", "After Hours has a full social-comedy showcase, SCI1 VGA production profile and LSL VGA fidelity pack."),
      stage("gameplay-kernel", "ready", "Recoverable introductions, alternative lounge solutions, contextual disguise use, social memory and two final access routes execute deterministically."),
      stage("semantic-runtime-source", "partial", "The gameplay state is authored, but its dialogue/room-script/lifecycle bindings have not yet been assembled into a complete packaged source set."),
      stage("packaged-playable", "blocked", "No packaged After Hours replay yet proves the social puzzle, timing, score and embarrassment/retry loop end to end."),
      stage("final-media", "blocked", "Final native hotel/restaurant/corridor art, character animation, UI/audio and indexed media are not yet approved."),
      stage("retained-evidence", "blocked", "Native screenshots and success/failure/save-restore proof replays remain outstanding."),
    ],
  },
  {
    laneId: "modern-retro-noir",
    stages: [
      stage("production-contract", "ready", "Cold Meridian has a dedicated 64-colour neo-noir profile and four-plate original production showcase."),
      stage("gameplay-kernel", "ready", "Separate protagonist knowledge, explicit exchange, signal deduction, recoverable wrong inference, hard cutaway and bounded action retry execute deterministically."),
      stage("semantic-runtime-source", "partial", "The required generic multi-protagonist, investigation, room-script and specialized-mode systems already exist; Cold Meridian-specific authored bundle bindings still need assembly."),
      stage("packaged-playable", "blocked", "No packaged Cold Meridian run yet combines those feature-session layers with final scene data."),
      stage("final-media", "blocked", "Final sparse low-resolution city/character/interface/audio production media are not yet approved."),
      stage("retained-evidence", "blocked", "Required native screenshots and combined success/failure/save-restore replays are not yet retained."),
    ],
  },
] as const;

export const referenceProofDevelopmentStatusByLaneId = (
  laneId: string,
): ReferenceProofDevelopmentStatus | null =>
  referenceProofDevelopmentStatuses.find((entry) => entry.laneId === laneId) ?? null;

export const validateReferenceProofDevelopmentStatuses = (
  laneIds: readonly string[],
): readonly string[] => {
  const issues: string[] = [];
  const expected = new Set(laneIds);
  const seen = new Set<string>();
  const stageOrder: readonly ReferenceProofDevelopmentStage[] = [
    "production-contract",
    "gameplay-kernel",
    "semantic-runtime-source",
    "packaged-playable",
    "final-media",
    "retained-evidence",
  ];
  for (const entry of referenceProofDevelopmentStatuses) {
    if (!expected.has(entry.laneId)) issues.push(`Development status '${entry.laneId}' has no reference proof lane.`);
    if (seen.has(entry.laneId)) issues.push(`Development status '${entry.laneId}' is duplicated.`);
    seen.add(entry.laneId);
    if (entry.stages.length !== stageOrder.length) {
      issues.push(`Development status '${entry.laneId}' must declare all ${stageOrder.length} stages.`);
      continue;
    }
    stageOrder.forEach((expectedStage, index) => {
      if (entry.stages[index]?.stage !== expectedStage) {
        issues.push(`Development status '${entry.laneId}' stage ${index} must be '${expectedStage}'.`);
      }
    });
  }
  for (const laneId of expected) {
    if (!seen.has(laneId)) issues.push(`Reference proof lane '${laneId}' has no development status.`);
  }
  return issues.sort((left, right) => left.localeCompare(right));
};
