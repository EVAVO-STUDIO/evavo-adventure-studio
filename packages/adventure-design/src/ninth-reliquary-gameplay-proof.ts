import type { AdventureCapabilityId } from "./full-game-capabilities.js";
import type { AdventureSceneArchetypeId } from "./scene-archetypes.js";

export interface NinthReliquaryProofScene {
  readonly id: string;
  readonly title: string;
  readonly archetype: AdventureSceneArchetypeId;
  readonly act: 1 | 2 | 3;
  readonly purpose: string;
  readonly requiredCapabilities: readonly AdventureCapabilityId[];
  readonly creativeTasks: readonly string[];
  readonly acceptanceQuestions: readonly string[];
}

export interface NinthReliquaryAct {
  readonly act: 1 | 2 | 3;
  readonly title: string;
  readonly objective: string;
  readonly sceneIds: readonly string[];
  readonly completionState: string;
}

export interface NinthReliquaryGameplayProofPlan {
  readonly planVersion: 1;
  readonly title: "The Ninth Reliquary";
  readonly productionProfileId: "cinematic-handdrawn-conspiracy";
  readonly premise: string;
  readonly acts: readonly NinthReliquaryAct[];
  readonly scenes: readonly NinthReliquaryProofScene[];
  readonly mustProveCapabilities: readonly AdventureCapabilityId[];
  readonly originalityRules: readonly string[];
}

const scene = (
  id: string,
  title: string,
  archetype: AdventureSceneArchetypeId,
  act: 1 | 2 | 3,
  purpose: string,
  requiredCapabilities: readonly AdventureCapabilityId[],
  creativeTasks: readonly string[],
  acceptanceQuestions: readonly string[],
): NinthReliquaryProofScene => ({
  id,
  title,
  archetype,
  act,
  purpose,
  requiredCapabilities,
  creativeTasks,
  acceptanceQuestions,
});

export const ninthReliquaryGameplayProof: NinthReliquaryGameplayProofPlan = {
  planVersion: 1,
  title: "The Ninth Reliquary",
  productionProfileId: "cinematic-handdrawn-conspiracy",
  premise:
    "A restoration researcher and freelance photojournalist follow a forged medieval reliquary through a contemporary European network whose ceremonial imagery disguises a financial crime.",
  acts: [
    {
      act: 1,
      title: "The False Provenance",
      objective: "Establish why the reliquary's provenance is impossible and identify the modern intermediary who altered its paper trail.",
      sceneIds: [
        "reliquary.old-city-square",
        "reliquary.cafe-dialogue",
        "reliquary.conservation-archive",
        "reliquary.street-cutaway",
      ],
      completionState: "fact.provenance-forged + topic.vallier-foundation + photo.blue-van",
    },
    {
      act: 2,
      title: "The Ninth Mark",
      objective: "Trace the forged symbol through conservation records into a hidden chapel and discover its modern logistical meaning.",
      sceneIds: [
        "reliquary.archive-research",
        "reliquary.hidden-chapel",
        "reliquary.reliquary-closeup",
        "reliquary.cross-character-handoff",
      ],
      completionState: "fact.ninth-mark-routing-code + chapel.exit-open + shared.photo-ledger-linked",
    },
    {
      act: 3,
      title: "The Hospice Ledger",
      objective: "Follow the transport route by train, exchange evidence between protagonists and expose the fraud before the remaining originals disappear.",
      sceneIds: [
        "reliquary.night-train",
        "reliquary.mountain-hospice",
        "reliquary.service-tunnel",
        "reliquary.final-confrontation",
      ],
      completionState: "evidence.case-complete + route.hospice-ledger + outcome.conspiracy-exposed",
    },
  ],
  scenes: [
    scene(
      "reliquary.old-city-square",
      "Old City Square After Rain",
      "scrolling-exterior",
      1,
      "Prove a wide hand-painted playable establishing location with several interaction anchors and a camera reveal that never loses clue readability.",
      ["scrolling-room", "panoramic-exterior", "walk-regions", "per-region-perspective", "multi-plane-occlusion", "context-interface"],
      ["Art Studio background", "Art Studio transparent foreground plates", "Cel character walk/idle", "ambient rain/reflection layers"],
      [
        "Does the full scroll feel like one authored location rather than stitched illustration panels?",
        "Can the protagonist cross foreground architecture without scale/occlusion errors?",
        "Are the café entrance and stone emblem readable without hotspot sparkles or quest UI?",
      ],
    ),
    scene(
      "reliquary.cafe-dialogue",
      "Café Witness Conversation",
      "dialogue-closeup",
      1,
      "Prove cinematic conversation topics, restrained portrait acting and fact unlocks while preserving the underlying café scene state.",
      ["in-scene-dialogue", "portrait-dialogue", "topic-dialogue", "dialogue-fact-unlocks", "research-investigation-loop"],
      ["Cel dialogue close-up poses", "Art Studio café background", "topic/evidence icon art"],
      [
        "Do topic icons express subjects without copying another game's iconography?",
        "Do close-up drawings remain on-model under several emotional states?",
        "Does leaving and re-entering conversation preserve exhausted/available topics correctly?",
      ],
    ),
    scene(
      "reliquary.conservation-archive",
      "Conservation Archive",
      "investigation-research",
      1,
      "Prove research provenance, documents, changed destinations and a modern cinematic illustrated archive without turning research into a quest checklist.",
      ["research-investigation-loop", "dialogue-fact-unlocks", "topic-dialogue", "global-progression-graph"],
      ["Art Studio archive environment", "document close-up illustrations", "Cel archivist performances"],
      [
        "Can every major fact identify where/how it was learned?",
        "Can the player infer the next lead from content rather than a HUD objective?",
        "Does document close-up return preserve room state exactly?",
      ],
    ),
    scene(
      "reliquary.street-cutaway",
      "Blue Van Incident",
      "cinematic-inset",
      1,
      "Prove room-local scripting and a blocking hand-animated cutaway that leaves the square briefly and returns to the exact prior interaction state.",
      ["room-cutaways", "cutscene-sequences", "deterministic-save-replay"],
      ["Cel cutaway shot sequence", "Art Studio incident insert background", "effects/foreground plates"],
      [
        "Does the cutaway return to the exact previous square/entrance/camera state?",
        "Can it be skipped only at an authored safe boundary?",
        "Are the action poses planned as one sequence instead of independently generated images?",
      ],
    ),
    scene(
      "reliquary.archive-research",
      "Restricted Provenance Room",
      "state-variant-room",
      2,
      "Prove a materially changed revisit where access, people, lighting and document availability change from investigation state.",
      ["room-state-variants", "conditional-hotspots", "stateful-navigation", "research-investigation-loop"],
      ["Art Studio room-state paint variants", "Cel alternate NPC staging"],
      [
        "Do changed visuals and interaction rules derive from the same state?",
        "Is the location still recognisable after the variant change?",
        "Can an old save enter the new variant without stale collision/occlusion geometry?",
      ],
    ),
    scene(
      "reliquary.hidden-chapel",
      "Hidden Chapel and Crypt",
      "multi-level-interior",
      2,
      "Prove stairs, balcony/crypt elevations, painted foreground occlusion and a concealed route with hand-drawn character scale continuity.",
      ["multi-elevation-room", "walk-regions", "per-region-perspective", "multi-plane-occlusion", "stateful-navigation"],
      ["Art Studio chapel background/foreground plates", "Cel stair traversal animation"],
      [
        "Do actor draw elevation and body scale remain coherent from nave to stair to crypt?",
        "Does the foreground architecture frame rather than hide the route?",
        "Do stairs use approved traversal timing and contact anchors?",
      ],
    ),
    scene(
      "reliquary.reliquary-closeup",
      "Reliquary Mechanism Close-up",
      "puzzle-closeup",
      2,
      "Prove detailed object inspection, item-on-object/item-on-item logic and reversible partial puzzle state.",
      ["closeup-puzzle-view", "item-on-object", "item-on-item", "conditional-hotspots", "deterministic-save-replay"],
      ["Art Studio object plate/layers", "Cel hand insert poses only where needed"],
      [
        "Does the close-up remain an authored game surface rather than a generic high-resolution modal?",
        "Can partial manipulation be saved/restored intentionally?",
        "Are hand inserts aligned to the same object geometry and lighting?",
      ],
    ),
    scene(
      "reliquary.cross-character-handoff",
      "Evidence Exchange",
      "multi-protagonist-cross-state",
      2,
      "Prove independent protagonist inventories/locations and a shared-fact mutation where one character's discovery changes the other's available dialogue and route.",
      ["multi-protagonist-switching", "inventory", "dialogue-fact-unlocks", "deterministic-save-replay"],
      ["Cel model/animation sets for both protagonists", "shared evidence icon art"],
      [
        "Do both protagonists keep distinct inventories and locations after repeated switches?",
        "Does the shared discovery unlock only the intended remote consequence?",
        "Does saving/restoring preserve the active protagonist and both characters' local state?",
      ],
    ),
    scene(
      "reliquary.night-train",
      "Night Train Compartment",
      "vehicle-interior",
      3,
      "Prove a moving vehicle room, travel-state ambience, conversation and a temporary exterior cutaway.",
      ["vehicle-scene", "room-state-variants", "room-cutaways", "cutscene-sequences"],
      ["Art Studio carriage interior", "Cel seated/dialogue/action poses", "window/environment loops"],
      [
        "Does the train feel in motion without distracting continuous animation?",
        "Can the exterior cutaway return without losing compartment state?",
        "Do seated poses remain on-model and properly anchored to furniture?",
      ],
    ),
    scene(
      "reliquary.mountain-hospice",
      "Mountain Hospice",
      "hub-location",
      3,
      "Prove a multi-room investigation hub with changing occupants, routes and evidence access.",
      ["global-progression-graph", "conditional-hotspots", "room-state-variants", "branching-dialogue"],
      ["Art Studio exterior/interiors", "Cel staff/visitor performances"],
      [
        "Are unavailable routes explained in-world rather than blocked by generic lock icons?",
        "Does returning after evidence discoveries change the hub cleanly?",
        "Can the full progression graph prove there is no hidden soft-lock?",
      ],
    ),
    scene(
      "reliquary.service-tunnel",
      "Service Tunnel Pursuit",
      "timed-danger",
      3,
      "Prove a brief authored timed danger state without turning the game into an arcade sequence.",
      ["timed-puzzle", "failure-retry", "quick-response-sequence", "cutscene-sequences"],
      ["Art Studio tunnel state variants", "Cel urgency poses and short action inserts"],
      [
        "Does the deadline remain readable without an arcade HUD?",
        "Does failure return to a private pre-action checkpoint safely?",
        "Are action drawings planned in a bounded sequence instead of generic motion generation?",
      ],
    ),
    scene(
      "reliquary.final-confrontation",
      "Hospice Ledger Confrontation",
      "chapter-transition",
      3,
      "Prove evidence-driven confrontation, alternate dialogue outcomes, one controlled cinematic finish and deterministic completion state.",
      ["branching-dialogue", "research-investigation-loop", "alternate-puzzle-solutions", "cutscene-sequences", "full-game-evidence"],
      ["Cel confrontation/dialogue/cutscene sequence", "Art Studio final room variants"],
      [
        "Does the ending follow from evidence actually gathered rather than a final arbitrary choice?",
        "Can alternate valid evidence routes converge without erasing their consequences?",
        "Does the full success replay prove every required act and scene archetype?",
      ],
    ),
  ],
  mustProveCapabilities: [
    "scrolling-room",
    "panoramic-exterior",
    "multi-elevation-room",
    "multi-plane-occlusion",
    "context-interface",
    "inventory",
    "item-on-object",
    "item-on-item",
    "topic-dialogue",
    "dialogue-fact-unlocks",
    "research-investigation-loop",
    "global-progression-graph",
    "room-cutaways",
    "cutscene-sequences",
    "multi-protagonist-switching",
    "vehicle-scene",
    "timed-puzzle",
    "failure-retry",
    "deterministic-save-replay",
    "full-game-evidence",
  ],
  originalityRules: [
    "Use historical/cinematic adventure references only for production principles; do not copy protected characters, emblems, locations, frames, dialogue, puzzles or plot events.",
    "The conspiracy, religious/ceremonial imagery, organisations, crimes, characters and evidence chain are original to The Ninth Reliquary.",
    "Anime-adjacent direction means clean shape language, economical cel shading, deliberate exposure timing and cinematic composition—not imitation of a named artist or animation studio.",
  ],
};

export const validateNinthReliquaryGameplayProof = (): readonly string[] => {
  const issues: string[] = [];
  const sceneIds = ninthReliquaryGameplayProof.scenes.map((entry) => entry.id);
  if (new Set(sceneIds).size !== sceneIds.length) issues.push("Ninth Reliquary proof scene IDs must be unique.");
  const declared = new Set(sceneIds);
  for (const act of ninthReliquaryGameplayProof.acts) {
    for (const sceneId of act.sceneIds) {
      if (!declared.has(sceneId)) issues.push(`Act ${act.act} references unknown proof scene '${sceneId}'.`);
    }
  }
  const usedCapabilities = new Set(ninthReliquaryGameplayProof.scenes.flatMap((entry) => entry.requiredCapabilities));
  for (const capability of ninthReliquaryGameplayProof.mustProveCapabilities) {
    if (!usedCapabilities.has(capability)) issues.push(`Required proof capability '${capability}' is not exercised by a scene.`);
  }
  return issues.sort((left, right) => left.localeCompare(right));
};
