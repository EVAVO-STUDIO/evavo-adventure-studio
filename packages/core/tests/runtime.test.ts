import { describe, expect, it } from "vitest";
import type { Id, Interaction } from "@evavo/adventure-project-schema";
import {
  applyActions,
  evaluateCondition,
  nextRandom,
  runInteraction,
  type RuntimeState,
} from "../src/index.js";

const id = <T extends string>(value: string) => value as Id<T>;

const createState = (): RuntimeState => ({
  schemaVersion: 1,
  projectId: id<"project">("project.fixture"),
  tick: 0,
  currentSceneId: id<"scene">("scene.office"),
  currentEntranceId: id<"entrance">("entrance.office.door"),
  flags: {},
  variables: {},
  inventory: [],
  awardedScoreIds: [],
  consumedInteractionIds: [],
  consumedDialogueChoiceIds: [],
  activeDialogue: null,
  activeSequences: [],
  objectStates: {},
  randomStreams: { main: 123456789 },
  score: 0,
});

describe("deterministic runtime", () => {
  it("evaluates nested conditions without mutating state", () => {
    const state: RuntimeState = {
      ...createState(),
      flags: { drawerOpened: true },
      variables: { suspicion: 3 },
      inventory: [id<"item">("item.brass-key")],
    };

    const matches = evaluateCondition(
      {
        kind: "all",
        conditions: [
          { kind: "flag", flag: "drawerOpened", equals: true },
          {
            kind: "variable",
            variable: "suspicion",
            operator: "gte",
            value: 3,
          },
          { kind: "has-item", itemId: id<"item">("item.brass-key") },
        ],
      },
      state,
    );

    expect(matches).toBe(true);
    expect(state.score).toBe(0);
  });

  it("evaluates consumed dialogue choice memory", () => {
    const choiceId = id<"dialogue-choice">("choice.ask-about-ledger");
    const state: RuntimeState = {
      ...createState(),
      consumedDialogueChoiceIds: [choiceId],
    };

    expect(
      evaluateCondition({ kind: "dialogue-choice-used", choiceId }, state),
    ).toBe(true);
  });

  it("awards each score event at most once", () => {
    const award = {
      kind: "award-score" as const,
      awardId: id<"score-award">("score.found-ledger"),
      points: 10,
    };

    const first = applyActions(createState(), [award]);
    const second = applyActions(first.state, [award]);

    expect(first.state.score).toBe(10);
    expect(first.events).toHaveLength(1);
    expect(second.state.score).toBe(10);
    expect(second.events).toHaveLength(0);
  });

  it("emits dialogue requests without guessing graph state", () => {
    const transition = applyActions(createState(), [
      {
        kind: "start-dialogue",
        dialogueId: id<"dialogue">("dialogue.receptionist"),
      },
    ]);

    expect(transition.state.activeDialogue).toBeNull();
    expect(transition.events).toEqual([
      {
        kind: "dialogue-requested",
        dialogueId: "dialogue.receptionist",
        nodeId: null,
      },
    ]);
  });

  it("rejects a consumed one-time interaction", () => {
    const interaction: Interaction = {
      id: id<"interaction">("interaction.take-key"),
      verb: "take",
      once: true,
      actions: [
        { kind: "give-item", itemId: id<"item">("item.brass-key") },
        {
          kind: "award-score",
          awardId: id<"score-award">("score.took-key"),
          points: 5,
        },
      ],
    };

    const first = runInteraction(createState(), interaction);
    expect(first.kind).toBe("accepted");
    if (first.kind !== "accepted") {
      throw new Error("Expected the interaction to be accepted.");
    }

    const second = runInteraction(first.transition.state, interaction);
    expect(first.transition.state.inventory).toContain("item.brass-key");
    expect(first.transition.state.score).toBe(5);
    expect(second).toMatchObject({ kind: "rejected", reason: "already-used" });
  });

  it("replays named random streams exactly", () => {
    const leftFirst = nextRandom(createState(), "puzzle");
    const leftSecond = nextRandom(leftFirst.state, "puzzle");
    const rightFirst = nextRandom(createState(), "puzzle");
    const rightSecond = nextRandom(rightFirst.state, "puzzle");

    expect([leftFirst.value, leftSecond.value]).toEqual([
      rightFirst.value,
      rightSecond.value,
    ]);
  });
});
