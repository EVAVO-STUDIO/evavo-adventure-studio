#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const commands = [
  ["run", "check:toolchain"],
  ["exec", "tsc", "-b", "tsconfig.editor-expansion.json", "--pretty", "false"],
  [
    "exec",
    "vitest",
    "run",
    "packages/editor-core/tests",
    "packages/project-editor-core/tests",
    "packages/dialogue-editor-core/tests",
    "packages/sequence-editor-core/tests",
    "packages/narrative-library-editor-core/tests",
    "packages/animation-editor-core/tests",
    "packages/art-direction/tests",
    "packages/adventure-design/tests",
    "packages/play-feel/tests",
    "packages/bitmap-font/tests",
    "packages/bitmap-font-editor-core/tests",
    "packages/ui-skin/tests",
    "packages/ui-skin-editor-core/tests",
    "packages/save-game/tests",
    "packages/replay/tests",
    "packages/runtime-controller/tests",
    "packages/scene-runtime/tests",
    "packages/playtest-inspector/tests",
    "packages/asset-pipeline/tests/art-evidence.test.ts",
    "packages/compiler/tests/bitmap-font-compilation.test.ts",
    "packages/compiler/tests/ui-skin-compilation.test.ts",
    "packages/runtime-bundle/tests/bitmap-font-runtime.test.ts",
    "packages/runtime-bundle/tests/ui-skin-runtime.test.ts",
    "packages/renderer-pixi/tests",
    "apps/player/tests",
    "apps/studio/tests",
    "apps/timeline-lab/tests",
    "tools/cli/tests",
  ],
  ["--filter", "@evavo/adventure-player", "build"],
  ["--filter", "@evavo/adventure-studio-app", "build"],
  ["--filter", "@evavo/adventure-timeline-lab", "build"],
  ["--filter", "@evavo/adventure-cli", "build"],
];

for (const args of commands) {
  process.stdout.write(`==> ${pnpm} ${args.join(" ")}\n`);
  const result = spawnSync(pnpm, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.signal) {
    throw new Error(`${pnpm} ${args.join(" ")} ended with ${result.signal}.`);
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
