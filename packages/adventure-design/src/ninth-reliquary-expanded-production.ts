import type { AdventureCreativeFramePlanV3, AdventureCreativeWorkOrderV3 } from "./creative-production-handoff-v3.js";
import {
  compileIllustratedConspiracyWorkOrder,
  createNinthReliquaryProductionPlan,
  ninthReliquaryAssetSpecs,
  type IllustratedConspiracyAssetSpec,
  type IllustratedConspiracyProductionAuthority,
} from "./illustrated-conspiracy-production.js";

const heldFrames = (
  prefix: string,
  count: number,
  exposureTicks: number,
  loop = false,
): readonly AdventureCreativeFramePlanV3[] =>
  Array.from({ length: count }, (_, index) => {
    const current = index + 1;
    const frameId = `${prefix}.${String(current).padStart(2, "0")}`;
    const neighbours: string[] = [];
    if (index > 0) neighbours.push(`${prefix}.${String(index).padStart(2, "0")}`);
    else if (loop) neighbours.push(`${prefix}.${String(count).padStart(2, "0")}`);
    if (index + 1 < count) neighbours.push(`${prefix}.${String(current + 1).padStart(2, "0")}`);
    else if (loop) neighbours.push(`${prefix}.01`);
    return {
      frameId,
      role: index === 0 || index === count - 1 ? "extreme" : "breakdown",
      exposureTicks,
      pivot: { x: 24, y: 92 },
      footPoint: { x: 24, y: 92 },
      handAnchors: { primary: { x: 34, y: 56 } },
      shadowAnchor: { x: 24, y: 92 },
      requiredNeighbourFrameIds: neighbours,
    };
  });

const walkFrames = (prefix: string): readonly AdventureCreativeFramePlanV3[] =>
  Array.from({ length: 8 }, (_, index) => {
    const current = index + 1;
    const previous = index === 0 ? 8 : index;
    const next = current === 8 ? 1 : current + 1;
    return {
      frameId: `${prefix}.${String(current).padStart(2, "0")}`,
      role:
        current === 1 || current === 5
          ? "contact"
          : current === 3 || current === 7
            ? "passing"
            : "inbetween",
      exposureTicks: 2,
      pivot: { x: 24, y: 92 },
      footPoint: { x: 24, y: 92 },
      handAnchors: {
        left: { x: 14, y: 56 },
        right: { x: 34, y: 56 },
      },
      shadowAnchor: { x: 24, y: 92 },
      requiredNeighbourFrameIds: [
        `${prefix}.${String(previous).padStart(2, "0")}`,
        `${prefix}.${String(next).padStart(2, "0")}`,
      ],
    };
  });

export const ninthReliquaryExpandedAssetSpecs: readonly IllustratedConspiracyAssetSpec[] = [
  {
    assetId: "asset.ninth-reliquary.archive.background",
    taskKind: "background-paint",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    artDirection: [
      "Modern conservation archive with paper, stone and conservation equipment organised into clear playable lanes.",
      "Preserve the same hand-painted/cel visual language as Old City while shifting to cool institutional daylight and warm task lamps.",
    ],
    invariants: ["research desk, restricted door and shelving anchors remain fixed", "document interaction surfaces remain legible at gameplay scale"],
    forbiddenDrift: ["generic library fantasy", "photoreal render", "invented UI signage", "procedural shelf repetition"],
    reviewChecklist: ["perspective", "research readability", "walk lane", "practical light", "clue hierarchy"],
    rejectionRules: ["documents become visual noise", "access route obscured", "layout drifts between revisions"],
  },
  {
    assetId: "asset.ninth-reliquary.archive.document-closeups",
    taskKind: "prop",
    destinationStudio: "art-studio",
    nativeSize: { width: 512, height: 512 },
    alphaPolicy: "required",
    artDirection: [
      "Layered original conservation records, labels and provenance fragments for close inspection; readable symbols and dates only where authored by game data.",
      "Keep paper edges and object silhouettes genuinely transparent for compositing over the close-up surface.",
    ],
    invariants: ["authored evidence marks remain exact", "all transparent pixels are genuine decoded alpha"],
    forbiddenDrift: ["AI text gibberish", "fake checkerboard", "paper halos", "new decorative symbols not in source brief"],
    reviewChecklist: ["alpha truth", "evidence legibility", "text authority", "edge cleanup", "close-up registration"],
    rejectionRules: ["invented text", "matte residue", "evidence mark moved or omitted"],
  },
  {
    assetId: "asset.ninth-reliquary.archivist.key-poses",
    taskKind: "animation-sequence",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 240, height: 96 },
    alphaPolicy: "required",
    artDirection: ["Five economical archivist performance drawings: neutral hold, shelf reach, document handoff, wary reaction, return hold."],
    invariants: ["same face/costume construction throughout", "feet and desk contact anchors do not drift"],
    forbiddenDrift: ["independent-frame face redesign", "random hand scale", "constant unnecessary motion"],
    reviewChecklist: ["identity", "hand/object contact", "holds", "neighbour continuity", "alpha"],
    rejectionRules: ["model drift", "document jumps between hands", "anchor wobble"],
    frames: heldFrames("frame.archivist.performance", 5, 3),
  },
  {
    assetId: "asset.ninth-reliquary.chapel.background",
    taskKind: "background-paint",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    artDirection: [
      "Hidden modern-preserved chapel and crypt with clear nave, stair, balcony and lower route elevations.",
      "Use restrained painted atmosphere and motivated practical/daylight; ritual imagery is original Ninth Reliquary evidence, not copied heraldry.",
    ],
    invariants: ["nave/stair/crypt geometry matches navigation elevation plan", "reliquary inspection anchor remains fixed"],
    forbiddenDrift: ["fantasy cathedral exaggeration", "impossible stair geometry", "religious-symbol copying", "fog hiding gameplay"],
    reviewChecklist: ["elevation readability", "stair geometry", "route visibility", "evidence hierarchy", "light logic"],
    rejectionRules: ["stair cannot match actor traversal", "crypt route unreadable", "layout drift"],
  },
  {
    assetId: "asset.ninth-reliquary.chapel.foreground",
    taskKind: "foreground-plate",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "required",
    artDirection: ["Separate rail, arch, hanging lamp and near-column occlusion geometry from the approved chapel background."],
    invariants: ["pixel registration exact", "occlusion silhouettes agree with authored baselines"],
    forbiddenDrift: ["opaque canvas", "background duplication", "checkerboard", "halo/matte fringe"],
    reviewChecklist: ["decoded alpha", "hostile plates", "registration", "occlusion mask", "transparent edge"],
    rejectionRules: ["fake alpha", "foreground plate shifts from background", "hidden RGB contamination"],
  },
  {
    assetId: "asset.ninth-reliquary.mara.stairs",
    taskKind: "animation-sequence",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 288, height: 96 },
    alphaPolicy: "required",
    artDirection: ["Six authored stair drawings with explicit planted contacts and controlled body rise; preserve Mara model and coat construction."],
    invariants: ["feet contact authored stair points", "body height progression matches elevation transition", "bag/coat do not float"],
    forbiddenDrift: ["sliding feet", "generic walk reused on stairs", "independent-frame body scaling"],
    reviewChecklist: ["contact frames", "height progression", "model sheet", "neighbour continuity", "alpha"],
    rejectionRules: ["foot misses stair", "body pulses in size", "loop-like motion on one-way traversal"],
    frames: heldFrames("frame.mara.stairs", 6, 2),
  },
  {
    assetId: "asset.ninth-reliquary.reliquary-closeup",
    taskKind: "prop",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "required",
    artDirection: ["Layered close-up mechanism plates for the original reliquary puzzle: lid, rotating mark ring, latch, insert and hand-safe interaction clearances."],
    invariants: ["mechanical parts register to canonical puzzle geometry", "partial puzzle states reuse approved unchanged paint"],
    forbiddenDrift: ["new mechanism invented during repair", "glossy 3D render", "fake transparency", "state-to-state geometry drift"],
    reviewChecklist: ["registration", "state reuse", "alpha", "interaction clearance", "material consistency"],
    rejectionRules: ["puzzle state jumps", "parts cannot align", "alpha fringe"],
  },
  {
    assetId: "asset.ninth-reliquary.ivo.model-sheet",
    taskKind: "character-model-sheet",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 1024, height: 1024 },
    alphaPolicy: "opaque",
    artDirection: [
      "Original freelance photojournalist Ivo Serrat: practical travel clothes, camera/bag silhouette, slightly looser energy than Mara.",
      "Use the same modern anime-adjacent cel economy as Mara without cloning her face/body design or any protected character archetype.",
    ],
    invariants: ["face landmarks", "camera strap route", "body proportion", "hair mass", "shoe shape"],
    forbiddenDrift: ["generic anime male lead", "franchise resemblance", "costume redesign between turnaround views"],
    reviewChecklist: ["identity turnaround", "proportion", "camera/bag construction", "hands", "profile readability"],
    rejectionRules: ["identity changes between views", "camera equipment mutates between poses"],
  },
  {
    assetId: "asset.ninth-reliquary.ivo.walk-east",
    taskKind: "animation-sequence",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 384, height: 96 },
    alphaPolicy: "required",
    artDirection: ["Eight-drawing grounded walk with camera-bag secondary motion planned from one X-sheet, not independently generated drawings."],
    invariants: ["stable head/body volume", "camera/bag mass follows approved arcs", "foot baseline stable"],
    forbiddenDrift: ["bag teleports", "face changes", "line-weight flicker", "independent frames"],
    reviewChecklist: ["frame count", "exposure", "model sheet", "bag arc", "foot contact", "loop seam", "alpha"],
    rejectionRules: ["loop pop", "foot slide", "equipment identity drift"],
    frames: walkFrames("frame.ivo.walk-east"),
    loop: true,
  },
  {
    assetId: "asset.ninth-reliquary.evidence-handoff",
    taskKind: "animation-sequence",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 384, height: 192 },
    alphaPolicy: "required",
    artDirection: ["Paired evidence-exchange performance: eye-line, document/camera handoff and held acknowledgement between Mara and Ivo."],
    invariants: ["both character models stay locked", "shared prop occupies one continuous authored handoff path"],
    forbiddenDrift: ["prop duplication", "hand mismatch", "character scale changes between drawings"],
    reviewChecklist: ["two-character scale", "eye line", "prop handoff", "neighbour continuity", "alpha"],
    rejectionRules: ["evidence exists in both hands", "identity drift", "contact mismatch"],
    frames: heldFrames("frame.evidence-handoff", 8, 3),
  },
  {
    assetId: "asset.ninth-reliquary.train.background",
    taskKind: "background-paint",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    artDirection: ["Night train compartment with restrained practical lighting, readable seats/table/window and a controlled exterior-motion area."],
    invariants: ["seat anchors remain fixed for seated poses", "window mask remains stable for effects loop"],
    forbiddenDrift: ["luxury-train fantasy", "motion blur baked across room", "perspective incompatible with seated characters"],
    reviewChecklist: ["seat geometry", "window mask", "lighting", "dialogue staging", "route readability"],
    rejectionRules: ["seat anchors drift", "window dominates interaction", "background implies camera motion"],
  },
  {
    assetId: "asset.ninth-reliquary.train.window-loop",
    taskKind: "effects-sequence",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 320, height: 120 },
    alphaPolicy: "required",
    artDirection: ["Economical looping exterior lights/terrain silhouettes for the train window; restrained enough that dialogue remains primary."],
    invariants: ["loop aligns to approved window mask", "brightness range remains below faces/interactive props"],
    forbiddenDrift: ["video-like optical flow", "random per-frame landscape", "bright flicker", "fake alpha"],
    reviewChecklist: ["loop closure", "window registration", "exposure timing", "alpha", "brightness hierarchy"],
    rejectionRules: ["loop pop", "mask spill", "distracting flicker"],
    frames: heldFrames("frame.train-window", 6, 4, true),
    loop: true,
  },
  {
    assetId: "asset.ninth-reliquary.train.seated-poses",
    taskKind: "animation-sequence",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 384, height: 192 },
    alphaPolicy: "required",
    artDirection: ["Seated conversational holds and one evidence-check action for both protagonists, locked to approved seat/table anchors."],
    invariants: ["seat contact fixed", "model identity fixed", "hands respect table/prop anchors"],
    forbiddenDrift: ["floating hips", "changing seat scale", "generic talking-head loop"],
    reviewChecklist: ["seat contact", "eye line", "hands", "model sheet", "alpha"],
    rejectionRules: ["body floats from seat", "prop clips table", "identity drift"],
    frames: heldFrames("frame.train-seated", 8, 4),
  },
  {
    assetId: "asset.ninth-reliquary.hospice.layout",
    taskKind: "background-layout",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    artDirection: ["Mountain hospice investigation hub with reception, corridor branches and service access composed as one recognisable modern place."],
    invariants: ["route anchors fixed", "later room-state variants reuse the same architecture"],
    forbiddenDrift: ["generic haunted monastery", "tourism postcard", "branch geometry changing between states"],
    reviewChecklist: ["hub route clarity", "camera", "actor scale", "state-variant reuse", "evidence locations"],
    rejectionRules: ["routes indistinguishable", "variant cannot reuse layout", "camera changed after approval"],
  },
  {
    assetId: "asset.ninth-reliquary.hospice.background",
    taskKind: "background-paint",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    artDirection: ["Paint the approved hospice layout with cold mountain daylight, restrained institutional warmth and human-scale contemporary details."],
    invariants: ["layout pixel registration exact", "doors/desk/service access anchors fixed"],
    forbiddenDrift: ["gothic horror grading", "snow/fog obscures interactions", "generic hotel concept art"],
    reviewChecklist: ["layout registration", "lighting", "route contrast", "character integration", "state-variant compatibility"],
    rejectionRules: ["layout drift", "unmotivated bloom", "service route hidden"],
  },
  {
    assetId: "asset.ninth-reliquary.hospice.foreground",
    taskKind: "foreground-plate",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "required",
    artDirection: ["Transparent desk, doorway and near-corridor occlusion pieces registered to the approved hospice background."],
    invariants: ["registration exact", "clear transparent canvas outside authored pieces"],
    forbiddenDrift: ["checkerboard", "background paint baked into plate", "halo", "matte edge"],
    reviewChecklist: ["decoded alpha", "hostile plates", "registration", "occlusion", "edge colour"],
    rejectionRules: ["fake transparency", "plate shifts", "hidden RGB contamination"],
  },
  {
    assetId: "asset.ninth-reliquary.hospice.staff-poses",
    taskKind: "animation-sequence",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 288, height: 96 },
    alphaPolicy: "required",
    artDirection: ["Six sparse staff/visitor key poses supporting changed occupancy and investigation dialogue; avoid constant idle motion."],
    invariants: ["each character identity/costume locked", "standing/seated anchors fixed"],
    forbiddenDrift: ["generic crowd generator", "faces mutate", "random pose style"],
    reviewChecklist: ["identity", "pose purpose", "anchor", "neighbour continuity", "alpha"],
    rejectionRules: ["NPC identity drift", "unmotivated motion", "scale mismatch"],
    frames: heldFrames("frame.hospice-staff", 6, 5),
  },
  {
    assetId: "asset.ninth-reliquary.tunnel.background",
    taskKind: "background-paint",
    destinationStudio: "art-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    artDirection: ["Service tunnel danger scene with two readable routes, clear door/pipe anchors and enough negative space for urgent cel poses."],
    invariants: ["timed-route geometry fixed", "failure/retry return anchors readable"],
    forbiddenDrift: ["action-game clutter", "darkness hides route", "cinematic lens distortion"],
    reviewChecklist: ["route readability", "danger cue hierarchy", "character lane", "failure checkpoint composition"],
    rejectionRules: ["deadline route unreadable", "background requires HUD arrows", "camera drift"],
  },
  {
    assetId: "asset.ninth-reliquary.tunnel-action",
    taskKind: "animation-sequence",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 384, height: 96 },
    alphaPolicy: "required",
    artDirection: ["Eight bounded urgency drawings for brace, reach, duck and recover actions; no full arcade-run animation."],
    invariants: ["Mara/Ivo model authorities fixed", "contact anchors correspond to tunnel props"],
    forbiddenDrift: ["generic action-anime sequence", "camera-dependent smear", "independent redraw identity"],
    reviewChecklist: ["timing", "contact", "identity", "neighbour continuity", "alpha"],
    rejectionRules: ["action cannot align with prop", "identity drift", "unplanned smear frames"],
    frames: heldFrames("frame.tunnel-action", 8, 2),
  },
  {
    assetId: "asset.ninth-reliquary.final-confrontation",
    taskKind: "cutscene-shot",
    destinationStudio: "cel-animation-studio",
    nativeSize: { width: 640, height: 360 },
    alphaPolicy: "opaque",
    artDirection: ["Evidence-driven confrontation shot sequence using restrained reaction holds, one decisive gesture and a deterministic return/completion beat."],
    invariants: ["approved room layout", "all named characters stay on-model", "exact branch-resolved ending beat"],
    forbiddenDrift: ["generic trailer montage", "new costume/face design", "camera wandering", "unapproved combat spectacle"],
    reviewChecklist: ["branch state", "x-sheet", "identity", "camera", "dialogue/action cue timing"],
    rejectionRules: ["visual outcome contradicts evidence branch", "identity drift", "cutscene cannot deterministically complete"],
    frames: heldFrames("frame.final-confrontation", 8, 4),
  },
] as const;

export const ninthReliquaryCompleteAssetSpecs: readonly IllustratedConspiracyAssetSpec[] = [
  ...ninthReliquaryAssetSpecs,
  ...ninthReliquaryExpandedAssetSpecs,
];

export const createExpandedNinthReliquaryProductionPlan = (
  authorityByAsset: Readonly<Record<string, IllustratedConspiracyProductionAuthority>>,
): readonly AdventureCreativeWorkOrderV3[] => {
  const original = createNinthReliquaryProductionPlan(authorityByAsset);
  const offset = original.length;
  const expanded = ninthReliquaryExpandedAssetSpecs.map((spec, index) => {
    const authority = authorityByAsset[spec.assetId];
    if (!authority) throw new Error(`Missing production authority for '${spec.assetId}'.`);
    return compileIllustratedConspiracyWorkOrder(
      "project.ninth-reliquary",
      `work.ninth-reliquary.${String(offset + index + 1).padStart(2, "0")}.${spec.assetId.split(".").at(-1)}`,
      spec,
      authority,
    );
  });
  return [...original, ...expanded];
};
