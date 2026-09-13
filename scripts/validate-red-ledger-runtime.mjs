import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demoDirectory = join(repository, "apps/player/public/demos/the-red-ledger");
const source = JSON.parse(readFileSync(join(demoDirectory, "source-manifests.json"), "utf8"));
const bundle = JSON.parse(readFileSync(join(demoDirectory, "runtime.bundle.json"), "utf8"));
const errors = [];

const fail = (message) => errors.push(message);
const requireValue = (condition, message) => {
  if (!condition) fail(message);
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
};
const canonicalJson = (value) => JSON.stringify(canonical(value));
const sortById = (values) => [...values].sort((left, right) => left.id.localeCompare(right.id));

const compileRuntimeAsset = (asset) => {
  const { sourceFiles: _sourceFiles, ...runtime } = asset;
  const outputFiles = [...runtime.outputFiles].sort((left, right) => {
    const role = left.role.localeCompare(right.role);
    return role !== 0 ? role : left.runtimePath.localeCompare(right.runtimePath);
  });
  if (runtime.kind !== "spritesheet") return { ...runtime, outputFiles };
  return {
    ...runtime,
    outputFiles,
    metadata: {
      ...runtime.metadata,
      pages: [...runtime.metadata.pages].sort((left, right) =>
        left.outputRole.localeCompare(right.outputRole),
      ),
      frames: [...runtime.metadata.frames].sort((left, right) => left.frameId.localeCompare(right.frameId)),
    },
  };
};

const compileHotspot = (hotspot) => {
  const interactionIndex = {};
  for (const interaction of hotspot.interactions) {
    const key = JSON.stringify([interaction.verb, interaction.itemId ?? null]);
    const interactionIds = interactionIndex[key] ?? [];
    interactionIds.push(interaction.id);
    interactionIndex[key] = interactionIds;
  }
  return { ...hotspot, interactionIndex };
};

const compileExpectedBundle = (sourceValue) => {
  const sourceProject = sourceValue.project;
  const instances = sourceValue.sceneInstances;
  const fonts = sourceValue.bitmapFonts;
  const skins = sourceValue.uiSkins;
  return {
    bundleVersion: 1,
    sourceSchemaVersion: sourceProject.schemaVersion,
    projectId: sourceProject.id,
    title: sourceProject.title,
    presentation: sourceProject.presentation,
    startSceneId: sourceProject.startSceneId,
    startEntranceId: sourceProject.startEntranceId,
    assetManifestFingerprint: sourceValue.assetManifest.fingerprint,
    assetCompilerVersion: sourceValue.assetManifest.compilerVersion,
    assets: sourceValue.assetManifest.assets
      .map(compileRuntimeAsset)
      .sort((left, right) => left.assetId.localeCompare(right.assetId)),
    inventoryItems: sortById(sourceProject.inventoryItems),
    actors: sortById(sourceProject.actors).map((actor) => ({
      ...actor,
      frames: sortById(actor.frames),
      animations: sortById(actor.animations),
    })),
    scenes: sortById(sourceProject.scenes).map((scene) => ({
      ...scene,
      navigationAreas: sortById(scene.navigationAreas),
      depthBands: sortById(scene.depthBands),
      occluders: sortById(scene.occluders),
      hotspots: scene.hotspots.map(compileHotspot),
      entrances: sortById(scene.entrances),
    })),
    dialogues: sortById(sourceProject.dialogues).map((dialogue) => {
      const nodes = sortById(dialogue.nodes);
      return {
        ...dialogue,
        nodes,
        nodeIndex: Object.fromEntries(nodes.map((node, index) => [node.id, index])),
      };
    }),
    sequences: sortById(sourceProject.sequences).map((sequence) => ({
      ...sequence,
      tracks: sortById(sequence.tracks),
      cueCount: sequence.tracks.reduce((total, track) => total + track.cues.length, 0),
    })),
    bitmapFonts: {
      ...fonts,
      fonts: sortById(fonts.fonts).map((font) => ({
        ...font,
        glyphs: [...font.glyphs].sort((left, right) => {
          const codePoint = left.codePoint - right.codePoint;
          return codePoint !== 0 ? codePoint : left.id.localeCompare(right.id);
        }),
        kernings: [...font.kernings].sort((left, right) => {
          const leftCodePoint = left.leftCodePoint - right.leftCodePoint;
          return leftCodePoint !== 0 ? leftCodePoint : left.rightCodePoint - right.rightCodePoint;
        }),
      })),
    },
    uiSkins: {
      ...skins,
      skins: sortById(skins.skins),
    },
    sceneInstances: {
      ...instances,
      objectDefinitions: sortById(instances.objectDefinitions).map((definition) => ({
        ...definition,
        states: sortById(definition.states),
      })),
      scenes: [...instances.scenes]
        .sort((left, right) => left.sceneId.localeCompare(right.sceneId))
        .map((composition) => ({
          ...composition,
          actorInstances: sortById(composition.actorInstances),
          objectInstances: sortById(composition.objectInstances),
          navigationPortals: sortById(composition.navigationPortals),
        })),
    },
    playFeelProfileId: "gothic-measured",
  };
};

const project = source.project;
const assetManifest = source.assetManifest;
const bitmapFonts = source.bitmapFonts;
const uiSkins = source.uiSkins;
const sceneInstances = source.sceneInstances;
const projectId = "project.red-ledger.playable-slice";

requireValue(project?.id === projectId, "Project ID is not the Red Ledger slice ID.");
for (const [name, manifest] of Object.entries({
  assetManifest,
  bitmapFonts,
  uiSkins,
  sceneInstances,
})) {
  requireValue(manifest?.projectId === projectId, `${name} does not belong to ${projectId}.`);
}

const registerUnique = (values, label) => {
  const seen = new Map();
  for (const { id, path } of values) {
    const previous = seen.get(id);
    if (previous) fail(`${label} ID '${id}' is duplicated at ${previous} and ${path}.`);
    else seen.set(id, path);
  }
};

const projectIds = [];
const addProjectId = (id, path) => projectIds.push({ id, path });
for (const asset of project.assets) addProjectId(asset.id, `assets.${asset.id}`);
for (const item of project.inventoryItems) addProjectId(item.id, `inventory.${item.id}`);
for (const actor of project.actors) {
  addProjectId(actor.id, `actors.${actor.id}`);
  for (const frame of actor.frames) addProjectId(frame.id, `frames.${frame.id}`);
  for (const animation of actor.animations) {
    addProjectId(animation.id, `animations.${animation.id}`);
  }
}
for (const scene of project.scenes) {
  addProjectId(scene.id, `scenes.${scene.id}`);
  for (const collection of [
    scene.navigationAreas,
    scene.depthBands,
    scene.occluders,
    scene.hotspots,
    scene.entrances,
  ]) {
    for (const value of collection) addProjectId(value.id, `${scene.id}.${value.id}`);
  }
  for (const hotspot of scene.hotspots) {
    for (const interaction of hotspot.interactions) {
      addProjectId(interaction.id, `${hotspot.id}.${interaction.id}`);
    }
  }
}
for (const dialogue of project.dialogues) {
  addProjectId(dialogue.id, `dialogues.${dialogue.id}`);
  for (const node of dialogue.nodes) {
    addProjectId(node.id, `${dialogue.id}.${node.id}`);
    for (const line of node.lines) addProjectId(line.id, `${node.id}.${line.id}`);
    for (const choice of node.choices) addProjectId(choice.id, `${node.id}.${choice.id}`);
  }
}
for (const sequence of project.sequences) {
  addProjectId(sequence.id, `sequences.${sequence.id}`);
  for (const track of sequence.tracks) addProjectId(track.id, `${sequence.id}.${track.id}`);
}
registerUnique(projectIds, "Project");

const instanceIds = [];
const addInstanceId = (id, path) => instanceIds.push({ id, path });
for (const definition of sceneInstances.objectDefinitions) {
  addInstanceId(definition.id, `definitions.${definition.id}`);
  for (const state of definition.states) {
    addInstanceId(state.id, `${definition.id}.${state.id}`);
    for (const interaction of state.interactions ?? []) {
      addInstanceId(interaction.id, `${state.id}.${interaction.id}`);
    }
  }
}
for (const composition of sceneInstances.scenes) {
  for (const actor of composition.actorInstances) {
    addInstanceId(actor.id, `${composition.sceneId}.${actor.id}`);
  }
  for (const object of composition.objectInstances) {
    addInstanceId(object.id, `${composition.sceneId}.${object.id}`);
  }
  for (const portal of composition.navigationPortals) {
    addInstanceId(portal.id, `${composition.sceneId}.${portal.id}`);
  }
}
registerUnique(instanceIds, "Scene-instance");

const projectAssets = new Map(project.assets.map((asset) => [asset.id, asset]));
const compiledAssets = new Map(assetManifest.assets.map((asset) => [asset.assetId, asset]));
requireValue(
  canonicalJson([...projectAssets.keys()].sort()) === canonicalJson([...compiledAssets.keys()].sort()),
  "Project and asset-manifest asset sets differ.",
);
const runtimePaths = new Map();
for (const [assetId, record] of compiledAssets) {
  requireValue(
    projectAssets.get(assetId)?.kind === record.kind,
    `Asset '${assetId}' kind differs between project and build manifest.`,
  );
  for (const sourceFile of record.sourceFiles) {
    const absolute = join(repository, sourceFile.path);
    let bytes;
    try {
      bytes = readFileSync(absolute);
    } catch {
      fail(`Asset '${assetId}' source '${sourceFile.path}' is missing.`);
      continue;
    }
    requireValue(
      bytes.byteLength === sourceFile.byteLength,
      `Asset '${assetId}' source byte length differs.`,
    );
    requireValue(sha256(bytes) === sourceFile.sha256, `Asset '${assetId}' source hash differs.`);
  }
  const roles = new Set();
  for (const output of record.outputFiles) {
    requireValue(!roles.has(output.role), `Asset '${assetId}' duplicates output role '${output.role}'.`);
    roles.add(output.role);
    requireValue(
      output.mediaType === "image/png",
      `Asset '${assetId}' must compile to indexed PNG, not '${output.mediaType}'.`,
    );
    requireValue(
      output.runtimePath.toLowerCase().endsWith(".png"),
      `Asset '${assetId}' runtime output must use a PNG path.`,
    );
    requireValue(
      record.metadata?.palette === true && record.metadata?.colourCount <= 48,
      `Asset '${assetId}' exceeds the controlled classic palette contract.`,
    );
    const portable =
      output.runtimePath.length > 0 &&
      !output.runtimePath.startsWith("/") &&
      !output.runtimePath.includes("\\") &&
      output.runtimePath.split("/").every((segment) => segment && segment !== "." && segment !== "..");
    requireValue(portable, `Asset '${assetId}' has non-portable runtime path '${output.runtimePath}'.`);
    const key = output.runtimePath.toLowerCase();
    const previous = runtimePaths.get(key);
    if (previous) fail(`Runtime path '${output.runtimePath}' is shared by '${previous}' and '${assetId}'.`);
    else runtimePaths.set(key, assetId);
  }
}
const manifestFingerprint = sha256(JSON.stringify(canonical(assetManifest.assets)));
requireValue(
  assetManifest.fingerprint === manifestFingerprint,
  "Asset-manifest fingerprint does not match its canonical records.",
);

const scenes = new Map(project.scenes.map((scene) => [scene.id, scene]));
const actors = new Map(project.actors.map((actor) => [actor.id, actor]));
const items = new Set(project.inventoryItems.map((item) => item.id));
const dialogues = new Map(project.dialogues.map((dialogue) => [dialogue.id, dialogue]));
const sequences = new Set(project.sequences.map((sequence) => sequence.id));
const definitions = new Map(
  sceneInstances.objectDefinitions.map((definition) => [definition.id, definition]),
);
const placedObjects = new Map();
for (const composition of sceneInstances.scenes) {
  requireValue(scenes.has(composition.sceneId), `Composition scene '${composition.sceneId}' is missing.`);
  const scene = scenes.get(composition.sceneId);
  const navigationIds = new Set(scene?.navigationAreas.map((area) => area.id) ?? []);
  for (const instance of composition.actorInstances) {
    const actor = actors.get(instance.actorId);
    requireValue(
      Boolean(actor),
      `Actor instance '${instance.id}' references missing actor '${instance.actorId}'.`,
    );
    requireValue(
      actor?.animations.some(
        (animation) => animation.state === instance.animationState && animation.facing === instance.facing,
      ),
      `Actor instance '${instance.id}' has no authored arrival animation.`,
    );
  }
  for (const instance of composition.objectInstances) {
    placedObjects.set(instance.id, instance);
    const definition = definitions.get(instance.definitionId);
    requireValue(
      Boolean(definition),
      `Object '${instance.id}' definition '${instance.definitionId}' is missing.`,
    );
    const stateId = instance.initialStateId ?? definition?.initialStateId;
    requireValue(
      definition?.states.some((state) => state.id === stateId),
      `Object '${instance.id}' initial state '${stateId}' is invalid.`,
    );
  }
  for (const portal of composition.navigationPortals) {
    requireValue(
      navigationIds.has(portal.fromAreaId) && navigationIds.has(portal.toAreaId),
      `Portal '${portal.id}' references a missing navigation area.`,
    );
  }
}

const validateActions = (actions, path) => {
  for (const [index, action] of actions.entries()) {
    const actionPath = `${path}.actions[${index}]`;
    if (action.kind === "say" && action.speakerId) {
      requireValue(actors.has(action.speakerId), `${actionPath} speaker '${action.speakerId}' is missing.`);
    }
    if (action.kind === "give-item" || action.kind === "remove-item") {
      requireValue(items.has(action.itemId), `${actionPath} item '${action.itemId}' is missing.`);
    }
    if (action.kind === "change-scene") {
      const scene = scenes.get(action.sceneId);
      requireValue(Boolean(scene), `${actionPath} scene '${action.sceneId}' is missing.`);
      requireValue(
        scene?.entrances.some((entrance) => entrance.id === action.entranceId),
        `${actionPath} entrance '${action.entranceId}' is missing.`,
      );
    }
    if (action.kind === "start-dialogue") {
      const dialogue = dialogues.get(action.dialogueId);
      requireValue(Boolean(dialogue), `${actionPath} dialogue '${action.dialogueId}' is missing.`);
      if (action.nodeId) {
        requireValue(
          dialogue?.nodes.some((node) => node.id === action.nodeId),
          `${actionPath} dialogue node '${action.nodeId}' is missing.`,
        );
      }
    }
    if (action.kind === "play-sequence") {
      requireValue(
        sequences.has(action.sequenceId),
        `${actionPath} sequence '${action.sequenceId}' is missing.`,
      );
    }
    if (action.kind === "set-object-state") {
      const placed = placedObjects.get(action.objectId);
      requireValue(Boolean(placed), `${actionPath} object '${action.objectId}' is missing.`);
      const definition = placed ? definitions.get(placed.definitionId) : null;
      requireValue(
        definition?.states.some((state) => state.id === action.state),
        `${actionPath} object state '${action.state}' is invalid.`,
      );
    }
  }
};
for (const scene of project.scenes) {
  for (const hotspot of scene.hotspots) {
    for (const interaction of hotspot.interactions) {
      validateActions(interaction.actions, interaction.id);
    }
  }
}
for (const definition of sceneInstances.objectDefinitions) {
  requireValue(
    definition.states.some((state) => state.id === definition.initialStateId),
    `Object definition '${definition.id}' has an invalid initial state.`,
  );
  for (const state of definition.states) {
    if (state.visual) {
      requireValue(
        projectAssets.has(state.visual.assetId),
        `Object state '${state.id}' visual asset '${state.visual.assetId}' is missing.`,
      );
    }
    for (const interaction of state.interactions ?? []) {
      validateActions(interaction.actions, interaction.id);
    }
  }
}
for (const dialogue of project.dialogues) {
  for (const node of dialogue.nodes) {
    validateActions(node.enterActions, `${node.id}.enter`);
    validateActions(node.exitActions, `${node.id}.exit`);
    for (const choice of node.choices) validateActions(choice.actions, choice.id);
  }
}

for (const actor of project.actors) {
  for (const frame of actor.frames) {
    const record = compiledAssets.get(frame.assetId);
    if (record?.kind === "spritesheet") {
      const compiledFrame = record.metadata.frames.find((candidate) => candidate.frameId === frame.id);
      requireValue(Boolean(compiledFrame), `Frame '${frame.id}' is missing from compiled metadata.`);
      requireValue(
        canonicalJson(compiledFrame?.sourceRect) === canonicalJson(frame.sourceRect) &&
          canonicalJson(compiledFrame?.originalSize) === canonicalJson(frame.sourceSize) &&
          canonicalJson(compiledFrame?.trimOffset) === canonicalJson(frame.trimOffset),
        `Frame '${frame.id}' compiled geometry differs from authoring.`,
      );
    } else if (record?.kind === "image") {
      requireValue(
        frame.sourceRect.x + frame.sourceRect.width <= record.metadata.width &&
          frame.sourceRect.y + frame.sourceRect.height <= record.metadata.height,
        `Frame '${frame.id}' exceeds image asset '${frame.assetId}'.`,
      );
    } else {
      fail(`Frame '${frame.id}' references a non-renderable asset.`);
    }
  }
}

for (const font of bitmapFonts.fonts) {
  const atlas = compiledAssets.get(font.atlasAssetId);
  requireValue(atlas?.kind === "image", `Font '${font.id}' atlas is not an image.`);
  const codePoints = new Set();
  for (const glyph of font.glyphs) {
    requireValue(
      !codePoints.has(glyph.codePoint),
      `Font '${font.id}' duplicates U+${glyph.codePoint.toString(16)}.`,
    );
    codePoints.add(glyph.codePoint);
    requireValue(
      glyph.sourceRect.x + glyph.sourceRect.width <= atlas.metadata.width &&
        glyph.sourceRect.y + glyph.sourceRect.height <= atlas.metadata.height,
      `Glyph '${glyph.id}' exceeds the font atlas.`,
    );
  }
  requireValue(codePoints.has(font.fallbackCodePoint), `Font '${font.id}' fallback glyph is missing.`);
}

const rectanglesOverlap = (left, right) =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;
for (const skin of uiSkins.skins) {
  const regions = [
    skin.status,
    ...(skin.score ? [skin.score] : []),
    ...(skin.verbBar ? [skin.verbBar.region] : []),
    ...(skin.inventory ? [skin.inventory.region] : []),
    ...(skin.parser ? [skin.parser.region] : []),
    ...(skin.dialogueChoices ? [skin.dialogueChoices.region] : []),
  ];
  for (const region of regions) {
    requireValue(
      region.rect.x + region.rect.width <= skin.nativeSize.width &&
        region.rect.y + region.rect.height <= skin.nativeSize.height,
      `UI region '${region.id}' exceeds the native canvas.`,
    );
  }
  for (let left = 0; left < regions.length; left += 1) {
    for (let right = left + 1; right < regions.length; right += 1) {
      requireValue(
        !rectanglesOverlap(regions[left].rect, regions[right].rect),
        `UI regions '${regions[left].id}' and '${regions[right].id}' overlap.`,
      );
    }
  }
  if (skin.dialogueChoices && skin.fonts.dialogue) {
    const font = bitmapFonts.fonts.find((candidate) => candidate.id === skin.fonts.dialogue.fontId);
    requireValue(Boolean(font), `Dialogue font '${skin.fonts.dialogue.fontId}' is missing.`);
    const contentHeight = skin.dialogueChoices.region.rect.height - skin.dialogueChoices.region.padding * 2;
    const count = skin.dialogueChoices.maximumChoices;
    const rowHeight = Math.max(
      (font?.lineHeight ?? 0) + 4,
      Math.floor((contentHeight - (count - 1) * skin.dialogueChoices.gap) / count),
    );
    const requiredHeight = count * rowHeight + (count - 1) * skin.dialogueChoices.gap;
    requireValue(
      requiredHeight <= contentHeight,
      `Dialogue panel '${skin.dialogueChoices.region.id}' needs ${requiredHeight}px ` +
        `but exposes ${contentHeight}px.`,
    );
  }
}

const expectedBundle = compileExpectedBundle(source);
requireValue(
  canonicalJson(bundle) === canonicalJson(expectedBundle),
  "Runtime bundle differs from the independently compiled canonical source.",
);
requireValue(bundle.projectId === projectId, "Runtime bundle project ID differs.");
requireValue(
  bundle.playFeelProfileId === "gothic-measured",
  "Runtime bundle lost its gothic measured profile.",
);
requireValue(bundle.scenes.length === 3, "Runtime bundle must contain three scenes.");
requireValue(bundle.assets.length === 17, "Runtime bundle must contain seventeen assets.");
const runtimeActorPlacements = bundle.sceneInstances.scenes.flatMap(
  (composition) => composition.actorInstances,
);
requireValue(
  runtimeActorPlacements.filter((instance) => instance.id === "actor-instance.red-ledger.archivist")
    .length === 1,
  "The persistent archivist must be authored once, not duplicated per room.",
);
requireValue(
  bundle.sceneInstances.scenes
    .filter((composition) => composition.sceneId !== "scene.red-ledger.archive")
    .every((composition) => composition.actorInstances.length === 0),
  "Destination rooms must exercise persistent runtime actor placement.",
);

const evaluateStoryCondition = (condition, state) => {
  if (!condition) return true;
  switch (condition.kind) {
    case "always":
      return true;
    case "flag":
      return (state.flags[condition.flag] ?? false) === condition.equals;
    case "variable": {
      const actual = state.variables[condition.variable];
      if (actual === undefined) return false;
      switch (condition.operator) {
        case "eq":
          return actual === condition.value;
        case "neq":
          return actual !== condition.value;
        case "gt":
          return typeof actual === typeof condition.value && actual > condition.value;
        case "gte":
          return typeof actual === typeof condition.value && actual >= condition.value;
        case "lt":
          return typeof actual === typeof condition.value && actual < condition.value;
        case "lte":
          return typeof actual === typeof condition.value && actual <= condition.value;
      }
      return false;
    }
    case "has-item":
      return state.inventory.includes(condition.itemId);
    case "interaction-used":
      return state.consumedInteractionIds.includes(condition.interactionId);
    case "dialogue-choice-used":
      return state.consumedDialogueChoiceIds.includes(condition.choiceId);
    case "all":
      return condition.conditions.every((child) => evaluateStoryCondition(child, state));
    case "any":
      return condition.conditions.some((child) => evaluateStoryCondition(child, state));
    case "not":
      return !evaluateStoryCondition(condition.condition, state);
  }
};

const dialogueNode = (dialogueId, nodeId) =>
  dialogues.get(dialogueId)?.nodes.find((node) => node.id === nodeId) ?? null;

const applyStoryActions = (initialState, actions) => {
  let state = initialState;
  for (const action of actions) {
    switch (action.kind) {
      case "say":
      case "play-sequence":
        break;
      case "set-flag":
        state = {
          ...state,
          flags: { ...state.flags, [action.flag]: action.value },
        };
        break;
      case "set-variable":
        state = {
          ...state,
          variables: { ...state.variables, [action.variable]: action.value },
        };
        break;
      case "give-item":
        if (!state.inventory.includes(action.itemId)) {
          state = { ...state, inventory: [...state.inventory, action.itemId] };
        }
        break;
      case "remove-item":
        state = {
          ...state,
          inventory: state.inventory.filter((itemId) => itemId !== action.itemId),
        };
        break;
      case "award-score":
        if (!state.awardedScoreIds.includes(action.awardId)) {
          state = {
            ...state,
            awardedScoreIds: [...state.awardedScoreIds, action.awardId],
            score: state.score + action.points,
          };
        }
        break;
      case "change-scene":
        state = {
          ...state,
          currentSceneId: action.sceneId,
          currentEntranceId: action.entranceId,
        };
        break;
      case "set-object-state":
        state = {
          ...state,
          objectStates: {
            ...state.objectStates,
            [action.objectId]: action.state,
          },
        };
        break;
      case "start-dialogue": {
        const dialogue = dialogues.get(action.dialogueId);
        const nodeId = action.nodeId ?? dialogue?.startNodeId;
        const node = nodeId ? dialogueNode(action.dialogueId, nodeId) : null;
        requireValue(Boolean(node), `Dialogue start '${action.dialogueId}' is invalid.`);
        if (!node) break;
        state = {
          ...state,
          activeDialogue: { dialogueId: action.dialogueId, nodeId: node.id },
        };
        state = applyStoryActions(state, node.enterActions);
        break;
      }
    }
  }
  return state;
};

const visibleDialogueChoices = (state) => {
  if (!state.activeDialogue) return [];
  const node = dialogueNode(state.activeDialogue.dialogueId, state.activeDialogue.nodeId);
  if (!node) return [];
  return node.choices.filter(
    (choice) =>
      (!choice.once || !state.consumedDialogueChoiceIds.includes(choice.id)) &&
      evaluateStoryCondition(choice.visibleWhen, state) &&
      evaluateStoryCondition(choice.enabledWhen, state),
  );
};

const chooseDialogue = (initialState, choiceId) => {
  const active = initialState.activeDialogue;
  requireValue(Boolean(active), `Dialogue choice '${choiceId}' has no active dialogue.`);
  if (!active) return initialState;
  const node = dialogueNode(active.dialogueId, active.nodeId);
  const choice = visibleDialogueChoices(initialState).find((candidate) => candidate.id === choiceId);
  requireValue(Boolean(choice), `Dialogue choice '${choiceId}' is not available.`);
  if (!node || !choice) return initialState;
  let state = applyStoryActions(initialState, node.exitActions);
  state = applyStoryActions(state, choice.actions);
  if (choice.once) {
    state = {
      ...state,
      consumedDialogueChoiceIds: [...state.consumedDialogueChoiceIds, choice.id],
    };
  }
  if (choice.closeDialogue) return { ...state, activeDialogue: null };
  if (choice.nextNodeId) {
    const next = dialogueNode(active.dialogueId, choice.nextNodeId);
    requireValue(Boolean(next), `Dialogue node '${choice.nextNodeId}' is missing.`);
    if (!next) return state;
    state = {
      ...state,
      activeDialogue: { dialogueId: active.dialogueId, nodeId: next.id },
    };
    return applyStoryActions(state, next.enterActions);
  }
  return state;
};

const executeObjectInteraction = (initialState, objectId, verb) => {
  const instance = placedObjects.get(objectId);
  requireValue(Boolean(instance), `Gameplay object '${objectId}' is missing.`);
  if (!instance) return initialState;
  const definition = definitions.get(instance.definitionId);
  requireValue(Boolean(definition), `Gameplay definition '${instance.definitionId}' is missing.`);
  if (!definition) return initialState;
  const stateId = initialState.objectStates[objectId] ?? instance.initialStateId ?? definition.initialStateId;
  const objectState = definition.states.find((candidate) => candidate.id === stateId);
  requireValue(Boolean(objectState), `Gameplay object state '${stateId}' is missing.`);
  if (!objectState) return initialState;
  const interaction = objectState.interactions.find(
    (candidate) =>
      candidate.verb === verb &&
      (!candidate.once || !initialState.consumedInteractionIds.includes(candidate.id)) &&
      evaluateStoryCondition(candidate.when, initialState),
  );
  requireValue(
    Boolean(interaction),
    `Gameplay object '${objectId}' has no available '${verb}' interaction in '${stateId}'.`,
  );
  if (!interaction) return initialState;
  let state = applyStoryActions(initialState, interaction.actions);
  if (interaction.once) {
    state = {
      ...state,
      consumedInteractionIds: [...state.consumedInteractionIds, interaction.id],
    };
  }
  return state;
};

const initialObjectStates = Object.fromEntries(
  [...placedObjects.entries()].map(([objectId, instance]) => {
    const definition = definitions.get(instance.definitionId);
    return [objectId, instance.initialStateId ?? definition?.initialStateId];
  }),
);
let gameplay = {
  currentSceneId: project.startSceneId,
  currentEntranceId: project.startEntranceId,
  flags: {},
  variables: {},
  inventory: [],
  awardedScoreIds: [],
  consumedInteractionIds: [],
  consumedDialogueChoiceIds: [],
  objectStates: initialObjectStates,
  activeDialogue: null,
  score: 0,
};

const pointOnSegment = (point, start, end) => {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 1e-7) return false;
  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  if (dot < -1e-7) return false;
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot <= lengthSquared + 1e-7;
};

const pointInPolygon = (point, polygon) => {
  let inside = false;
  for (
    let index = 0, previous = polygon.points.length - 1;
    index < polygon.points.length;
    previous = index++
  ) {
    const currentPoint = polygon.points[index];
    const previousPoint = polygon.points[previous];
    if (!currentPoint || !previousPoint) continue;
    if (pointOnSegment(point, previousPoint, currentPoint)) return true;
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
};

const selectedDepthBand = (scene, y) =>
  [...scene.depthBands].sort((left, right) => {
    const distance = (band) => {
      const minimum = Math.min(band.farY, band.nearY);
      const maximum = Math.max(band.farY, band.nearY);
      return y < minimum ? minimum - y : y > maximum ? y - maximum : 0;
    };
    const distanceDifference = distance(left) - distance(right);
    if (Math.abs(distanceDifference) > 1e-7) return distanceDifference;
    const spanDifference = Math.abs(left.nearY - left.farY) - Math.abs(right.nearY - right.farY);
    return Math.abs(spanDifference) > 1e-7 ? spanDifference : left.id.localeCompare(right.id);
  })[0] ?? null;

const scaleAtY = (scene, y) => {
  const band = selectedDepthBand(scene, y);
  if (!band) return { scale: 1, zOffset: 0 };
  const denominator = band.nearY - band.farY;
  const progress =
    Math.abs(denominator) <= 1e-7 ? 0 : Math.min(1, Math.max(0, (y - band.farY) / denominator));
  return {
    scale: band.farScale + (band.nearScale - band.farScale) * progress,
    zOffset: band.zOffset ?? 0,
  };
};

const transformedObjectPolygon = (scene, instance, state) => {
  if (!state.interactionShape) return null;
  const anchor = {
    x: Math.round(instance.position.x),
    y: Math.round(instance.position.y),
  };
  const perspective = scaleAtY(scene, anchor.y);
  const scale = perspective.scale * instance.scaleMultiplier;
  const pivot = state.visual?.pivot ?? { x: 0, y: 0 };
  return {
    points: state.interactionShape.points.map((point) => ({
      x: anchor.x + (point.x - pivot.x) * scale * (instance.mirrored ? -1 : 1),
      y: anchor.y + (point.y - pivot.y) * scale,
    })),
  };
};

const renderLayerOrder = {
  sky: 0,
  background: 100,
  "rear-ambient": 200,
  world: 300,
  occlusion: 400,
  "front-ambient": 500,
  effects: 600,
  speech: 700,
  interface: 800,
  cursor: 900,
  "display-treatment": 1000,
};

const hitObjectAt = (state, sceneId, point) => {
  const scene = scenes.get(sceneId);
  const composition = sceneInstances.scenes.find((candidate) => candidate.sceneId === sceneId);
  if (!scene || !composition) return null;
  const hits = [];
  for (const instance of composition.objectInstances) {
    if (instance.visibleWhen && !evaluateStoryCondition(instance.visibleWhen, state)) {
      continue;
    }
    const definition = definitions.get(instance.definitionId);
    if (!definition) continue;
    const stateId = state.objectStates[instance.id] ?? instance.initialStateId ?? definition.initialStateId;
    const objectState = definition.states.find((candidate) => candidate.id === stateId);
    if (!objectState?.visible || !objectState.interactionShape) continue;
    const polygon = transformedObjectPolygon(scene, instance, objectState);
    if (!polygon || !pointInPolygon(point, polygon)) continue;
    const perspective = scaleAtY(scene, instance.position.y);
    hits.push({
      id: instance.id,
      layer: renderLayerOrder[instance.layer],
      elevation: instance.elevation,
      baselineY: Math.round(instance.position.y),
      zOffset: perspective.zOffset + instance.zOffset,
    });
  }
  hits.sort(
    (left, right) =>
      left.layer - right.layer ||
      left.elevation - right.elevation ||
      left.baselineY - right.baselineY ||
      left.zOffset - right.zOffset ||
      left.id.localeCompare(right.id),
  );
  return hits.at(-1)?.id ?? null;
};

const clickTargets = [
  ["scene.red-ledger.archive", { x: 138, y: 123 }, "object.red-ledger.archive.account"],
  ["scene.red-ledger.archive", { x: 88, y: 137 }, "object.red-ledger.archive.drawer"],
  ["scene.red-ledger.archive", { x: 294, y: 100 }, "object.red-ledger.archive.chapel-door"],
  ["scene.red-ledger.archive", { x: 208, y: 110 }, "object.red-ledger.archive.clerk-hotspot"],
  ["scene.red-ledger.archive", { x: 17, y: 100 }, "object.red-ledger.archive.alley-door"],
  ["scene.red-ledger.chapel", { x: 172, y: 115 }, "object.red-ledger.chapel.registry"],
  ["scene.red-ledger.chapel", { x: 15, y: 100 }, "object.red-ledger.chapel.return-door"],
  ["scene.red-ledger.alley", { x: 229, y: 120 }, "object.red-ledger.alley.ledger"],
];
for (const [sceneId, point, expectedObjectId] of clickTargets) {
  requireValue(
    hitObjectAt(gameplay, sceneId, point) === expectedObjectId,
    `Native click ${point.x},${point.y} in '${sceneId}' does not resolve to ` + `'${expectedObjectId}'.`,
  );
}
const openDoorGeometry = {
  ...gameplay,
  objectStates: {
    ...gameplay.objectStates,
    "object.red-ledger.archive.alley-door": "object-state.red-ledger.alley-door.open",
  },
};
requireValue(
  hitObjectAt(openDoorGeometry, "scene.red-ledger.archive", { x: 17, y: 100 }) ===
    "object.red-ledger.archive.alley-door",
  "The service-alley click target is lost when the door becomes open.",
);
requireValue(
  hitObjectAt(gameplay, "scene.red-ledger.chapel", { x: 250, y: 160 }) === null,
  "The chapel movement regression point is accidentally covered by a hotspot.",
);
requireValue(
  scenes
    .get("scene.red-ledger.chapel")
    ?.navigationAreas.some((area) => pointInPolygon({ x: 250, y: 160 }, area.shape)),
  "The chapel movement regression point is outside navigation.",
);

for (const composition of sceneInstances.scenes) {
  const scene = scenes.get(composition.sceneId);
  if (!scene) continue;
  for (const instance of composition.objectInstances) {
    const definition = definitions.get(instance.definitionId);
    if (!definition) continue;
    for (const state of definition.states) {
      if (!state.walkToOffset || !state.interactionShape) continue;
      const anchor = {
        x: Math.round(instance.position.x),
        y: Math.round(instance.position.y),
      };
      const perspective = scaleAtY(scene, anchor.y);
      const scale = perspective.scale * instance.scaleMultiplier;
      const walkTo = {
        x: anchor.x + state.walkToOffset.x * scale * (instance.mirrored ? -1 : 1),
        y: anchor.y + state.walkToOffset.y * scale,
      };
      requireValue(
        scene.navigationAreas.some((area) => pointInPolygon(walkTo, area.shape)),
        `Object state '${state.id}' approaches an unreachable point ` + `${walkTo.x},${walkTo.y}.`,
      );
    }
  }
}

const dialogueChoiceAt = (state, point) => {
  const skin = uiSkins.skins.find((candidate) => candidate.id === uiSkins.defaultSkinId);
  const choices = visibleDialogueChoices(state).slice(0, skin?.dialogueChoices?.maximumChoices ?? 0);
  if (!skin?.dialogueChoices || !skin.fonts.dialogue || choices.length === 0) {
    return null;
  }
  const font = bitmapFonts.fonts.find((candidate) => candidate.id === skin.fonts.dialogue.fontId);
  if (!font) return null;
  const region = skin.dialogueChoices.region;
  const content = {
    x: region.rect.x + region.padding,
    y: region.rect.y + region.padding,
    width: region.rect.width - region.padding * 2,
    height: region.rect.height - region.padding * 2,
  };
  const height = Math.max(
    font.lineHeight + 4,
    Math.floor((content.height - (choices.length - 1) * skin.dialogueChoices.gap) / choices.length),
  );
  for (let index = choices.length - 1; index >= 0; index -= 1) {
    const rect = {
      x: content.x,
      y: content.y + index * (height + skin.dialogueChoices.gap),
      width: content.width,
      height,
    };
    if (
      point.x >= rect.x &&
      point.y >= rect.y &&
      point.x < rect.x + rect.width &&
      point.y < rect.y + rect.height
    ) {
      return choices[index]?.id ?? null;
    }
  }
  return null;
};
const evidenceDialogueGeometry = {
  ...gameplay,
  flags: {
    "red-ledger.account-inspected": true,
    "red-ledger.paper-record-found": true,
    "red-ledger.chapel-proof": true,
    "red-ledger.alley-unlocked": false,
  },
  activeDialogue: {
    dialogueId: "dialogue.red-ledger.clerk",
    nodeId: "dialogue-node.red-ledger.clerk.root",
  },
};
requireValue(
  dialogueChoiceAt(evidenceDialogueGeometry, { x: 50, y: 147 }) ===
    "dialogue-choice.red-ledger.clerk.confront",
  "The integration-test confrontation click does not select its evidence topic.",
);
requireValue(
  dialogueChoiceAt(
    {
      ...evidenceDialogueGeometry,
      activeDialogue: {
        dialogueId: "dialogue.red-ledger.clerk",
        nodeId: "dialogue-node.red-ledger.clerk.confrontation",
      },
    },
    { x: 50, y: 110 },
  ) === "dialogue-choice.red-ledger.clerk.open-alley",
  "The integration-test close-dialogue click does not select Open the Service Alley.",
);

gameplay = executeObjectInteraction(gameplay, "object.red-ledger.archive.alley-door", "use");
requireValue(
  gameplay.currentSceneId === "scene.red-ledger.archive",
  "The locked alley door must not create a premature scene transition.",
);
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.archive.clerk-hotspot", "talk");
requireValue(
  canonicalJson(visibleDialogueChoices(gameplay).map((choice) => choice.id)) ===
    canonicalJson(["dialogue-choice.red-ledger.clerk.account", "dialogue-choice.red-ledger.clerk.leave"]),
  "The premature clerk interview must expose only the safe account and leave topics.",
);
gameplay = chooseDialogue(gameplay, "dialogue-choice.red-ledger.clerk.leave");
requireValue(
  gameplay.activeDialogue === null,
  "The premature interview must remain recoverable through the leave topic.",
);

gameplay = executeObjectInteraction(gameplay, "object.red-ledger.archive.account", "look");
const accountScore = gameplay.score;
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.archive.account", "look");
requireValue(gameplay.score === accountScore, "Repeated account inspection must not duplicate score.");
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.archive.drawer", "use");
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.archive.chapel-door", "use");
requireValue(
  gameplay.currentSceneId === "scene.red-ledger.chapel",
  "The archive chapel door did not enter the chapel.",
);
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.chapel.registry", "look");
const chapelScore = gameplay.score;
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.chapel.registry", "look");
requireValue(gameplay.score === chapelScore, "Repeated chapel research must not duplicate score.");
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.chapel.return-door", "use");
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.archive.clerk-hotspot", "talk");
requireValue(
  visibleDialogueChoices(gameplay).some(
    (choice) => choice.id === "dialogue-choice.red-ledger.clerk.confront",
  ),
  "The contradiction topic must unlock after all three evidence steps.",
);
gameplay = chooseDialogue(gameplay, "dialogue-choice.red-ledger.clerk.confront");
requireValue(
  gameplay.flags["red-ledger.alley-unlocked"] === true &&
    gameplay.objectStates["object.red-ledger.archive.alley-door"] ===
      "object-state.red-ledger.alley-door.open",
  "The confrontation did not visibly unlock the service alley.",
);
gameplay = chooseDialogue(gameplay, "dialogue-choice.red-ledger.clerk.open-alley");
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.archive.alley-door", "use");
requireValue(
  gameplay.currentSceneId === "scene.red-ledger.alley",
  "The unlocked service door did not enter the alley.",
);
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.alley.ledger", "look");
const completionScore = gameplay.score;
gameplay = executeObjectInteraction(gameplay, "object.red-ledger.alley.ledger", "look");
requireValue(gameplay.score === completionScore, "Repeated resolution inspection must not duplicate score.");
requireValue(
  gameplay.flags["red-ledger.slice-complete"] === true,
  "The final ledger did not mark the slice complete.",
);
requireValue(gameplay.score === 100, `Playable flow reached ${gameplay.score}, not 100 points.`);
requireValue(
  canonicalJson(gameplay.inventory) ===
    canonicalJson(["item.red-ledger.harbour-record", "item.red-ledger.chapel-copy"]),
  "Playable flow did not preserve the two physical evidence items in order.",
);
requireValue(
  gameplay.awardedScoreIds.length === 5,
  "Playable flow did not preserve five unique score awards.",
);
requireValue(
  canonicalJson(JSON.parse(JSON.stringify(gameplay))) === canonicalJson(gameplay),
  "Playable state is not stable through a JSON save-and-restore round trip.",
);

if (errors.length > 0) {
  console.error(`Red Ledger runtime validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        projectId,
        assets: project.assets.length,
        scenes: project.scenes.length,
        actors: project.actors.length,
        objectDefinitions: sceneInstances.objectDefinitions.length,
        dialogueNodes: project.dialogues.reduce((total, dialogue) => total + dialogue.nodes.length, 0),
        glyphs: bitmapFonts.fonts.reduce((total, font) => total + font.glyphs.length, 0),
        bundleBytes: statSync(join(demoDirectory, "runtime.bundle.json")).size,
        status: "valid",
      },
      null,
      2,
    ),
  );
}
