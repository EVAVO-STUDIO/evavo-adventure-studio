import { describe, expect, it } from "vitest";
import {
  applyDynamixCinematicCommand,
  createDynamixCinematicState,
  deadChannelDynamixContract,
  dynamixCinematicContracts,
  dynamixCinematicStateFingerprint,
  executeDynamixCinematicReplay,
  formatDynamixGameClock,
  jadeHorizonDynamixContract,
  validateDynamixCinematicContract,
  validateDynamixCinematicContracts,
  type DynamixCinematicCommand,
  type DynamixCinematicContract,
} from "../src/dynamix-cinematic.js";

const run = (
  contract: DynamixCinematicContract,
  commands: readonly DynamixCinematicCommand[],
) => commands.reduce(
  (state, command) => applyDynamixCinematicCommand(contract, state, command),
  createDynamixCinematicState(contract),
);

const completeJadeAction: readonly DynamixCinematicCommand[] = [
  { kind: "advance-ticks", ticks: 20 },
  { kind: "action-input", input: "down" },
  { kind: "advance-ticks", ticks: 50 },
  { kind: "action-input", input: "right" },
  { kind: "advance-ticks", ticks: 48 },
  { kind: "action-input", input: "act" },
  { kind: "advance-ticks", ticks: 50 },
];

const completeDeadChannelAction: readonly DynamixCinematicCommand[] = [
  { kind: "advance-ticks", ticks: 16 },
  { kind: "action-input", input: "guard" },
  { kind: "advance-ticks", ticks: 36 },
  { kind: "action-input", input: "up" },
  { kind: "advance-ticks", ticks: 40 },
  { kind: "action-input", input: "act" },
  { kind: "advance-ticks", ticks: 40 },
];

describe("Dynamix cinematic adventure systems", () => {
  it("ships two valid, original and materially different DGDS production contracts", () => {
    expect(dynamixCinematicContracts.map((contract) => contract.id)).toEqual([
      "jade-horizon",
      "dead-channel",
    ]);
    expect(validateDynamixCinematicContracts(dynamixCinematicContracts)).toEqual([]);
    expect(jadeHorizonDynamixContract.timing.clockMode).toBe("costed-only");
    expect(deadChannelDynamixContract.timing.clockMode).toBe("continuous");
    expect(deadChannelDynamixContract.timing.ticksPerGameMinute).toBe(300);
    expect(
      dynamixCinematicContracts.every(
        (contract) =>
          contract.visual.nativeWidth === 320 &&
          contract.visual.nativeHeight === 200 &&
          contract.visual.maxColours === 256 &&
          contract.visual.textureSampling === "nearest" &&
          contract.visual.spriteTransparency === "binary" &&
          contract.originalAssetsOnly,
      ),
    ).toBe(true);
  });

  it("advances the visible Dead Channel clock by five game minutes per 1500 logical ticks", () => {
    const initial = createDynamixCinematicState(deadChannelDynamixContract);
    const advanced = applyDynamixCinematicCommand(deadChannelDynamixContract, initial, {
      kind: "advance-ticks",
      ticks: 1500,
    });
    expect(advanced.gameMinute - initial.gameMinute).toBe(5);
    expect(advanced.clockRemainderTicks).toBe(0);
    expect(formatDynamixGameClock(advanced.gameMinute)).toBe("DAY 3 19:05");
  });

  it("keeps Heart-style protagonist, route, trust and action consequences deterministic", () => {
    const commands: readonly DynamixCinematicCommand[] = [
      { kind: "switch-protagonist", protagonistId: "jade-horizon.pilot" },
      { kind: "choose", choiceId: "jade-horizon.choice.share-fault" },
      { kind: "travel", routeId: "jade-horizon.route.mountain" },
      { kind: "start-action", sequenceId: "jade-horizon.action.train-roof" },
      ...completeJadeAction,
    ];
    const state = run(jadeHorizonDynamixContract, commands);
    expect(state).toMatchObject({
      protagonistId: "jade-horizon.pilot",
      locationId: "jade-horizon.cliff-railway",
      terminalOutcomeId: "jade-horizon.outcome.shared-route",
      lastActionResult: {
        sequenceId: "jade-horizon.action.train-roof",
        outcome: "success",
      },
    });
    expect(state.flags).toEqual(
      expect.objectContaining({
        "jade-horizon.fault-shared": true,
        "jade-horizon.mountain-route-taken": true,
        "jade-horizon.train-roof-crossed": true,
        "jade-horizon.route-secured": true,
      }),
    );
    expect(state.relationships["jade-horizon.trust"]).toBe(63);

    const replay = executeDynamixCinematicReplay(jadeHorizonDynamixContract, {
      replayVersion: 1,
      contractId: "jade-horizon",
      commands,
      expectedFingerprint: dynamixCinematicStateFingerprint(state),
    });
    expect(replay.state).toEqual(state);
  });

  it("restores a failed action to its named safe anchor without erasing route state", () => {
    const prefix: readonly DynamixCinematicCommand[] = [
      { kind: "switch-protagonist", protagonistId: "jade-horizon.pilot" },
      { kind: "choose", choiceId: "jade-horizon.choice.share-fault" },
      { kind: "travel", routeId: "jade-horizon.route.mountain" },
      { kind: "start-action", sequenceId: "jade-horizon.action.train-roof" },
      { kind: "advance-ticks", ticks: 20 },
      { kind: "action-input", input: "left" },
      { kind: "advance-ticks", ticks: 148 },
    ];
    const failed = run(jadeHorizonDynamixContract, prefix);
    expect(failed.lastActionResult?.outcome).toBe("failure");
    expect(failed.routeHistory).toEqual(["jade-horizon.route.mountain"]);
    expect(failed.flags["jade-horizon.fault-shared"]).toBe(true);

    let retried = applyDynamixCinematicCommand(jadeHorizonDynamixContract, failed, {
      kind: "retry-action",
    });
    for (const command of completeJadeAction) {
      retried = applyDynamixCinematicCommand(jadeHorizonDynamixContract, retried, command);
    }
    expect(retried.lastActionResult?.outcome).toBe("success");
    expect(retried.routeHistory).toEqual(["jade-horizon.route.mountain"]);
    expect(retried.flags["jade-horizon.fault-shared"]).toBe(true);
  });

  it("integrates Dead Channel evidence, contact windows, clock pressure and action recovery", () => {
    const commands: readonly DynamixCinematicCommand[] = [
      { kind: "advance-ticks", ticks: 1500 },
      { kind: "travel", routeId: "dead-channel.route.transit-office" },
      { kind: "choose", choiceId: "dead-channel.choice.copy-timetable" },
      { kind: "travel", routeId: "dead-channel.route.night-market" },
      { kind: "choose", choiceId: "dead-channel.choice.share-evidence" },
      { kind: "travel", routeId: "dead-channel.route.transmitter" },
      { kind: "start-action", sequenceId: "dead-channel.action.fire-escape" },
      ...completeDeadChannelAction,
    ];
    const state = run(deadChannelDynamixContract, commands);
    expect(state.terminalOutcomeId).toBe("dead-channel.outcome.signal-stopped");
    expect(state.flags).toEqual(
      expect.objectContaining({
        "dead-channel.timetable-found": true,
        "dead-channel.contact-reached": true,
        "dead-channel.tower-location-known": true,
        "dead-channel.transmitter-secured": true,
      }),
    );
    expect(state.relationships["dead-channel.contact-trust"]).toBe(64);
    expect(state.gameMinute).toBeLessThan(
      deadChannelDynamixContract.deadlines.find(
        (deadline) => deadline.id === "dead-channel.deadline.broadcast",
      )?.gameMinute ?? 0,
    );
  });

  it("resolves a missed scheduled contact into a governed deadline outcome", () => {
    const state = run(deadChannelDynamixContract, [
      { kind: "advance-minutes", minutes: 76 },
    ]);
    expect(state.terminalOutcomeId).toBe("dead-channel.outcome.contact-lost");
    expect(() =>
      applyDynamixCinematicCommand(deadChannelDynamixContract, state, {
        kind: "advance-ticks",
        ticks: 1,
      }),
    ).toThrow("terminal");
  });

  it("rejects modern presentation drift and overlapping action windows", () => {
    const malformed = JSON.parse(
      JSON.stringify(deadChannelDynamixContract),
    ) as DynamixCinematicContract;
    const input = malformed as unknown as {
      visual: { textureSampling: string };
      actions: Array<{
        safeAnchorId: string;
        windows: Array<{ opensAtTick: number; closesAtTick: number }>;
      }>;
    };
    input.visual.textureSampling = "linear";
    input.actions[0]!.safeAnchorId = "missing";
    input.actions[0]!.windows[1]!.opensAtTick = input.actions[0]!.windows[0]!.closesAtTick;
    const codes = validateDynamixCinematicContract(malformed).map((entry) => entry.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "invalid-visual-contract",
        "missing-safe-anchor",
        "overlapping-action-window",
      ]),
    );
  });
});
