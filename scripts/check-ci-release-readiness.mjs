#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] || "--source";
if (!new Set(["--source", "--full"]).has(mode)) {
  throw new Error("Use --source or --full.");
}

const sourceErrors = [];
const fullErrors = [];
const expected = {
  node: "24.18.0",
  pnpm: "11.17.0",
  nodeEngine: ">=24.18.0 <25",
  pnpmEngine: ">=11.17.0 <12",
};

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  const target = absolute(relativePath);
  if (!fs.existsSync(target)) {
    sourceErrors.push(`${relativePath}: required release source is missing`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function parseJson(relativePath, source) {
  try {
    return JSON.parse(source);
  } catch {
    sourceErrors.push(`${relativePath}: must remain valid JSON`);
    return {};
  }
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) sourceErrors.push(`${label}: missing ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) sourceErrors.push(`${label}: contains forbidden ${token}`);
  }
}

function events(source) {
  const lines = source.split(/\r?\n/);
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === "on:") starts.push(index);
  }
  if (starts.length !== 1) return [];
  const values = [];
  for (let index = starts[0] + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line && !/^\s/.test(line)) break;
    const match = line.match(/^  ([A-Za-z_][A-Za-z0-9_-]*):/);
    if (match) values.push(match[1]);
  }
  return [...new Set(values)].sort();
}

function actions(source) {
  const values = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*uses:\s*([^\s#]+)/);
    if (match) values.push(match[1].replace(/^['"]|['"]$/g, ""));
  }
  return values;
}

function packageFiles(directory = ROOT) {
  const excluded = new Set([
    ".git",
    ".turbo",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "reports",
  ]);
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...packageFiles(target));
    else if (entry.isFile() && entry.name === "package.json") found.push(target);
  }
  return found.sort();
}

const packageSource = read("package.json");
const packageJson = parseJson("package.json", packageSource);
const nodeVersion = read(".node-version").trim();
const nvmVersion = read(".nvmrc").trim();
const workspaceSource = read("pnpm-workspace.yaml");
const ciSource = read(".github/workflows/ci.yml");
const editorSource = read(".github/workflows/editor-expansion-ci.yml");
const editorRunnerSource = read("scripts/run-editor-expansion-check.mjs");

if (packageJson.name !== "evavo-adventure-studio" || packageJson.private !== true) {
  sourceErrors.push("package.json: root identity or private boundary has drifted");
}
if (packageJson.packageManager !== `pnpm@${expected.pnpm}`) {
  sourceErrors.push(`package.json: packageManager must equal pnpm@${expected.pnpm}`);
}
if (packageJson.engines?.node !== expected.nodeEngine) {
  sourceErrors.push(`package.json: engines.node must equal ${expected.nodeEngine}`);
}
if (packageJson.engines?.pnpm !== expected.pnpmEngine) {
  sourceErrors.push(`package.json: engines.pnpm must equal ${expected.pnpmEngine}`);
}
if (nodeVersion !== expected.node || nvmVersion !== expected.node) {
  sourceErrors.push(`.node-version and .nvmrc must both equal ${expected.node}`);
}

const expectedScripts = {
  "release:check": "node scripts/check-ci-release-readiness.mjs --full",
  "source:check":
    "node scripts/check-ci-release-readiness.mjs --source && pnpm run check:toolchain",
  "check:editor-expansion":
    "pnpm run release:check && node scripts/run-editor-expansion-check.mjs",
  check:
    "pnpm run release:check && pnpm run check:toolchain && biome check . && tsc -b --pretty false && vitest run && pnpm run build:player && pnpm run build:studio",
  "check:ci":
    "pnpm run release:check && pnpm run check:toolchain && biome ci . && tsc -b --pretty false && vitest run && pnpm run build:player && pnpm run build:studio",
};
for (const [name, command] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[name] !== command) {
    sourceErrors.push(`package.json: ${name} must equal the reviewed release command`);
  }
}

requireTokens("pnpm-workspace.yaml", workspaceSource, [
  '  - "apps/*"',
  '  - "packages/*"',
  '  - "tools/*"',
  "linkWorkspacePackages: false",
  "sharedWorkspaceLockfile: true",
  "disallowWorkspaceCycles: true",
]);

const immutableAction =
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?@[0-9a-f]{40}$/;
for (const [name, source, requiredScope] of [
  ["ci.yml", ciSource, "validation_scope:"],
  ["editor-expansion-ci.yml", editorSource, "check:editor-expansion"],
]) {
  const observedEvents = events(source);
  if (observedEvents.length !== 1 || observedEvents[0] !== "workflow_dispatch") {
    sourceErrors.push(`${name}: must be workflow_dispatch only, found ${JSON.stringify(observedEvents)}`);
  }
  requireTokens(name, source, [
    "expected_sha:",
    "request_source:",
    "default: evavo-development-studio",
    "runner_os:",
    "ubuntu-24.04",
    "windows-2022",
    "permissions:\n  contents: read",
    "cancel-in-progress: false",
    "actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    "persist-credentials: false",
    "node-version-file: .nvmrc",
    `corepack prepare pnpm@${expected.pnpm} --activate`,
    "node scripts/check-ci-release-readiness.mjs --full",
    "pnpm install --frozen-lockfile",
    "git merge-base --is-ancestor",
    "git diff --exit-code",
    '"deployment": "disabled"',
    requiredScope,
  ]);
  forbidTokens(name, source, [
    "push:",
    "pull_request:",
    "schedule:",
    "workflow_run:",
    "matrix:",
    "pnpm install --no-frozen-lockfile",
    "pnpm/action-setup@",
    "contents: write",
    "statuses: write",
    "actions: write",
    "deployments: write",
    "id-token: write",
    "secrets.",
    "git push",
    "git reset --hard",
    "git clean -",
    "vercel deploy",
    "wrangler deploy",
    "npm publish",
    "pnpm publish",
  ]);
  for (const action of actions(source)) {
    if (!immutableAction.test(action)) {
      sourceErrors.push(`${name}: action is not immutable: ${action}`);
    }
  }
}

requireTokens("ci.yml", ciSource, [
  "validation_scope:",
  "source-contracts",
  "complete-workspace",
  "pnpm source:check",
  "pnpm run check:ci",
]);
requireTokens("editor-expansion-ci.yml", editorSource, [
  "pnpm run check:editor-expansion",
]);
requireTokens("editor expansion runner", editorRunnerSource, [
  '"run", "check:toolchain"',
  '"exec", "tsc", "-b", "tsconfig.editor-expansion.json"',
  '"exec",\n    "vitest",\n    "run"',
  '"--filter", "@evavo/adventure-player", "build"',
  '"--filter", "@evavo/adventure-studio-app", "build"',
  '"--filter", "@evavo/adventure-timeline-lab", "build"',
  '"--filter", "@evavo/adventure-cli", "build"',
]);

for (const packagePath of packageFiles()) {
  const relativePath = path.relative(ROOT, packagePath).replaceAll("\\", "/");
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch {
    sourceErrors.push(`${relativePath}: must remain valid JSON`);
    continue;
  }
  for (const group of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    for (const [dependency, specification] of Object.entries(manifest[group] ?? {})) {
      if (specification === "latest") {
        sourceErrors.push(`${relativePath}: ${group}.${dependency} must not use latest`);
      }
      if (typeof specification === "string" && specification.startsWith("file:")) {
        sourceErrors.push(`${relativePath}: ${group}.${dependency} must not use file:`);
      }
    }
  }
}

const lockPath = absolute("pnpm-lock.yaml");
const lockfilePresent = fs.existsSync(lockPath);
if (!lockfilePresent) {
  fullErrors.push("pnpm-lock.yaml: missing; installed workspace verification is blocked");
} else {
  const lockSource = fs.readFileSync(lockPath, "utf8");
  if (!/^lockfileVersion:\s*\S+\s*$/m.test(lockSource)) {
    fullErrors.push("pnpm-lock.yaml: lockfileVersion is missing");
  }
  if (!/^importers:\s*$/m.test(lockSource) || !/^\s{2}\.\s*:\s*$/m.test(lockSource)) {
    fullErrors.push("pnpm-lock.yaml: root workspace importer is missing");
  }
}

const sourceReady = sourceErrors.length === 0;
const fullReady = sourceReady && fullErrors.length === 0;
const report = {
  contract: "evavo_adventure_studio_ci_release_readiness_v1",
  repository: "EVAVO-STUDIO/evavo-adventure-studio",
  mode: mode.slice(2),
  node: expected.node,
  pnpm: expected.pnpm,
  sourceReady,
  fullReady,
  lockfilePresent,
  automaticWorkflowRunsAllowed: false,
  oneRunnerPerDispatch: true,
  dependencyInstallPerformed: false,
  providerMutationPerformed: false,
  deploymentPerformed: false,
  sourceErrors,
  fullErrors,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!sourceReady || (mode === "--full" && !fullReady)) process.exitCode = 1;
