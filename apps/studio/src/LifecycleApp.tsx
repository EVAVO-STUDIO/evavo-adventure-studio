import { conditionSchema, type Condition } from "@evavo/adventure-project-schema";
import {
  canonicaliseGameLifecycleManifest,
  type GameLifecycleOutcome,
} from "@evavo/adventure-project-schema/lifecycle";
import type { GameLifecycleEditorCommand } from "@evavo/adventure-project-schema/lifecycle-editor";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import {
  studioLifecycleManifest,
  studioLifecycleProject,
} from "./lifecycle-fixture.js";
import {
  createLifecycleWorkspace,
  insertLifecycleOutcomeCommand,
  lifecycleWorkspaceIsDirty,
  lifecycleWorkspaceManifest,
  lifecycleWorkspaceReducer,
  removeSelectedLifecycleOutcomeCommand,
  replaceSelectedLifecycleOutcomeCommand,
  selectedLifecycleOutcome,
  type LifecycleWorkspaceState,
} from "./lifecycle-workspace.js";
import "./lifecycle-editor.css";

const Button = ({
  children,
  onClick,
  disabled = false,
  active = false,
  className = "",
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly active?: boolean;
  readonly className?: string;
}) => (
  <button
    type="button"
    className={`button ${active ? "is-active" : ""} ${className}`}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);

const Field = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <label className="lifecycle-field">
    <span>{label}</span>
    {children}
  </label>
);

const downloadManifest = (state: LifecycleWorkspaceState): void => {
  const manifest = canonicaliseGameLifecycleManifest(lifecycleWorkspaceManifest(state));
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(manifest, null, 2)}\n`], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "game-lifecycle.json";
  anchor.click();
  URL.revokeObjectURL(url);
};

const scalarFromDraft = (value: string): string | number | boolean => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.length > 0 && Number.isFinite(Number(trimmed))) return Number(trimmed);
  return value;
};

const conditionSummary = (condition: Condition): string => {
  switch (condition.kind) {
    case "always":
      return "Always true";
    case "flag":
      return `${condition.flag} = ${condition.equals}`;
    case "variable":
      return `${condition.variable} ${condition.operator} ${String(condition.value)}`;
    case "has-item":
      return `Has ${condition.itemId}`;
    case "interaction-used":
      return `Used ${condition.interactionId}`;
    case "dialogue-choice-used":
      return `Chose ${condition.choiceId}`;
    case "all":
      return `ALL of ${condition.conditions.length} conditions`;
    case "any":
      return `ANY of ${condition.conditions.length} conditions`;
    case "not":
      return `NOT (${conditionSummary(condition.condition)})`;
  }
};

const defaultCondition = (
  kind: Condition["kind"],
  state: LifecycleWorkspaceState,
): Condition => {
  switch (kind) {
    case "always":
      return { kind: "always" };
    case "flag":
      return { kind: "flag", flag: "case.failed", equals: true };
    case "variable":
      return { kind: "variable", variable: "police-heat", operator: "gte", value: 5 };
    case "has-item": {
      const item = state.project.inventoryItems[0];
      return {
        kind: "has-item",
        itemId: (item?.id ?? "item.required") as Extract<Condition, { kind: "has-item" }>["itemId"],
      };
    }
    case "interaction-used":
      return {
        kind: "interaction-used",
        interactionId: "interaction.required" as Extract<
          Condition,
          { kind: "interaction-used" }
        >["interactionId"],
      };
    case "dialogue-choice-used":
      return {
        kind: "dialogue-choice-used",
        choiceId: "dialogue-choice.required" as Extract<
          Condition,
          { kind: "dialogue-choice-used" }
        >["choiceId"],
      };
    case "all":
      return {
        kind: "all",
        conditions: [
          { kind: "flag", flag: "case.solved", equals: true },
          { kind: "flag", flag: "evidence.complete", equals: true },
        ],
      };
    case "any":
      return {
        kind: "any",
        conditions: [
          { kind: "flag", flag: "case.failed", equals: true },
          { kind: "flag", flag: "case.abandoned", equals: true },
        ],
      };
    case "not":
      return { kind: "not", condition: { kind: "flag", flag: "case.safe", equals: true } };
  }
};

const RecoveryPreview = ({ outcome }: { readonly outcome: GameLifecycleOutcome }) => {
  const items = [
    ...(outcome.menu.allowQuickRetry
      ? [{ label: outcome.menu.labels.quickRetry, dependent: true }]
      : []),
    ...(outcome.menu.allowLoad
      ? [{ label: outcome.menu.labels.loadGame, dependent: true }]
      : []),
    ...(outcome.menu.allowRestart
      ? [{ label: outcome.menu.labels.restartGame, dependent: false }]
      : []),
    ...(outcome.menu.allowTitle
      ? [{ label: outcome.menu.labels.returnToTitle, dependent: false }]
      : []),
  ];
  return (
    <div className={`lifecycle-native-frame is-${outcome.kind}`}>
      <div className="lifecycle-native-scanlines" />
      <span className="lifecycle-native-kicker">THE RED LEDGER</span>
      <h2>{outcome.title}</h2>
      <p>{outcome.message}</p>
      <div className="lifecycle-native-menu">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className={index === 0 ? "is-selected" : undefined}>
            <strong>{item.label}</strong>
            {item.dependent ? <small>requires compatible save</small> : null}
          </div>
        ))}
      </div>
      <footer>320 × 200 NATIVE TERMINAL FRAME</footer>
    </div>
  );
};

export const LifecycleApp = () => {
  const [state, dispatch] = useReducer(
    lifecycleWorkspaceReducer,
    createLifecycleWorkspace(studioLifecycleProject, studioLifecycleManifest),
  );
  const outcome = selectedLifecycleOutcome(state);
  const manifest = lifecycleWorkspaceManifest(state);
  const dirty = lifecycleWorkspaceIsDirty(state);
  const [titleDraft, setTitleDraft] = useState(outcome.title);
  const [messageDraft, setMessageDraft] = useState(outcome.message);
  const [conditionDraft, setConditionDraft] = useState(JSON.stringify(outcome.when, null, 2));

  useEffect(() => {
    setTitleDraft(outcome.title);
    setMessageDraft(outcome.message);
    setConditionDraft(JSON.stringify(outcome.when, null, 2));
  }, [outcome.id, outcome.title, outcome.message, outcome.when]);

  const metrics = useMemo(
    () => ({
      failures: manifest.outcomes.filter((candidate) => candidate.kind === "failure").length,
      successes: manifest.outcomes.filter((candidate) => candidate.kind === "success").length,
    }),
    [manifest],
  );

  const execute = useCallback(
    (command: GameLifecycleEditorCommand, notice: string, selectedOutcomeId?: string): void => {
      try {
        dispatch({
          type: "execute",
          command,
          notice,
          ...(selectedOutcomeId ? { selectedOutcomeId } : {}),
        });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Ending edit failed.");
      }
    },
    [],
  );

  const replace = (next: GameLifecycleOutcome, notice: string): void =>
    execute(replaceSelectedLifecycleOutcomeCommand(state, next), notice);

  const save = useCallback(() => {
    downloadManifest(state);
    dispatch({ type: "mark-saved" });
  }, [state]);

  const addOutcome = (kind: GameLifecycleOutcome["kind"]): void => {
    const addition = insertLifecycleOutcomeCommand(state, kind);
    execute(
      addition.command,
      kind === "failure" ? "Added failure outcome." : "Added success ending.",
      addition.outcomeId,
    );
  };

  const applyConditionJson = (): void => {
    try {
      const parsed = conditionSchema.parse(JSON.parse(conditionDraft) as unknown);
      replace({ ...outcome, when: parsed }, "Updated ending condition.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Condition JSON is invalid.");
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  const updateRecovery = (
    field: "allowQuickRetry" | "allowLoad" | "allowRestart" | "allowTitle",
    value: boolean,
  ): void => replace({ ...outcome, menu: { ...outcome.menu, [field]: value } }, "Updated recovery routes.");

  return (
    <div className="studio-app lifecycle-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">E</span>
          <span>
            <strong>EVAVO</strong>
            <small>ADVENTURE STUDIO</small>
          </span>
        </div>
        <div className="document-title">
          <span>{state.project.title}</span>
          <strong>Endings &amp; Outcomes</strong>
          {dirty ? <i>●</i> : null}
        </div>
        <div className="topbar-actions">
          <Button onClick={save} className="primary-button">
            Export Lifecycle
          </Button>
        </div>
      </header>

      <div className="toolbar lifecycle-toolbar">
        <div className="toolbar-group">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={state.history.undoStack.length === 0}>
            ↶
          </Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={state.history.redoStack.length === 0}>
            ↷
          </Button>
        </div>
        <div className="lifecycle-toolbar-summary">
          <span className="eyebrow">DETERMINISTIC LIFECYCLE</span>
          <strong>
            {metrics.failures} failures · {metrics.successes} endings · {manifest.outcomes.length} total
          </strong>
        </div>
        <div className="toolbar-group">
          <Button onClick={() => addOutcome("failure")}>＋ Failure</Button>
          <Button onClick={() => addOutcome("success")}>＋ Ending</Button>
        </div>
      </div>

      <main className="lifecycle-workspace-grid">
        <aside className="sidebar lifecycle-outcome-sidebar">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">OUTCOMES</span>
              <h2>{manifest.outcomes.length} authored routes</h2>
            </div>
          </div>
          <div className="lifecycle-outcome-list">
            {manifest.outcomes.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                className={candidate.id === outcome.id ? "is-active" : undefined}
                onClick={() => dispatch({ type: "select-outcome", outcomeId: candidate.id })}
              >
                <span className={`lifecycle-kind is-${candidate.kind}`}>{candidate.kind}</span>
                <strong>{candidate.title}</strong>
                <small>{candidate.id}</small>
                <b>P{candidate.priority}</b>
              </button>
            ))}
          </div>
          <div className="sidebar-footer">
            <span className={`save-indicator ${dirty ? "is-dirty" : ""}`} />
            <span>{dirty ? "UNEXPORTED ENDINGS" : "LIFECYCLE EXPORTED"}</span>
          </div>
        </aside>

        <section className="lifecycle-canvas-column">
          <section className="lifecycle-preview-card">
            <div className="lifecycle-section-heading">
              <div>
                <span className="eyebrow">NATIVE PLAYER PREVIEW</span>
                <h2>{outcome.kind === "failure" ? "Failure recovery" : "Ending resolution"}</h2>
              </div>
              <code>{outcome.id}</code>
            </div>
            <div className="lifecycle-preview-stage">
              <RecoveryPreview outcome={outcome} />
            </div>
          </section>

          <section className="lifecycle-copy-card">
            <div className="lifecycle-section-heading">
              <div>
                <span className="eyebrow">OUTCOME COPY</span>
                <h2>Player-facing result</h2>
              </div>
            </div>
            <div className="lifecycle-two-columns">
              <Field label="Kind">
                <select
                  value={outcome.kind}
                  onChange={(event) =>
                    replace(
                      { ...outcome, kind: event.currentTarget.value as GameLifecycleOutcome["kind"] },
                      "Changed outcome kind.",
                    )
                  }
                >
                  <option value="failure">Failure</option>
                  <option value="success">Success</option>
                </select>
              </Field>
              <Field label="Priority">
                <input
                  type="number"
                  min="-1000"
                  max="1000"
                  value={outcome.priority}
                  onChange={(event) => {
                    const priority = Number(event.currentTarget.value);
                    if (Number.isSafeInteger(priority)) {
                      replace({ ...outcome, priority }, "Changed outcome priority.");
                    }
                  }}
                />
              </Field>
            </div>
            <Field label="Title">
              <input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.currentTarget.value)}
                onBlur={() => {
                  const title = titleDraft.trim();
                  if (title && title !== outcome.title) replace({ ...outcome, title }, "Updated outcome title.");
                  else setTitleDraft(outcome.title);
                }}
              />
            </Field>
            <Field label="Message">
              <textarea
                rows={4}
                value={messageDraft}
                onChange={(event) => setMessageDraft(event.currentTarget.value)}
                onBlur={() => {
                  const message = messageDraft.trim();
                  if (message && message !== outcome.message) {
                    replace({ ...outcome, message }, "Updated outcome message.");
                  } else setMessageDraft(outcome.message);
                }}
              />
            </Field>
          </section>

          <section className="lifecycle-condition-card">
            <div className="lifecycle-section-heading">
              <div>
                <span className="eyebrow">CANONICAL TRIGGER</span>
                <h2>{conditionSummary(outcome.when)}</h2>
              </div>
              <span>{outcome.when.kind}</span>
            </div>
            <div className="lifecycle-two-columns">
              <Field label="Condition kind">
                <select
                  value={outcome.when.kind}
                  onChange={(event) =>
                    replace(
                      {
                        ...outcome,
                        when: defaultCondition(event.currentTarget.value as Condition["kind"], state),
                      },
                      "Changed condition kind.",
                    )
                  }
                >
                  <option value="always">Always</option>
                  <option value="flag">Flag</option>
                  <option value="variable">Variable</option>
                  <option value="has-item">Has item</option>
                  <option value="interaction-used">Interaction used</option>
                  <option value="dialogue-choice-used">Dialogue choice used</option>
                  <option value="all">All</option>
                  <option value="any">Any</option>
                  <option value="not">Not</option>
                </select>
              </Field>
              {outcome.when.kind === "flag" ? (
                <Field label="Equals">
                  <select
                    value={String(outcome.when.equals)}
                    onChange={(event) =>
                      replace(
                        { ...outcome, when: { ...outcome.when, equals: event.currentTarget.value === "true" } },
                        "Updated flag condition.",
                      )
                    }
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </Field>
              ) : null}
            </div>

            {outcome.when.kind === "flag" ? (
              <Field label="Flag">
                <input
                  value={outcome.when.flag}
                  onChange={(event) => {
                    const flag = event.currentTarget.value.trim();
                    if (flag) replace({ ...outcome, when: { ...outcome.when, flag } }, "Updated flag condition.");
                  }}
                />
              </Field>
            ) : null}

            {outcome.when.kind === "variable" ? (
              <div className="lifecycle-condition-row">
                <Field label="Variable">
                  <input
                    value={outcome.when.variable}
                    onChange={(event) => {
                      const variable = event.currentTarget.value.trim();
                      if (variable) {
                        replace({ ...outcome, when: { ...outcome.when, variable } }, "Updated variable condition.");
                      }
                    }}
                  />
                </Field>
                <Field label="Operator">
                  <select
                    value={outcome.when.operator}
                    onChange={(event) =>
                      replace(
                        {
                          ...outcome,
                          when: {
                            ...outcome.when,
                            operator: event.currentTarget.value as Extract<Condition, { kind: "variable" }>["operator"],
                          },
                        },
                        "Updated variable operator.",
                      )
                    }
                  >
                    <option value="eq">=</option>
                    <option value="neq">≠</option>
                    <option value="gt">&gt;</option>
                    <option value="gte">≥</option>
                    <option value="lt">&lt;</option>
                    <option value="lte">≤</option>
                  </select>
                </Field>
                <Field label="Value">
                  <input
                    defaultValue={String(outcome.when.value)}
                    key={`${outcome.id}:${outcome.when.variable}:${String(outcome.when.value)}`}
                    onBlur={(event) =>
                      replace(
                        { ...outcome, when: { ...outcome.when, value: scalarFromDraft(event.currentTarget.value) } },
                        "Updated variable value.",
                      )
                    }
                  />
                </Field>
              </div>
            ) : null}

            {outcome.when.kind === "has-item" ? (
              <Field label="Required inventory item">
                <select
                  value={outcome.when.itemId}
                  onChange={(event) =>
                    replace(
                      {
                        ...outcome,
                        when: {
                          kind: "has-item",
                          itemId: event.currentTarget.value as typeof outcome.when.itemId,
                        },
                      },
                      "Updated inventory condition.",
                    )
                  }
                >
                  {state.project.inventoryItems.map((item) => (
                    <option value={item.id} key={item.id}>{item.name} · {item.id}</option>
                  ))}
                </select>
              </Field>
            ) : null}

            {outcome.when.kind === "interaction-used" ? (
              <Field label="Interaction ID">
                <input
                  value={outcome.when.interactionId}
                  onChange={(event) => {
                    const interactionId = event.currentTarget.value.trim();
                    if (interactionId) {
                      replace(
                        {
                          ...outcome,
                          when: {
                            kind: "interaction-used",
                            interactionId: interactionId as typeof outcome.when.interactionId,
                          },
                        },
                        "Updated interaction condition.",
                      );
                    }
                  }}
                />
              </Field>
            ) : null}

            {outcome.when.kind === "dialogue-choice-used" ? (
              <Field label="Dialogue choice ID">
                <input
                  value={outcome.when.choiceId}
                  onChange={(event) => {
                    const choiceId = event.currentTarget.value.trim();
                    if (choiceId) {
                      replace(
                        {
                          ...outcome,
                          when: {
                            kind: "dialogue-choice-used",
                            choiceId: choiceId as typeof outcome.when.choiceId,
                          },
                        },
                        "Updated dialogue condition.",
                      );
                    }
                  }}
                />
              </Field>
            ) : null}

            <details className="lifecycle-advanced-condition">
              <summary>Advanced condition JSON</summary>
              <p>Full nested all / any / not conditions use the same canonical project schema as runtime.</p>
              <textarea
                rows={10}
                value={conditionDraft}
                onChange={(event) => setConditionDraft(event.currentTarget.value)}
              />
              <Button onClick={applyConditionJson}>Apply condition JSON</Button>
            </details>
          </section>
        </section>

        <aside className="sidebar lifecycle-inspector">
          <div className="inspector-heading">
            <span className="eyebrow">RECOVERY POLICY</span>
            <h2>{outcome.title}</h2>
            <code>{outcome.id}</code>
          </div>

          <section className="lifecycle-recovery-options">
            <h3>Available routes</h3>
            {(
              [
                ["allowQuickRetry", "Quick Retry", "Requires a valid Quick Save at runtime."],
                ["allowLoad", "Load Game", "Uses the same ten validated save slots."],
                ["allowRestart", "Restart Game", "Unconditional fresh runtime state."],
                ["allowTitle", "Return to Title", "Unconditional return to publisher/title flow."],
              ] as const
            ).map(([field, label, description]) => (
              <label className="lifecycle-route-toggle" key={field}>
                <input
                  type="checkbox"
                  checked={outcome.menu[field]}
                  onChange={(event) => updateRecovery(field, event.currentTarget.checked)}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </section>

          <section className="lifecycle-labels">
            <h3>Player labels</h3>
            {(
              [
                ["quickRetry", "Quick Retry"],
                ["loadGame", "Load Game"],
                ["restartGame", "Restart Game"],
                ["returnToTitle", "Return to Title"],
                ["back", "Back"],
              ] as const
            ).map(([key, label]) => (
              <Field label={label} key={key}>
                <input
                  value={outcome.menu.labels[key]}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    if (value.trim()) {
                      replace(
                        {
                          ...outcome,
                          menu: {
                            ...outcome.menu,
                            labels: { ...outcome.menu.labels, [key]: value },
                          },
                        },
                        "Updated recovery label.",
                      );
                    }
                  }}
                />
              </Field>
            ))}
          </section>

          <section className="lifecycle-danger-zone">
            <h3>Outcome record</h3>
            <p>Outcome IDs are stable runtime identities and cannot be renamed in-place.</p>
            <Button
              onClick={() =>
                execute(removeSelectedLifecycleOutcomeCommand(state), "Removed ending outcome.")
              }
              disabled={manifest.outcomes.length === 1}
            >
              Remove outcome
            </Button>
          </section>

          {state.notice ? <div className="lifecycle-notice">{state.notice}</div> : null}
        </aside>
      </main>
    </div>
  );
};