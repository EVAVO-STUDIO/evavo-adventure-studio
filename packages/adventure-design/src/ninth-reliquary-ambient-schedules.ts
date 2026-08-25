export interface NinthReliquaryAmbientSchedule {
  readonly id: string;
  readonly proofSceneId: string;
  readonly performer: string;
  readonly purpose: string;
  readonly startTick: number;
  readonly intervalTicks: number;
  readonly sequenceKey: string;
  readonly productionRules: readonly string[];
}

export const ninthReliquaryAmbientSchedules: readonly NinthReliquaryAmbientSchedule[] = [
  {
    id: "ambient.ninth-reliquary.old-city.pedestrian",
    proofSceneId: "reliquary.old-city-square",
    performer: "background pedestrian",
    purpose: "Occasional crossing confirms the square is inhabited without obscuring clue anchors or the player's route.",
    startTick: 120,
    intervalTicks: 720,
    sequenceKey: "ambient.old-city.pedestrian-cross",
    productionRules: [
      "One restrained crossing sequence per cycle; do not random-walk continuously.",
      "Never cross the café entrance or emblem clue during their primary interaction window.",
      "Use an approved cel sequence with exact contact anchors and stable model identity.",
    ],
  },
  {
    id: "ambient.ninth-reliquary.cafe.waiter",
    proofSceneId: "reliquary.cafe-dialogue",
    performer: "café waiter",
    purpose: "Sparse glass/cloth/table service gives the café lived-in rhythm while witness dialogue remains visually dominant.",
    startTick: 240,
    intervalTicks: 840,
    sequenceKey: "ambient.cafe.waiter-service",
    productionRules: [
      "Prefer held poses and one short service action over perpetual idle animation.",
      "Table/glass hand contact must match approved foreground/background registration.",
      "Sequence may run behind dialogue but must remain lower contrast than speaking faces.",
    ],
  },
  {
    id: "ambient.ninth-reliquary.archive.clerk",
    proofSceneId: "reliquary.conservation-archive",
    performer: "archive clerk",
    purpose: "Shelf/document tasks communicate a working archive without becoming a quest-marker substitute.",
    startTick: 300,
    intervalTicks: 960,
    sequenceKey: "ambient.archive.clerk-shelf",
    productionRules: [
      "Reuse the approved archivist model and document-contact anchors.",
      "Do not move documents that are active evidence targets.",
      "Sequence timing must remain deterministic across save/replay.",
    ],
  },
  {
    id: "ambient.ninth-reliquary.train.passenger",
    proofSceneId: "reliquary.night-train",
    performer: "train passenger",
    purpose: "Rare posture/reading adjustment reinforces travel without turning the carriage into continuous background motion.",
    startTick: 180,
    intervalTicks: 660,
    sequenceKey: "ambient.train.passenger-adjust",
    productionRules: [
      "Seat contact stays fixed to approved carriage anchors.",
      "Avoid simultaneous high-motion passenger and window-loop beats.",
      "Use economical exposure timing and preserve face/costume construction across all drawings.",
    ],
  },
  {
    id: "ambient.ninth-reliquary.hospice.staff",
    proofSceneId: "reliquary.mountain-hospice",
    performer: "hospice staff",
    purpose: "Small reception/corridor tasks reinforce changing occupancy and investigation state in the hub.",
    startTick: 300,
    intervalTicks: 900,
    sequenceKey: "ambient.hospice.staff-task",
    productionRules: [
      "Only schedule performers currently present in the authored hub state.",
      "Do not block service access, evidence anchors or route silhouettes.",
      "Changed occupancy uses explicit state variants rather than generating new crowd identities.",
    ],
  },
] as const;

export interface NinthReliquaryAmbientRuntimeBinding {
  readonly sceneIdByProofSceneId: Readonly<Record<string, string>>;
  readonly sequenceIdByKey: Readonly<Record<string, string>>;
}

export interface NinthReliquaryAmbientRoomScriptManifest {
  readonly manifestVersion: 1;
  readonly projectId: string;
  readonly scripts: readonly {
    readonly id: string;
    readonly sceneId: string;
    readonly trigger: {
      readonly kind: "room-tick-cycle";
      readonly startTick: number;
      readonly intervalTicks: number;
    };
    readonly once: false;
    readonly actions: readonly [];
    readonly sequenceId: string;
  }[];
}

export const createNinthReliquaryAmbientRoomScripts = (
  projectId: string,
  binding: NinthReliquaryAmbientRuntimeBinding,
): NinthReliquaryAmbientRoomScriptManifest => ({
  manifestVersion: 1,
  projectId,
  scripts: ninthReliquaryAmbientSchedules.map((schedule) => {
    const sceneId = binding.sceneIdByProofSceneId[schedule.proofSceneId];
    const sequenceId = binding.sequenceIdByKey[schedule.sequenceKey];
    if (!sceneId) throw new Error(`Missing runtime scene binding for '${schedule.proofSceneId}'.`);
    if (!sequenceId) throw new Error(`Missing runtime sequence binding for '${schedule.sequenceKey}'.`);
    return {
      id: `room-script.${schedule.id}`,
      sceneId,
      trigger: {
        kind: "room-tick-cycle",
        startTick: schedule.startTick,
        intervalTicks: schedule.intervalTicks,
      },
      once: false,
      actions: [],
      sequenceId,
    };
  }),
});
