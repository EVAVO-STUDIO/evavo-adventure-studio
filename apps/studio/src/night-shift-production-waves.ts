import type { Id } from "@evavo/adventure-project-schema";
import { nightShiftProductionAssets } from "./night-shift-production-assets.js";

export type NightShiftProductionWaveId = "foundation" | "station" | "roadside" | "diner";

export interface NightShiftProductionWave {
  readonly id: NightShiftProductionWaveId;
  readonly label: string;
  readonly dependsOn: readonly NightShiftProductionWaveId[];
  readonly goal: string;
  readonly assetIds: readonly Id<"asset">[];
  readonly acceptance: readonly string[];
}

const ids = (values: readonly string[]): readonly Id<"asset">[] => values as readonly Id<"asset">[];

export const nightShiftProductionWaves: readonly NightShiftProductionWave[] = [
  {
    id: "foundation",
    label: "Foundation — native player language",
    dependsOn: [],
    goal: "Lock the shared actor palette, officer locomotion and early-SCI1 icon interface before room-specific art is judged.",
    assetIds: ids([
      "asset.palette.night-shift.actor-lighting",
      "asset.night-shift.font.system",
      "asset.night-shift.ui.walk",
      "asset.night-shift.ui.look",
      "asset.night-shift.ui.use",
      "asset.night-shift.ui.talk",
      "asset.night-shift.actor.officer",
    ]),
    acceptance: [
      "Officer eight-frame walk reads cleanly at raw 1× with stable foot contacts and no universal outline.",
      "Neutral/fluorescent/headlamp/diner actor palette banks preserve face, uniform and leather material separation.",
      "5×7 bitmap font and all four 16×16 verb icons render only through nearest-neighbour native pixels.",
      "The top icon bar and visible score read as an early-1990s adventure interface rather than a modern HUD.",
    ],
  },
  {
    id: "station",
    label: "Station — first playable vertical slice",
    dependsOn: ["foundation"],
    goal: "Produce the complete briefing/readiness room so Adventure Studio can package and play one polished procedural scene end to end.",
    assetIds: ids([
      "asset.palette.night-shift.station",
      "asset.night-shift.background.station",
      "asset.night-shift.actor.sergeant",
      "asset.night-shift.object.radio",
      "asset.night-shift.object.keys",
      "asset.night-shift.object.door",
      "asset.night-shift.object.briefing",
      "asset.night-shift.foreground.desk",
      "asset.night-shift.foreground.door-frame",
      "asset.audio.night-shift.footstep.vinyl",
      "asset.audio.night-shift.radio-lift",
      "asset.audio.night-shift.keys-jingle",
      "asset.audio.night-shift.door-latch",
      "asset.audio.night-shift.station-room",
    ]),
    acceptance: [
      "Briefing, radio, keys and station exit are readable practical targets at 320×200 without oversized props.",
      "Officer routes across preferred floor lanes and passes behind desk/door-frame planes without body clipping.",
      "The Station scene palette is locked from the approved native room master and covers the background plus radio/keys/door/briefing index ranges.",
      "Fluorescent actor palette treatment remains hard/indexed and visibly different from the neutral actor bank.",
      "Briefing → radio → keys → exit progression reaches 14 points and all staged Foley cues resolve.",
    ],
  },
  {
    id: "roadside",
    label: "Roadside — procedural failure/retry proof",
    dependsOn: ["foundation", "station"],
    goal: "Prove wet-night perspective, vehicle occlusion, ordered palette lighting and recoverable procedural failure.",
    assetIds: ids([
      "asset.palette.night-shift.roadside",
      "asset.night-shift.background.roadside",
      "asset.night-shift.actor.driver",
      "asset.night-shift.object.sedan",
      "asset.night-shift.foreground.sedan",
      "asset.audio.night-shift.footstep.wet-asphalt",
      "asset.audio.night-shift.notebook",
      "asset.audio.night-shift.roadside-rain",
    ]),
    acceptance: [
      "Roadside remains legible through dark wet values without bloom, HDR exposure or excessive saturated neon.",
      "The Roadside scene palette is locked from the approved native room master and resolves the background/sedan index ranges consistently.",
      "Officer can move behind/in front of the sedan using authored baseline occlusion and safe approach staging.",
      "Headlamp zone demonstrates the real eight-pixel Bayer-4 actor palette transition with no interpolated RGB colours.",
      "Observe → talk → resolve succeeds; unsafe action enters lifecycle failure and private pre-action retry restores the stop.",
    ],
  },
  {
    id: "diner",
    label: "Diner — complete proof and evidence pass",
    dependsOn: ["foundation", "station", "roadside"],
    goal: "Finish the witness/receipt room and capture the complete 32-point success path plus retained Period VGA evidence.",
    assetIds: ids([
      "asset.palette.night-shift.diner",
      "asset.night-shift.background.diner",
      "asset.night-shift.actor.server",
      "asset.night-shift.object.receipt",
      "asset.night-shift.foreground.counter",
      "asset.audio.night-shift.footstep.diner-tile",
      "asset.audio.night-shift.paper-touch",
      "asset.audio.night-shift.diner-room",
    ]),
    acceptance: [
      "The Diner scene palette is locked from the approved native room master and resolves background/receipt index ranges consistently.",
      "Warm diner actor practical bank is visibly distinct from roadside headlamp and station fluorescent banks.",
      "Server remains an in-scene performance behind the counter rather than switching to a modern dialogue overlay.",
      "Witness conversation gates receipt corroboration and proof completion reaches exactly 32 points.",
      "Retain native screenshots and deterministic success/failure-retry replays only after the full three-room package passes runtime parsing.",
    ],
  },
] as const;

export const validateNightShiftProductionWaves = (): readonly string[] => {
  const issues: string[] = [];
  const knownAssets = new Set(nightShiftProductionAssets.map((asset) => asset.assetId as string));
  const assigned = new Map<string, string>();
  const knownWaves = new Set(nightShiftProductionWaves.map((wave) => wave.id));

  for (const wave of nightShiftProductionWaves) {
    for (const dependency of wave.dependsOn) {
      if (!knownWaves.has(dependency)) issues.push(`Wave '${wave.id}' depends on unknown wave '${dependency}'.`);
    }
    for (const assetId of wave.assetIds) {
      if (!knownAssets.has(assetId)) issues.push(`Wave '${wave.id}' references unknown production asset '${assetId}'.`);
      const previous = assigned.get(assetId);
      if (previous) issues.push(`Production asset '${assetId}' is assigned to both '${previous}' and '${wave.id}'.`);
      assigned.set(assetId, wave.id);
    }
    if (wave.acceptance.length < 3) issues.push(`Wave '${wave.id}' needs at least three acceptance checks.`);
  }

  for (const assetId of knownAssets) {
    if (!assigned.has(assetId)) issues.push(`Production asset '${assetId}' is not assigned to any build wave.`);
  }

  return issues.sort((left, right) => left.localeCompare(right));
};

export const nightShiftProductionWaveForAsset = (
  assetId: Id<"asset"> | string,
): NightShiftProductionWave | null =>
  nightShiftProductionWaves.find((wave) => wave.assetIds.includes(assetId as Id<"asset">)) ?? null;
