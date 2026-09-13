import {
  applyDynamixCinematicCommand,
  createDynamixCinematicState,
  dynamixCinematicContracts,
  formatDynamixGameClock,
  validateDynamixCinematicContract,
  type DynamixCinematicCommand,
  type DynamixCinematicContract,
  type DynamixCinematicInput,
  type DynamixCinematicState,
} from "@evavo/adventure-design/dynamix-cinematic";
import { useMemo, useState } from "react";
import { contractStyle, DynamixNativeScene } from "./DynamixCinematicPreview.js";
import "./dynamix-cinematic-lab.css";

const stateLabel = (
  contract: DynamixCinematicContract,
  state: DynamixCinematicState,
): string => {
  if (state.terminalOutcomeId) {
    return contract.outcomes.find((outcome) => outcome.id === state.terminalOutcomeId)?.title ?? "TERMINAL";
  }
  if (state.activeAction) return "ACTION ACTIVE";
  if (state.lastActionResult) return `ACTION ${state.lastActionResult.outcome.toLocaleUpperCase("en-US")}`;
  return "INVESTIGATION ACTIVE";
};

export const DynamixCinematicLabApp = () => {
  const [contractIndex, setContractIndex] = useState(0);
  const contract = dynamixCinematicContracts[contractIndex] ?? dynamixCinematicContracts[0]!;
  const [state, setState] = useState<DynamixCinematicState>(() =>
    createDynamixCinematicState(contract),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const issues = useMemo(() => validateDynamixCinematicContract(contract), [contract]);
  const routes = contract.routes.filter(
    (route) =>
      route.fromLocationId === state.locationId &&
      route.allowedProtagonistIds.includes(state.protagonistId) &&
      route.requiredFlags.every((flag) => state.flags[flag] === true),
  );
  const choices = contract.choices.filter((choice) =>
    choice.requiredFlags.every((flag) => state.flags[flag] === true),
  );
  const actions = contract.actions.filter((action) => action.locationId === state.locationId);
  const relationshipEntries = contract.relationships.map((definition) => ({
    ...definition,
    value: state.relationships[definition.id] ?? definition.initialValue,
  }));

  const selectContract = (index: number): void => {
    const next = dynamixCinematicContracts[index];
    if (!next) return;
    setContractIndex(index);
    setState(createDynamixCinematicState(next));
    setNotice(null);
  };

  const dispatch = (command: DynamixCinematicCommand): void => {
    try {
      setState((current) => applyDynamixCinematicCommand(contract, current, command));
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Cinematic command failed.");
    }
  };

  const reset = (): void => {
    setState(createDynamixCinematicState(contract));
    setNotice(null);
  };

  const activeSequence = state.activeAction
    ? contract.actions.find((action) => action.id === state.activeAction?.sequenceId)
    : null;

  return (
    <main className="dcl-app" style={contractStyle(contract)}>
      <header className="dcl-topbar">
        <div className="dcl-brand">
          <span className="dcl-mark">D</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>DGDS Cinematic Systems Lab</strong>
          </div>
        </div>
        <div className="dcl-selected">
          <span>DYNAMIX PRODUCTION LANGUAGE</span>
          <strong>{contract.originalProofTitle}</strong>
        </div>
        <div className={`dcl-state is-${state.terminalOutcomeId ? "terminal" : "active"}`}>
          <span />
          <strong>{stateLabel(contract, state)}</strong>
          <em>{issues.length === 0 ? "contract valid" : `${issues.length} findings`}</em>
        </div>
      </header>

      <div className="dcl-workspace">
        <aside className="dcl-rail">
          <header>
            <span className="dcl-eyebrow">ORIGINAL DGDS PROOFS</span>
            <h1>Two cinematic games, two different pressures.</h1>
            <p>
              Jade Horizon proves editorial travel and relationship routes. Dead Channel proves a
              visible clock, scheduled contacts and urban action recovery.
            </p>
          </header>
          <div className="dcl-contract-list">
            {dynamixCinematicContracts.map((candidate, index) => (
              <button
                type="button"
                key={candidate.id}
                className={index === contractIndex ? "is-selected" : ""}
                onClick={() => selectContract(index)}
              >
                <span>{candidate.id === "jade-horizon" ? "HOC" : "ROTD"}</span>
                <strong>{candidate.originalProofTitle}</strong>
                <small>{candidate.timing.clockMode.replaceAll("-", " ")} clock</small>
              </button>
            ))}
          </div>
          <section>
            <span className="dcl-eyebrow">NATIVE AUTHENTICITY</span>
            <dl>
              <div>
                <dt>Canvas</dt>
                <dd>320 × 200</dd>
              </div>
              <div>
                <dt>Display</dt>
                <dd>DOS 4:3</dd>
              </div>
              <div>
                <dt>Palette</dt>
                <dd>256 indexed</dd>
              </div>
              <div>
                <dt>Sampling</dt>
                <dd>nearest</dd>
              </div>
              <div>
                <dt>Clock</dt>
                <dd>{contract.timing.ticksPerGameMinute || "costed"} ticks/min</dd>
              </div>
              <div>
                <dt>Logic</dt>
                <dd>60 ticks/sec</dd>
              </div>
            </dl>
          </section>
          <button type="button" className="dcl-reset" onClick={reset}>
            RESET CANONICAL STATE
          </button>
        </aside>

        <section className="dcl-stage">
          <header>
            <div>
              <span className="dcl-eyebrow">ORIGINAL NATIVE PRODUCTION PROOF</span>
              <h1>{contract.label}</h1>
              <p>{contract.summary}</p>
            </div>
            <code>{contract.id}</code>
          </header>
          <DynamixNativeScene contract={contract} state={state} />
          <div className="dcl-timing-strip">
            {[
              ["Pointer", contract.timing.pointerAcknowledgeTicks],
              ["Hotspot", contract.timing.hotspotCommitTicks],
              ["Portrait", contract.timing.portraitRevealTicks],
              ["Line", contract.timing.dialogueMinimumTicks],
              ["Cut", contract.timing.locationCutTicks],
              ["Montage", contract.timing.montagePanelTicks],
              ["Telegraph", contract.timing.actionTelegraphTicks],
              ["Recovery", contract.timing.actionRecoveryTicks],
            ].map(([label, ticks]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{ticks}t</strong>
              </div>
            ))}
          </div>

          <section className="dcl-command-deck">
            <article>
              <header>
                <span>Clock and protagonists</span>
                <strong>{formatDynamixGameClock(state.gameMinute)}</strong>
              </header>
              <div>
                <button
                  type="button"
                  disabled={Boolean(state.terminalOutcomeId)}
                  onClick={() =>
                    dispatch(
                      contract.timing.clockMode === "continuous"
                        ? { kind: "advance-ticks", ticks: 1500 }
                        : { kind: "advance-minutes", minutes: 5 },
                    )
                  }
                >
                  ADVANCE 5 GAME MINUTES
                </button>
                {contract.protagonists.map((protagonist) => (
                  <button
                    type="button"
                    key={protagonist.id}
                    disabled={
                      Boolean(state.terminalOutcomeId) ||
                      protagonist.id === state.protagonistId ||
                      Boolean(state.activeAction)
                    }
                    onClick={() =>
                      dispatch({
                        kind: "switch-protagonist",
                        protagonistId: protagonist.id,
                      })
                    }
                  >
                    PLAY {protagonist.name.toLocaleUpperCase("en-US")}
                  </button>
                ))}
              </div>
            </article>

            <article>
              <header>
                <span>Available routes</span>
                <strong>{routes.length}</strong>
              </header>
              <div>
                {routes.length === 0 ? (
                  <p>No route currently satisfies location, knowledge and actor state.</p>
                ) : null}
                {routes.map((route) => (
                  <button
                    type="button"
                    key={route.id}
                    disabled={Boolean(state.terminalOutcomeId)}
                    onClick={() => dispatch({ kind: "travel", routeId: route.id })}
                  >
                    {route.label.toLocaleUpperCase("en-US")} · {route.costMinutes} MIN
                  </button>
                ))}
              </div>
            </article>

            <article>
              <header>
                <span>Conversation and evidence choices</span>
                <strong>{choices.length}</strong>
              </header>
              <div>
                {choices.map((choice) => (
                  <button
                    type="button"
                    key={choice.id}
                    disabled={
                      Boolean(state.terminalOutcomeId) ||
                      state.choiceHistory.includes(choice.id)
                    }
                    onClick={() => dispatch({ kind: "choose", choiceId: choice.id })}
                  >
                    {choice.label.toLocaleUpperCase("en-US")} · {choice.timeCostMinutes} MIN
                  </button>
                ))}
              </div>
            </article>

            <article>
              <header>
                <span>Cinematic action</span>
                <strong>{activeSequence?.kind ?? actions[0]?.kind ?? "none"}</strong>
              </header>
              <div>
                {!state.activeAction
                  ? actions.map((action) => (
                      <button
                        type="button"
                        key={action.id}
                        disabled={Boolean(state.terminalOutcomeId)}
                        onClick={() =>
                          dispatch({ kind: "start-action", sequenceId: action.id })
                        }
                      >
                        START {action.label.toLocaleUpperCase("en-US")}
                      </button>
                    ))
                  : null}
                {state.activeAction ? (
                  <>
                    <button
                      type="button"
                      onClick={() => dispatch({ kind: "advance-ticks", ticks: 6 })}
                    >
                      ADVANCE ACTION 6T
                    </button>
                    {(
                      [
                        "left",
                        "right",
                        "up",
                        "down",
                        "act",
                        "guard",
                        "accelerate",
                        "brake",
                      ] as readonly DynamixCinematicInput[]
                    ).map((input) => (
                      <button
                        type="button"
                        key={input}
                        onClick={() => dispatch({ kind: "action-input", input })}
                      >
                        {input.toLocaleUpperCase("en-US")}
                      </button>
                    ))}
                  </>
                ) : null}
                {state.lastActionResult?.outcome === "failure" ? (
                  <button type="button" onClick={() => dispatch({ kind: "retry-action" })}>
                    RETRY FROM SAFE ANCHOR
                  </button>
                ) : null}
              </div>
            </article>
          </section>
          {notice ? <p className="dcl-notice">{notice}</p> : null}
        </section>

        <aside className="dcl-inspector">
          <section>
            <span className="dcl-eyebrow">CANONICAL STATE</span>
            <dl>
              <div>
                <dt>Tick</dt>
                <dd>{state.tick}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{state.locationId}</dd>
              </div>
              <div>
                <dt>Routes</dt>
                <dd>{state.routeHistory.length}</dd>
              </div>
              <div>
                <dt>Choices</dt>
                <dd>{state.choiceHistory.length}</dd>
              </div>
              <div>
                <dt>Flags</dt>
                <dd>{Object.values(state.flags).filter(Boolean).length}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>{state.terminalOutcomeId ?? "open"}</dd>
              </div>
            </dl>
          </section>

          <section>
            <span className="dcl-eyebrow">RELATIONSHIPS</span>
            {relationshipEntries.map((relationship) => (
              <div className="dcl-meter" key={relationship.id}>
                <header>
                  <span>{relationship.label}</span>
                  <strong>{relationship.value}</strong>
                </header>
                <div>
                  <i
                    style={{
                      width: `${((relationship.value - relationship.minimum) /
                        (relationship.maximum - relationship.minimum)) *
                      100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </section>

          <section>
            <span className="dcl-eyebrow">ART PRODUCTION DOCTRINE</span>
            <ul>
              {contract.visual.backgroundDoctrine.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>

          <section>
            <span className="dcl-eyebrow">ANIMATION DOCTRINE</span>
            <ul>
              {contract.visual.animationDoctrine.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>

          <section className="dcl-prohibited">
            <span className="dcl-eyebrow">PROHIBITED SHORTCUTS</span>
            <ul>
              {contract.visual.prohibitedShortcuts.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
};
