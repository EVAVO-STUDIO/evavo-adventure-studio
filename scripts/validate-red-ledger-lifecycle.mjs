import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demoDirectory = join(repository, "apps/player/public/demos/the-red-ledger");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const source = readJson(join(demoDirectory, "source-manifests.json"));
const bundle = readJson(join(demoDirectory, "runtime.bundle.json"));
const lifecycle = readJson(join(demoDirectory, "lifecycle.json"));
const builtInDemosSource = readFileSync(join(repository, "apps/player/src/built-in-demos.ts"), "utf8");
const runtimeLoaderSource = readFileSync(join(repository, "apps/player/src/runtime-loader.ts"), "utf8");
const packagedControllerSource = readFileSync(
  join(repository, "apps/player/src/packaged-controller.ts"),
  "utf8",
);
const playableSliceTestSource = readFileSync(
  join(repository, "apps/player/tests/red-ledger-playable-slice.test.mjs"),
  "utf8",
);
const controllerCompatibilityTestSource = readFileSync(
  join(repository, "apps/player/tests/runtime-controller-compatibility.test.ts"),
  "utf8",
);
const lifecycleCompilerSource = readFileSync(
  join(repository, "packages/compiler/src/with-lifecycle.ts"),
  "utf8",
);
const errors = [];

const requireValue = (condition, message) => {
  if (!condition) errors.push(message);
};
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, expected) =>
  record(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());

const projectId = "project.red-ledger.playable-slice";
requireValue(lifecycle?.manifestVersion === 1, "Lifecycle manifestVersion must equal 1.");
requireValue(lifecycle?.projectId === projectId, "Lifecycle manifest has the wrong project ID.");
requireValue(source?.project?.id === projectId, "Red Ledger source project ID has drifted.");
requireValue(bundle?.projectId === projectId, "Red Ledger runtime project ID has drifted.");
requireValue(
  bundle.lifecycle === undefined,
  "The checked-in bundle must not also define lifecycle while the built-in sidecar contract is active.",
);
requireValue(
  bundle.localisation === undefined,
  "A localised Red Ledger bundle must embed lifecycle through " +
    "compileProjectWithLifecycle instead of a sidecar.",
);
requireValue(
  Array.isArray(lifecycle?.outcomes) && lifecycle.outcomes.length === 1,
  "Red Ledger must expose exactly one governed terminal outcome.",
);

const outcome = lifecycle?.outcomes?.[0];
requireValue(
  exactKeys(outcome, ["id", "kind", "priority", "when", "title", "message", "menu"]),
  "The Red Ledger lifecycle outcome has missing or unexpected fields.",
);
requireValue(
  outcome?.id === "outcome.red-ledger.case-proved",
  "The Red Ledger success outcome ID has drifted.",
);
requireValue(outcome?.kind === "success", "The Red Ledger terminal outcome must be a success.");
requireValue(
  Number.isInteger(outcome?.priority) && outcome.priority >= -1000 && outcome.priority <= 1000,
  "The Red Ledger lifecycle priority is outside the supported range.",
);
requireValue(
  outcome?.when?.kind === "flag" &&
    outcome.when.flag === "red-ledger.slice-complete" &&
    outcome.when.equals === true,
  "The Red Ledger outcome must be gated by the exact completion flag.",
);
requireValue(
  typeof outcome?.title === "string" && outcome.title.length > 0 && outcome.title.length <= 96,
  "The Red Ledger lifecycle title is invalid.",
);
requireValue(
  typeof outcome?.message === "string" && outcome.message.length > 0 && outcome.message.length <= 320,
  "The Red Ledger lifecycle message is invalid.",
);

const menu = outcome?.menu;
requireValue(
  exactKeys(menu, ["allowQuickRetry", "allowLoad", "allowRestart", "allowTitle", "labels"]),
  "The Red Ledger lifecycle menu has missing or unexpected fields.",
);
requireValue(menu?.allowQuickRetry === false, "Success must not expose a misleading Quick Retry.");
requireValue(menu?.allowLoad === true, "Success must allow reopening a compatible save.");
requireValue(menu?.allowRestart === true, "Success must allow a clean restart.");
requireValue(menu?.allowTitle === true, "Success must allow return to title.");
const expectedLabels = ["quickRetry", "loadGame", "restartGame", "returnToTitle", "back"];
requireValue(exactKeys(menu?.labels, expectedLabels), "Lifecycle menu labels are incomplete.");
for (const label of expectedLabels) {
  const value = menu?.labels?.[label];
  requireValue(
    typeof value === "string" && value.length > 0 && value.length <= 48,
    `Lifecycle menu label '${label}' is invalid.`,
  );
}

const allActions = [];
for (const scene of source?.project?.scenes ?? []) {
  for (const hotspot of scene.hotspots ?? []) {
    for (const interaction of hotspot.interactions ?? []) {
      allActions.push(...(interaction.actions ?? []));
    }
  }
}
for (const dialogue of source?.project?.dialogues ?? []) {
  for (const node of dialogue.nodes ?? []) {
    allActions.push(...(node.enterActions ?? []), ...(node.exitActions ?? []));
    for (const choice of node.choices ?? []) allActions.push(...(choice.actions ?? []));
  }
}
for (const definition of source?.sceneInstances?.objectDefinitions ?? []) {
  for (const state of definition.states ?? []) {
    for (const interaction of state.interactions ?? []) {
      allActions.push(...(interaction.actions ?? []));
    }
  }
}
const completionSetters = allActions.filter(
  (action) =>
    action?.kind === "set-flag" &&
    action.flag === "red-ledger.slice-complete" &&
    action.value === true,
);
requireValue(
  completionSetters.length === 1,
  `The completion flag must have one authoritative setter, found ${completionSetters.length}.`,
);

const evaluate = (condition, flags) => {
  if (!condition) return true;
  switch (condition.kind) {
    case "always":
      return true;
    case "flag":
      return (flags[condition.flag] ?? false) === condition.equals;
    case "all":
      return condition.conditions.every((child) => evaluate(child, flags));
    case "any":
      return condition.conditions.some((child) => evaluate(child, flags));
    case "not":
      return !evaluate(condition.condition, flags);
    default:
      return false;
  }
};
requireValue(
  evaluate(outcome?.when, {}) === false,
  "The lifecycle outcome activates before the case is complete.",
);
requireValue(
  evaluate(outcome?.when, { "red-ledger.slice-complete": true }) === true,
  "The lifecycle outcome does not activate after the completion flag is set.",
);

for (const [label, sourceText, tokens] of [
  [
    "built-in demo registry",
    builtInDemosSource,
    [
      'bundlePath: "/demos/the-red-ledger/runtime.bundle.json"',
      'lifecyclePath: "lifecycle.json"',
      'hash.set("lifecycle", descriptor.lifecyclePath)',
    ],
  ],
  [
    "runtime loader",
    runtimeLoaderSource,
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
    packagedControllerSource,
    [
      "resolveActiveGameLifecycleOutcome",
      "runGameLifecycleScreen",
      "function checkLifecycle()",
      "function restartInitialState()",
      "function openLifecycle(outcome: GameLifecycleOutcome)",
    ],
  ],
  [
    "playable terminal journey",
    playableSliceTestSource,
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
    controllerCompatibilityTestSource,
    [
      "SharedPackagedRuntimeController",
      "PlayerPackagedRuntimeController",
      "expect(playerController).not.toBe(sharedController)",
    ],
  ],
  [
    "canonical lifecycle compiler",
    lifecycleCompilerSource,
    [
      "attachRuntimeLifecycle",
      "compileProjectWithLifecycle",
      "extendRuntimeLocalisationPack",
      "extractLifecycleLocalisableText",
    ],
  ],
]) {
  for (const token of tokens) {
    requireValue(sourceText.includes(token), `${label} is missing '${token}'.`);
  }
}
requireValue(
  !controllerCompatibilityTestSource.includes("expect(playerController).toBe(sharedController)"),
  "Controller compatibility test still requires the lifecycle wrapper to equal the shared controller.",
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
        status: "valid",
      },
      null,
      2,
    ),
  );
}
