import type {
  RuntimeAdventureRouteEdge,
  RuntimeBundle,
} from "@evavo/adventure-runtime-bundle";
import {
  createSaveGame as createRuntimeSaveGame,
  loadSaveGame as loadRuntimeSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
import {
  adventureRouteAtRequiredReconvergence,
  adventureRouteAtTerminal,
  availableAdventureRouteEdges,
  createAdventureRouteTopologyState,
  traverseAdventureRouteEdge,
  type AdventureRouteTopologyState,
  type AdventureRouteTraversalResult,
} from "@evavo/adventure-scene-runtime/route-topology";
import {
  adventureTravelDestinations,
  travelToAdventureRouteNode,
  type AdventureTravelDestination,
  type AdventureTravelResult,
} from "@evavo/adventure-scene-runtime/travel-map";
import type { PackagedRuntimeControllerOptions } from "./packaged-controller.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";

export interface AdventureRoutePackagedRuntimeController extends PackagedSessionController {
  routeState(): AdventureRouteTopologyState;
  availableRouteEdges(): readonly RuntimeAdventureRouteEdge[];
  traverseRouteEdge(edgeId: string): AdventureRouteTraversalResult;
  travelDestinations(): readonly AdventureTravelDestination[];
  travelToNode(nodeId: string): AdventureTravelResult;
  routeAtTerminal(): boolean;
  routeAtRequiredReconvergence(): boolean;
}

const preserveCompanions = (save: SaveGame) => ({
  ...(save.interface.profiledCamera ? { profiledCamera: save.interface.profiledCamera } : {}),
  ...(save.interface.sentence ? { sentence: save.interface.sentence } : {}),
  ...(save.audio ? { audio: save.audio } : {}),
  ...(save.investigation ? { investigation: save.investigation } : {}),
  ...(save.itemCombinations ? { itemCombinations: save.itemCombinations } : {}),
  ...(save.multiProtagonist ? { multiProtagonist: save.multiProtagonist } : {}),
  ...(save.roomScripts ? { roomScripts: save.roomScripts } : {}),
  ...(save.rpg ? { rpg: save.rpg } : {}),
});

export const createAdventureRoutePackagedRuntimeControllerWithFactory = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
  innerFactory: PackagedSessionControllerFactory = createBasePackagedSessionController,
): AdventureRoutePackagedRuntimeController => {
  const manifest = bundle.routeTopology;
  if (!manifest) throw new Error(`Runtime bundle '${bundle.projectId}' has no route topology manifest.`);
  const controller = innerFactory(bundle, options);
  let route = createAdventureRouteTopologyState(manifest);

  const createSaveGame = (): SaveGame => {
    const baseSave = controller.createSaveGame();
    return createRuntimeSaveGame(bundle, controller.worldState(), {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...preserveCompanions(baseSave),
      routeTopology: route,
    });
  };

  const restoreSaveGame = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    const tick = controller.restoreSaveGame(save);
    route = save.routeTopology ?? createAdventureRouteTopologyState(manifest);
    return tick;
  };

  const replaceStory = (story: ReturnType<PackagedSessionController["worldState"]>["story"]): void => {
    const baseSave = controller.createSaveGame();
    const save = createRuntimeSaveGame(bundle, { ...controller.worldState(), story }, {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...preserveCompanions(baseSave),
      routeTopology: route,
    });
    controller.restoreSaveGame(save);
  };

  const applyTraversal = (result: AdventureRouteTraversalResult): AdventureRouteTraversalResult => {
    if (result.kind === "traversed") {
      route = result.state;
      replaceStory(result.story);
    }
    return result;
  };

  const traverseRouteEdge = (edgeId: string): AdventureRouteTraversalResult =>
    applyTraversal(traverseAdventureRouteEdge(manifest, controller.worldState().story, route, edgeId));

  const travelToNode = (nodeId: string): AdventureTravelResult => {
    const result = travelToAdventureRouteNode(manifest, controller.worldState().story, route, nodeId);
    if (result.kind === "traversed") {
      route = result.state;
      replaceStory(result.story);
    }
    return result;
  };

  return {
    ...controller,
    selection: controller.selection,
    routeState: () => route,
    availableRouteEdges: () => availableAdventureRouteEdges(manifest, controller.worldState().story, route),
    traverseRouteEdge,
    travelDestinations: () => adventureTravelDestinations(manifest, controller.worldState().story, route),
    travelToNode,
    routeAtTerminal: () => adventureRouteAtTerminal(manifest, route),
    routeAtRequiredReconvergence: () => adventureRouteAtRequiredReconvergence(manifest, route),
    controlledActorInstanceId: () => controller.controlledActorInstanceId(),
    worldState: () => controller.worldState(),
    createFrame: (tick) => controller.createFrame(tick),
    setPointer: (position) => controller.setPointer(position),
    setPressed: (pressed) => controller.setPressed(pressed),
    activate: (position) => controller.activate(position),
    handleKey: (input) => controller.handleKey(input),
    createSaveGame,
    restoreSaveGame,
    statusText: () => controller.statusText(),
    cameraState: () => controller.cameraState(),
    parserState: () => controller.parserState(),
    drainSceneAudioCueIds: () => controller.drainSceneAudioCueIds(),
  };
};

export const createAdventureRoutePackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): AdventureRoutePackagedRuntimeController =>
  createAdventureRoutePackagedRuntimeControllerWithFactory(bundle, options);
