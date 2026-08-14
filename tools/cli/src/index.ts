#!/usr/bin/env node

import {
  LOCALISATION_HELP,
  runLocalisationCli,
} from "./localisation-cli.js";
import { REPLAY_EXECUTE_HELP, runReplayExecuteCli } from "./replay-execute.js";
import { runCli } from "./runner.js";
import { RUNTIME_ARTIFACT_HELP, runRuntimeArtifactCli } from "./runtime-artifacts.js";

const argv = process.argv.slice(2);
const localisationExitCode = await runLocalisationCli(argv);
if (localisationExitCode !== null) {
  process.exitCode = localisationExitCode;
} else {
  const replayExecuteExitCode = await runReplayExecuteCli(argv);
  if (replayExecuteExitCode !== null) {
    process.exitCode = replayExecuteExitCode;
  } else {
    const runtimeArtifactExitCode = await runRuntimeArtifactCli(argv);
    if (runtimeArtifactExitCode !== null) {
      process.exitCode = runtimeArtifactExitCode;
    } else {
      process.exitCode = await runCli(argv);
      const command = argv[0];
      if (!command || command === "help" || command === "--help" || command === "-h") {
        process.stdout.write(`\n${LOCALISATION_HELP}\n${RUNTIME_ARTIFACT_HELP}\n${REPLAY_EXECUTE_HELP}`);
      }
    }
  }
}