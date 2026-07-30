#!/usr/bin/env node

import { runCli } from "./runner.js";
import {
  RUNTIME_ARTIFACT_HELP,
  runRuntimeArtifactCli,
} from "./runtime-artifacts.js";

const argv = process.argv.slice(2);
const runtimeArtifactExitCode = await runRuntimeArtifactCli(argv);
if (runtimeArtifactExitCode !== null) {
  process.exitCode = runtimeArtifactExitCode;
} else {
  process.exitCode = await runCli(argv);
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(`\n${RUNTIME_ARTIFACT_HELP}`);
  }
}
