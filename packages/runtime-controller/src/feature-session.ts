import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type {
  PackagedRuntimeController,
  PackagedRuntimeControllerOptions,
} from "./packaged-controller.js";
import type { MultiProtagonistPackagedRuntimeController } from "./multi-protagonist-controller.js";
import { createMultiProtagonistSwitcherPackagedRuntimeControllerWithFactory } from "./multi-protagonist-switcher-controller.js";
import { createRoomScriptPackagedRuntimeControllerWithFactory } from "./room-script-controller.js";
import {
  createAdventureRoutePackagedRuntimeControllerWithFactory,
  type AdventureRoutePackagedRuntimeController,
} from "./route-topology-controller.js";
import {
  createAdventureRpgPackagedRuntimeControllerWithFactory,
  type AdventureRpgPackagedRuntimeController,
} from "./rpg-controller.js";
import { createSentencePackagedRuntimeControllerWithFactory } from "./sentence-controller.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";

type OptionalRpgController = Partial<Pick<
  AdventureRpgPackagedRuntimeController,
  | "rpgState"
  | "practiceSkill"
  | "resolveSkillCheck"
  | "resolveRpgPuzzle"
  | "advanceRpgTime"
  | "restRpg"
  | "adjustResource"
  | "scheduleActive"
  | "createRpgImportSnapshot"
  | "activeCombatState"
  | "startCombat"
  | "issueCombatAction"
  | "advanceCombat"
  | "finishCombat"
>>;

type OptionalRouteController = Partial<Pick<
  AdventureRoutePackagedRuntimeController,
  | "routeState"
  | "availableRouteEdges"
  | "traverseRouteEdge"
  | "travelDestinations"
  | "travelToNode"
  | "routeAtTerminal"
  | "routeAtRequiredReconvergence"
>>;

export interface PackagedFeatureSessionController
  extends PackagedSessionController,
    OptionalRpgController,
    OptionalRouteController {
  activeProtagonistId?(): ReturnType<MultiProtagonistPackagedRuntimeController["activeProtagonistId"]>;
  multiProtagonistState?(): ReturnType<MultiProtagonistPackagedRuntimeController["multiProtagonistState"]>;
  switchProtagonist?(protagonistId: Parameters<MultiProtagonistPackagedRuntimeController["switchProtagonist"]>[0]): void;
}

export interface PackagedFeatureRuntimeController
  extends PackagedRuntimeController,
    OptionalRpgController,
    OptionalRouteController {
  activeProtagonistId?(): ReturnType<MultiProtagonistPackagedRuntimeController["activeProtagonistId"]>;
  multiProtagonistState?(): ReturnType<MultiProtagonistPackagedRuntimeController["multiProtagonistState"]>;
  switchProtagonist?(protagonistId: Parameters<MultiProtagonistPackagedRuntimeController["switchProtagonist"]>[0]): void;
}

export interface PackagedFeatureSessionDescription {
  readonly sentence: boolean;
  readonly roomScripts: boolean;
  readonly rpg: boolean;
  readonly multiProtagonist: boolean;
  readonly routeTopology: boolean;
  readonly stack: readonly string[];
}

export const describePackagedFeatureSession = (
  bundle: RuntimeBundle,
): PackagedFeatureSessionDescription => {
  const sentence =
    bundle.presentation.interactionMode === "verb-list" &&
    bundle.uiSkins !== undefined &&
    bundle.bitmapFonts !== undefined;
  const roomScripts = bundle.roomScripts !== undefined;
  const rpg = bundle.rpg !== undefined;
  const multiProtagonist = bundle.multiProtagonist !== undefined;
  const routeTopology = bundle.routeTopology !== undefined;
  return {
    sentence,
    roomScripts,
    rpg,
    multiProtagonist,
    routeTopology,
    stack: [
      "base",
      ...(sentence ? ["sentence"] : []),
      ...(roomScripts ? ["room-scripts"] : []),
      ...(rpg ? ["rpg"] : []),
      ...(multiProtagonist ? ["multi-protagonist"] : []),
      ...(routeTopology ? ["route-topology"] : []),
    ],
  };
};

const sentenceFactory = (inner: PackagedSessionControllerFactory): PackagedSessionControllerFactory =>
  (bundle, options = {}) => createSentencePackagedRuntimeControllerWithFactory(bundle, options, inner);

const roomScriptFactory = (inner: PackagedSessionControllerFactory): PackagedSessionControllerFactory =>
  (bundle, options = {}) => createRoomScriptPackagedRuntimeControllerWithFactory(bundle, options, inner);

const rpgFactory = (inner: PackagedSessionControllerFactory): PackagedSessionControllerFactory =>
  (bundle, options = {}) => createAdventureRpgPackagedRuntimeControllerWithFactory(bundle, options, inner);

const multiProtagonistFactory = (inner: PackagedSessionControllerFactory): PackagedSessionControllerFactory =>
  (bundle, options = {}) => {
    const { requestedActorInstanceId: _ignored, ...multiOptions } = options;
    return createMultiProtagonistSwitcherPackagedRuntimeControllerWithFactory(bundle, multiOptions, inner);
  };

const routeFactory = (inner: PackagedSessionControllerFactory): PackagedSessionControllerFactory =>
  (bundle, options = {}) => createAdventureRoutePackagedRuntimeControllerWithFactory(bundle, options, inner);

export const createPackagedFeatureSessionController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): PackagedFeatureSessionController => {
  const description = describePackagedFeatureSession(bundle);
  let inner: PackagedSessionControllerFactory = createBasePackagedSessionController;
  if (description.sentence) inner = sentenceFactory(inner);
  if (description.roomScripts) inner = roomScriptFactory(inner);
  if (description.rpg) inner = rpgFactory(inner);
  if (description.multiProtagonist) inner = multiProtagonistFactory(inner);
  if (description.routeTopology) inner = routeFactory(inner);
  return inner(bundle, options) as PackagedFeatureSessionController;
};

const rpgFeatureApi = (session: PackagedFeatureSessionController): OptionalRpgController => ({
  ...(session.rpgState ? { rpgState: () => session.rpgState?.() as ReturnType<AdventureRpgPackagedRuntimeController["rpgState"]> } : {}),
  ...(session.practiceSkill ? { practiceSkill: (skillId: string, amount?: number) => session.practiceSkill?.(skillId, amount) as ReturnType<AdventureRpgPackagedRuntimeController["practiceSkill"]> } : {}),
  ...(session.resolveSkillCheck ? { resolveSkillCheck: (check) => session.resolveSkillCheck?.(check) as ReturnType<AdventureRpgPackagedRuntimeController["resolveSkillCheck"]> } : {}),
  ...(session.resolveRpgPuzzle ? { resolveRpgPuzzle: (puzzleId: string, solutionId: string) => session.resolveRpgPuzzle?.(puzzleId, solutionId) as ReturnType<AdventureRpgPackagedRuntimeController["resolveRpgPuzzle"]> } : {}),
  ...(session.advanceRpgTime ? { advanceRpgTime: (minutes: number) => session.advanceRpgTime?.(minutes) } : {}),
  ...(session.restRpg ? { restRpg: (rule) => session.restRpg?.(rule) } : {}),
  ...(session.adjustResource ? { adjustResource: (resourceId: string, delta: number) => session.adjustResource?.(resourceId, delta) } : {}),
  ...(session.scheduleActive ? { scheduleActive: (window) => session.scheduleActive?.(window) ?? false } : {}),
  ...(session.createRpgImportSnapshot ? { createRpgImportSnapshot: (sourceGameId: string, tags?: readonly string[]) => session.createRpgImportSnapshot?.(sourceGameId, tags) as ReturnType<AdventureRpgPackagedRuntimeController["createRpgImportSnapshot"]> } : {}),
  ...(session.activeCombatState ? { activeCombatState: () => session.activeCombatState?.() ?? null } : {}),
  ...(session.startCombat ? { startCombat: (encounterId: string) => session.startCombat?.(encounterId) as ReturnType<AdventureRpgPackagedRuntimeController["startCombat"]> } : {}),
  ...(session.issueCombatAction ? { issueCombatAction: (action) => session.issueCombatAction?.(action) ?? [] } : {}),
  ...(session.advanceCombat ? { advanceCombat: (ticks: number) => session.advanceCombat?.(ticks) ?? [] } : {}),
  ...(session.finishCombat ? { finishCombat: () => session.finishCombat?.() as ReturnType<AdventureRpgPackagedRuntimeController["finishCombat"]> } : {}),
});

const routeFeatureApi = (session: PackagedFeatureSessionController): OptionalRouteController => ({
  ...(session.routeState ? { routeState: () => session.routeState?.() as ReturnType<AdventureRoutePackagedRuntimeController["routeState"]> } : {}),
  ...(session.availableRouteEdges ? { availableRouteEdges: () => session.availableRouteEdges?.() ?? [] } : {}),
  ...(session.traverseRouteEdge ? { traverseRouteEdge: (edgeId: string) => session.traverseRouteEdge?.(edgeId) as ReturnType<AdventureRoutePackagedRuntimeController["traverseRouteEdge"]> } : {}),
  ...(session.travelDestinations ? { travelDestinations: () => session.travelDestinations?.() ?? [] } : {}),
  ...(session.travelToNode ? { travelToNode: (nodeId: string) => session.travelToNode?.(nodeId) as ReturnType<AdventureRoutePackagedRuntimeController["travelToNode"]> } : {}),
  ...(session.routeAtTerminal ? { routeAtTerminal: () => session.routeAtTerminal?.() ?? false } : {}),
  ...(session.routeAtRequiredReconvergence ? { routeAtRequiredReconvergence: () => session.routeAtRequiredReconvergence?.() ?? false } : {}),
});

export const createPackagedFeatureRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): PackagedFeatureRuntimeController => {
  const session = createPackagedFeatureSessionController(bundle, options);
  return {
    get selection() {
      return session.selection;
    },
    get controlledActorInstanceId() {
      return session.controlledActorInstanceId();
    },
    createFrame: (tick) => session.createFrame(tick),
    setPointer: (position) => session.setPointer(position),
    setPressed: (pressed) => session.setPressed(pressed),
    activate: (position) => session.activate(position),
    handleKey: (input) => session.handleKey(input),
    createSaveGame: () => session.createSaveGame(),
    restoreSaveGame: (input) => session.restoreSaveGame(input),
    statusText: () => session.statusText(),
    worldState: () => session.worldState(),
    cameraState: () => session.cameraState(),
    parserState: () => session.parserState(),
    drainSceneAudioCueIds: () => session.drainSceneAudioCueIds(),
    ...rpgFeatureApi(session),
    ...routeFeatureApi(session),
    ...(session.activeProtagonistId
      ? { activeProtagonistId: () => session.activeProtagonistId?.() as ReturnType<MultiProtagonistPackagedRuntimeController["activeProtagonistId"]> }
      : {}),
    ...(session.multiProtagonistState
      ? { multiProtagonistState: () => session.multiProtagonistState?.() as ReturnType<MultiProtagonistPackagedRuntimeController["multiProtagonistState"]> }
      : {}),
    ...(session.switchProtagonist
      ? { switchProtagonist: (protagonistId) => session.switchProtagonist?.(protagonistId) }
      : {}),
  };
};
