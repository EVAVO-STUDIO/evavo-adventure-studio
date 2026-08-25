import { designRepairProfileForShowcase } from "./classic-design-repair.js";

export type AdventureReferenceProofKind = "historical-fidelity" | "modern-retro-benchmark";

export interface AdventureReferenceProofLane {
  readonly id: string;
  readonly label: string;
  readonly kind: AdventureReferenceProofKind;
  readonly referencePressure: string;
  readonly profileId: string;
  readonly showcaseId: string;
  readonly fidelityPackId: string | null;
  readonly targetEra: string;
  readonly authenticMustKeep: readonly string[];
  readonly qualityRepairs: readonly string[];
  readonly proofScenes: readonly string[];
  readonly completionRule: string;
}

const repairIds = (showcaseId: string): readonly string[] =>
  designRepairProfileForShowcase(showcaseId)?.requiredRuleIds ?? [];

export const adventureReferenceProofLanes: readonly AdventureReferenceProofLane[] = [
  {
    id: "late-sierra-procedural",
    label: "Late Sierra Procedural Investigation",
    kind: "historical-fidelity",
    referencePressure: "Police Quest IV",
    profileId: "procedural-investigation-vga",
    showcaseId: "open-case",
    fidelityPackId: "reference.pq4.dos-vga",
    targetEra: "1993–1994 SCI32 VGA",
    authenticMustKeep: [
      "grounded contemporary urban and institutional spaces",
      "icon-led Sierra interaction rather than a modern HUD",
      "evidence custody, procedural order and interrogation state",
      "restrained portrait/in-scene dialogue",
      "case-file/caseboard presentation rather than quest objectives",
      "consequential procedure and score/failure state",
    ],
    qualityRepairs: repairIds("open-case"),
    proofScenes: [
      "protected crime-scene entry with observation, photography, collection and custody",
      "controlled witness interview whose questions depend on lawful evidence and prior testimony",
      "caseboard/custody review that opens and retires locations without orphaning evidence",
      "procedural failure followed by bounded recovery that preserves unrelated case progress",
    ],
    completionRule:
      "Open Case counts as a PQ4-scale proof only when evidence, procedure, interrogation, case-state progression and recoverable failure are exercised in a packaged replay, not merely shown in production plates.",
  },
  {
    id: "sierra-social-comedy-vga",
    label: "Sierra Social Comedy VGA",
    kind: "historical-fidelity",
    referencePressure: "Leisure Suit Larry VGA-era social comedy",
    profileId: "social-comedy-icon-vga",
    showcaseId: "after-hours",
    fidelityPackId: "reference.lsl-vga.dos",
    targetEra: "1991–1993 SCI1 VGA",
    authenticMustKeep: [
      "temporary SCI1 icon interaction and visible score",
      "bright but grounded social venues rather than neon parody",
      "inventory and conversation working together as social puzzles",
      "authored awkward pauses, reaction holds and concise narration",
      "NPC memory and venue access consequences without relationship meters",
      "comic failure/rejection as part of the fiction",
    ],
    qualityRepairs: repairIds("after-hours"),
    proofScenes: [
      "hotel lounge with at least two recoverable approaches to a guarded social route",
      "restaurant dialogue/inventory puzzle where disguise or evidence changes the conversation",
      "late-night corridor where prior impressions and inventory state support multiple final access solutions",
      "timed comic beat whose reading window and challenge window remain fair at native scale",
    ],
    completionRule:
      "After Hours counts as an LSL-style full proof only when social state, score, icon interaction, inventory dialogue, timed comedy and embarrassment/recovery survive save/replay without a modern relationship or objective UI.",
  },
  {
    id: "modern-retro-noir",
    label: "Modern-Retro Low-Resolution Noir",
    kind: "modern-retro-benchmark",
    referencePressure: "Gemini Rue-era low-resolution cinematic noir adventure design",
    profileId: "neo-noir-lowres",
    showcaseId: "cold-meridian",
    fidelityPackId: null,
    targetEra: "modern design using deliberate low-resolution adventure grammar",
    authenticMustKeep: [
      "authored low-resolution pixel composition rather than a post-process retro filter",
      "sparse noir framing, negative space and restrained accent colour",
      "minimal context interaction and compact captions",
      "separate protagonist knowledge and communicator/research state",
      "hard editorial cuts and occasional bounded action inserts",
      "atmosphere carried by room tone, rain, silence and composition rather than effects stacks",
    ],
    qualityRepairs: repairIds("cold-meridian"),
    proofScenes: [
      "rain exterior where tiny evidence and exits remain readable without hotspot glow",
      "witness/research sequence where the interface clarifies evidence without becoming a quest tracker",
      "two-protagonist investigation where knowledge remains separate until an authored exchange",
      "short action/failure insert with private retry checkpoint and no long no-save replay corridor",
    ],
    completionRule:
      "Cold Meridian counts as the modern-retro proof only when low-resolution atmosphere, multi-protagonist knowledge, clear interaction ergonomics and bounded action/retry coexist without bloom, scanline filters, quest markers or pixel-hunting dependence.",
  },
] as const;

export const referenceProofLaneById = (id: string): AdventureReferenceProofLane | null =>
  adventureReferenceProofLanes.find((lane) => lane.id === id) ?? null;

export const referenceProofLaneForShowcase = (showcaseId: string): AdventureReferenceProofLane | null =>
  adventureReferenceProofLanes.find((lane) => lane.showcaseId === showcaseId) ?? null;

export const validateAdventureReferenceProofLanes = (): readonly string[] => {
  const issues: string[] = [];
  const ids = new Set<string>();
  const showcases = new Set<string>();
  for (const lane of adventureReferenceProofLanes) {
    if (ids.has(lane.id)) issues.push(`Reference proof lane '${lane.id}' is duplicated.`);
    ids.add(lane.id);
    if (showcases.has(lane.showcaseId)) {
      issues.push(`Showcase '${lane.showcaseId}' is assigned to multiple reference proof lanes.`);
    }
    showcases.add(lane.showcaseId);
    if (lane.kind === "historical-fidelity" && !lane.fidelityPackId) {
      issues.push(`Historical proof lane '${lane.id}' must name a fidelity pack.`);
    }
    if (lane.kind === "modern-retro-benchmark" && lane.fidelityPackId) {
      issues.push(`Modern-retro proof lane '${lane.id}' must not masquerade as a historical fidelity pack.`);
    }
    if (lane.qualityRepairs.length === 0) {
      issues.push(`Reference proof lane '${lane.id}' must declare at least one deliberate design repair.`);
    }
    if (lane.proofScenes.length < 3) {
      issues.push(`Reference proof lane '${lane.id}' needs at least three distinct stress scenes.`);
    }
  }
  return issues.sort((left, right) => left.localeCompare(right));
};
