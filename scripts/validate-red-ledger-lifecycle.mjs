import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demo = join(root, "apps/player/public/demos/the-red-ledger");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const text = (path) => readFileSync(join(root, path), "utf8");
const source = json(join(demo, "source-manifests.json"));
const bundle = json(join(demo, "runtime.bundle.json"));
const frontEnd = json(join(demo, "front-end.json"));
const lifecycle = json(join(demo, "lifecycle.json"));
const plan = json(join(demo, "playtest-plan.json"));
const files = {
  demos: text("apps/player/src/built-in-demos.ts"),
  loader: text("apps/player/src/runtime-loader.ts"),
  controller: text("apps/player/src/packaged-controller.ts"),
  bridge: text("apps/player/src/playtest-automation.ts"),
  journey: text("apps/player/tests/red-ledger-playable-slice.test.mjs"),
  bridgeTest: text("apps/player/tests/playtest-automation.test.ts"),
  planTest: text("apps/player/tests/red-ledger-playtest-plan.test.mjs"),
  compatibility: text("apps/player/tests/runtime-controller-compatibility.test.ts"),
  compiler: text("packages/compiler/src/with-lifecycle.ts"),
  docs: text("docs/browser-playtest-automation.md"),
};
const errors = [];
const requireValue = (condition, message) => {
  if (!condition) errors.push(message);
};
const isRecord = (value) => value && typeof value === "object" && !Array.isArray(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exactKeys = (value, expected) =>
  isRecord(value) && same(Object.keys(value).sort(), [...expected].sort());
const boundedText = (value, max) =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const requireTokens = (label, sourceText, tokens) => {
  for (const token of tokens) {
    requireValue(sourceText.includes(token), `${label} is missing '${token}'.`);
  }
};

const projectId = "project.red-ledger.playable-slice";
requireValue(lifecycle?.manifestVersion === 1, "Lifecycle manifestVersion must equal 1.");
requireValue(lifecycle?.projectId === projectId, "Lifecycle project ID has drifted.");
requireValue(source?.project?.id === projectId, "Source project ID has drifted.");
requireValue(bundle?.projectId === projectId, "Runtime project ID has drifted.");
requireValue(
  bundle.lifecycle === undefined,
  "The checked-in bundle must not duplicate the lifecycle sidecar.",
);
requireValue(
  bundle.localisation === undefined,
  "A localised bundle must embed lifecycle through compileProjectWithLifecycle.",
);
requireValue(lifecycle?.outcomes?.length === 1, "Red Ledger must expose one terminal outcome.");

const outcome = lifecycle?.outcomes?.[0];
requireValue(
  exactKeys(outcome, ["id", "kind", "priority", "when", "title", "message", "menu"]),
  "Lifecycle outcome fields have drifted.",
);
requireValue(outcome?.id === "outcome.red-ledger.case-proved", "Success outcome ID has drifted.");
requireValue(outcome?.kind === "success", "The terminal outcome must be a success.");
requireValue(
  Number.isInteger(outcome?.priority) && outcome.priority >= -1000 && outcome.priority <= 1000,
  "Lifecycle priority is invalid.",
);
requireValue(
  outcome?.when?.kind === "flag" &&
    outcome.when.flag === "red-ledger.slice-complete" &&
    outcome.when.equals === true,
  "The outcome must use the exact completion flag.",
);
requireValue(boundedText(outcome?.title, 96), "Lifecycle title is invalid.");
requireValue(boundedText(outcome?.message, 320), "Lifecycle message is invalid.");
const menu = outcome?.menu;
requireValue(
  exactKeys(menu, ["allowQuickRetry", "allowLoad", "allowRestart", "allowTitle", "labels"]),
  "Lifecycle menu fields have drifted.",
);
requireValue(menu?.allowQuickRetry === false, "Success must not expose Quick Retry.");
requireValue(menu?.allowLoad === true, "Success must allow loading a compatible save.");
requireValue(menu?.allowRestart === true, "Success must allow a clean restart.");
requireValue(menu?.allowTitle === true, "Success must allow return to title.");
const menuLabels = ["quickRetry", "loadGame", "restartGame", "returnToTitle", "back"];
requireValue(exactKeys(menu?.labels, menuLabels), "Lifecycle menu labels are incomplete.");
for (const key of menuLabels) {
  requireValue(boundedText(menu?.labels?.[key], 48), `Lifecycle menu label '${key}' is invalid.`);
}

const actions = [];
for (const scene of source?.project?.scenes ?? []) {
  for (const hotspot of scene.hotspots ?? []) {
    for (const interaction of hotspot.interactions ?? []) actions.push(...(interaction.actions ?? []));
  }
}
for (const dialogue of source?.project?.dialogues ?? []) {
  for (const node of dialogue.nodes ?? []) {
    actions.push(...(node.enterActions ?? []), ...(node.exitActions ?? []));
    for (const choice of node.choices ?? []) actions.push(...(choice.actions ?? []));
  }
}
for (const definition of source?.sceneInstances?.objectDefinitions ?? []) {
  for (const state of definition.states ?? []) {
    for (const interaction of state.interactions ?? []) actions.push(...(interaction.actions ?? []));
  }
}
const completionSetters = actions.filter(
  (action) =>
    action?.kind === "set-flag" &&
    action.flag === "red-ledger.slice-complete" &&
    action.value === true,
);
requireValue(
  completionSetters.length === 1,
  `The completion flag must have one authoritative setter, found ${completionSetters.length}.`,
);
requireValue(outcome?.when?.equals === true, "The outcome activates before completion.");

requireValue(
  exactKeys(plan, ["planVersion", "projectId", "route", "shell", "runtime"]),
  "Playtest plan fields have drifted.",
);
requireValue(plan?.planVersion === 1, "Playtest plan version must equal 1.");
requireValue(plan?.projectId === projectId, "Playtest plan project ID has drifted.");
requireValue(
  plan?.route === "/?demo=red-ledger&playtest=1",
  "The playtest route must select the built-in demo and explicitly enable the bridge.",
);
requireValue(
  exactKeys(plan?.shell, ["capture", "title", "primaryAction"]),
  "Playtest shell fields have drifted.",
);
requireValue(plan?.shell?.title === bundle?.title, "Playtest shell title does not match the bundle.");
requireValue(
  plan?.shell?.primaryAction === frontEnd?.menu?.labels?.newGame,
  "Playtest shell action does not match the front end.",
);
requireValue(
  exactKeys(plan?.runtime, ["actorInstanceId", "maxSettleTicks", "steps"]),
  "Playtest runtime fields have drifted.",
);
requireValue(
  plan?.runtime?.actorInstanceId === "actor-instance.red-ledger.archivist",
  "The playtest must control the persistent archivist.",
);
requireValue(
  Number.isSafeInteger(plan?.runtime?.maxSettleTicks) &&
    plan.runtime.maxSettleTicks >= 1 &&
    plan.runtime.maxSettleTicks <= 10_000,
  "The playtest settlement bound is invalid.",
);
const actorPlacements = (source?.sceneInstances?.scenes ?? []).flatMap(
  (scene) => scene.actorInstances ?? [],
);
requireValue(
  actorPlacements.filter((actor) => actor.id === plan?.runtime?.actorInstanceId).length === 1,
  "The playtest actor must have one authoritative placement.",
);

const steps = Array.isArray(plan?.runtime?.steps) ? plan.runtime.steps : [];
const expectedStepIds = [
  "archive-start",
  "inspect-impossible-account",
  "open-harbour-drawer",
  "archive-evidence",
  "enter-river-chapel",
  "chapel-arrival",
  "stage-in-chapel",
  "chapel-staging",
  "inspect-chapel-registry",
  "chapel-proof",
  "return-to-archive",
  "question-night-clerk",
  "clerk-interview",
  "prove-contradiction",
  "contradiction-proved",
  "close-clerk-interview",
  "enter-service-alley",
  "black-alley",
  "inspect-contradiction-ledger",
  "case-proved",
];
requireValue(same(steps.map((step) => step?.id), expectedStepIds), "Playtest step order has drifted.");
requireValue(
  new Set(steps.map((step) => step?.id)).size === steps.length,
  "Playtest step IDs must be unique.",
);
const allowedExpectations = new Set([
  "sceneId",
  "score",
  "inventory",
  "flags",
  "objectStates",
  "activeDialogueNodeId",
  "lifecycleOutcomeId",
  "statusText",
  "controlledActor",
]);
const activations = [];
const checkpoints = [];
for (const [index, step] of steps.entries()) {
  requireValue(isRecord(step), `Playtest step ${index} must be an object.`);
  requireValue(boundedText(step?.id, 96), `Playtest step ${index} has an invalid ID.`);
  if (step?.kind === "activate") {
    requireValue(exactKeys(step, ["id", "kind", "position"]), `Activation '${step.id}' fields have drifted.`);
    const point = step.position;
    requireValue(
      isRecord(point) &&
        exactKeys(point, ["x", "y"]) &&
        Number.isInteger(point.x) &&
        Number.isInteger(point.y) &&
        point.x >= 0 &&
        point.y >= 0 &&
        point.x < bundle.presentation.nativeWidth &&
        point.y < bundle.presentation.nativeHeight,
      `Activation step '${step.id}' is outside the native canvas.`,
    );
    activations.push(step);
    continue;
  }
  requireValue(step?.kind === "checkpoint", `Playtest step '${step?.id}' has an invalid kind.`);
  requireValue(
    exactKeys(step, step?.capture ? ["id", "kind", "capture", "expect"] : ["id", "kind", "expect"]),
    `Checkpoint '${step?.id}' fields have drifted.`,
  );
  requireValue(isRecord(step?.expect), `Checkpoint '${step?.id}' must define expectations.`);
  requireValue(
    Object.keys(step?.expect ?? {}).every((key) => allowedExpectations.has(key)),
    `Checkpoint '${step?.id}' has an unsupported expectation.`,
  );
  if (step?.capture !== undefined) {
    requireValue(boundedText(step.capture, 96), `Checkpoint '${step.id}' has an invalid capture label.`);
  }
  checkpoints.push(step);
}
const expectedActivations = [
  ["inspect-impossible-account", 138, 123],
  ["open-harbour-drawer", 88, 137],
  ["enter-river-chapel", 294, 100],
  ["stage-in-chapel", 250, 160],
  ["inspect-chapel-registry", 172, 115],
  ["return-to-archive", 15, 100],
  ["question-night-clerk", 208, 110],
  ["prove-contradiction", 50, 147],
  ["close-clerk-interview", 50, 110],
  ["enter-service-alley", 17, 100],
  ["inspect-contradiction-ledger", 229, 120],
];
requireValue(
  same(
    activations.map((step) => [step.id, step.position?.x, step.position?.y]),
    expectedActivations,
  ),
  "The Red Ledger native activation journey has drifted.",
);
const expectedCaptures = [
  "red-ledger-00-title",
  "red-ledger-01-archive-start",
  "red-ledger-02-archive-evidence",
  "red-ledger-03-river-chapel",
  "red-ledger-04-chapel-proof",
  "red-ledger-05-clerk-interview",
  "red-ledger-06-contradiction",
  "red-ledger-07-black-alley",
  "red-ledger-08-case-proved",
];
const captures = [
  plan?.shell?.capture,
  ...checkpoints.flatMap((step) => (step.capture ? [step.capture] : [])),
];
requireValue(same(captures, expectedCaptures), "The Red Ledger retained capture boundaries have drifted.");
requireValue(new Set(captures).size === captures.length, "Playtest capture labels must be unique.");
const finalCheckpoint = checkpoints.at(-1);
requireValue(finalCheckpoint?.id === "case-proved", "The final checkpoint must prove the case.");
requireValue(
  finalCheckpoint?.expect?.flags?.["red-ledger.slice-complete"] === true &&
    finalCheckpoint?.expect?.lifecycleOutcomeId === outcome?.id &&
    finalCheckpoint?.expect?.statusText === outcome?.title &&
    finalCheckpoint?.expect?.score === 100,
  "The final checkpoint does not prove the governed terminal state.",
);

for (const [label, sourceText, tokens] of [
  [
    "built-in demo registry",
    files.demos,
    [
      'bundlePath: "/demos/the-red-ledger/runtime.bundle.json"',
      'lifecyclePath: "lifecycle.json"',
      'hash.set("lifecycle", descriptor.lifecyclePath)',
    ],
  ],
  [
    "runtime loader",
    files.loader,
    [
      "runtimeBundleRequestFromUrl",
      'hash.get("lifecycle")',
      'type RuntimeBundleSidecarKey = "frontEnd" | "lifecycle"',
      "attachRuntimeSidecar",
      "Object.hasOwn(input, sidecar)",
      '"lifecycle",',
      "await fetchJson(request.lifecycleUrl, fetchBundle)",
    ],
  ],
  [
    "packaged controller",
    files.controller,
    [
      "resolveActiveGameLifecycleOutcome",
      "runGameLifecycleScreen",
      "function checkLifecycle()",
      "function restartInitialState()",
      "function openLifecycle(outcome: GameLifecycleOutcome)",
      "installPlayerPlaytestBridge",
      "PlayerPlaytestWindow",
      "const playerController: PackagedRuntimeController",
      "return playerController",
    ],
  ],
  [
    "browser playtest bridge",
    files.bridge,
    [
      'PLAYER_PLAYTEST_GLOBAL = "__EVAVO_ADVENTURE_PLAYTEST__"',
      "playerPlaytestAutomationRequested",
      "createPlayerPlaytestBridge",
      "activateAndSettle",
      "motionSettled",
      "outside the native",
      "did not settle within",
    ],
  ],
  [
    "browser playtest bridge tests",
    files.bridgeTest,
    [
      'playerPlaytestAutomationRequested("?playtest=1")',
      "bridge.activateAndSettle",
      'lifecycleOutcomeId: "outcome.complete"',
      "installPlayerPlaytestBridge",
      "did not settle within 2 ticks",
    ],
  ],
  [
    "Red Ledger browser playtest plan tests",
    files.planTest,
    [
      'readJson("playtest-plan.json")',
      "createPlayerPlaytestBridge",
      "createReplayLog",
      "executeReplay",
      "expect(run.events).toHaveLength(11)",
      "expect(result.finalSave).toEqual(run.finalSave)",
      'expect(replayController.statusText()).toBe("CASE PROVED")',
    ],
  ],
  [
    "playable terminal journey",
    files.journey,
    [
      '"../src/packaged-controller.js"',
      '"../public/demos/the-red-ledger/lifecycle.json"',
      "resolveActiveGameLifecycleOutcome",
      'expect(controller.statusText()).toBe("CASE PROVED")',
      "expect(controller.worldState()).toEqual(completed)",
      "restored.createFrame(completed.story.tick)",
    ],
  ],
  [
    "controller compatibility boundary",
    files.compatibility,
    [
      "SharedPackagedRuntimeController",
      "PlayerPackagedRuntimeController",
      "expect(playerController).not.toBe(sharedController)",
    ],
  ],
  [
    "canonical lifecycle compiler",
    files.compiler,
    [
      "attachRuntimeLifecycle",
      "compileProjectWithLifecycle",
      "extendRuntimeLocalisationPack",
      "extractLifecycleLocalisableText",
    ],
  ],
  [
    "browser playtest documentation",
    files.docs,
    [
      "Godot Game Test Lab",
      "window.__EVAVO_ADVENTURE_PLAYTEST__",
      "activateAndSettle",
      "playtest-plan.json",
      "The bridge does not itself claim that screenshots were taken.",
    ],
  ],
]) {
  requireTokens(label, sourceText, tokens);
}
requireValue(
  !files.compatibility.includes("expect(playerController).toBe(sharedController)"),
  "Controller compatibility still requires the Player wrapper to equal the shared controller.",
);

if (errors.length > 0) {
  console.error(`Red Ledger lifecycle validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        projectId,
        outcomeId: outcome.id,
        completionFlag: outcome.when.flag,
        terminalKind: outcome.kind,
        sidecar: "lifecycle.json",
        controllerIntegration: "verified",
        playtestBridge: "opt-in",
        playtestActivations: activations.length,
        captureBoundaries: captures.length,
        replayClosure: "covered",
        status: "valid",
      },
      null,
      2,
    ),
  );
}
