import {
  audioContentBusIds,
  type AudioBusId,
  type AudioBusMix,
  type AudioContentBusId,
  type AudioCue,
  type AudioDuckingRule,
  type AudioSceneLayer,
  type AudioSpeechBinding,
} from "@evavo/adventure-audio";
import type { AudioEditorCommand } from "@evavo/adventure-audio-editor-core";
import type { Id } from "@evavo/adventure-project-schema";
import {
  type ReactNode,
  useCallback,
  useMemo,
  useReducer,
  useState,
} from "react";
import { studioAudioMix, studioAudioProject } from "./audio-fixture.js";
import {
  audioIssuesForSelection,
  audioWorkspaceIsDirty,
  audioWorkspaceManifest,
  audioWorkspaceReducer,
  createAudioWorkspace,
  insertAudioCueCommand,
  insertSceneLayerCommand,
  replaceAudioBusCommand,
  replaceDuckingRuleCommand,
  replaceSceneLayerCommand,
  replaceSelectedAudioCueCommand,
  replaceSpeechBindingCommand,
  selectedAudioCue,
  selectedAudioDuckingRule,
  selectedAudioSoundscape,
  selectedAudioSpeechBinding,
  type AudioWorkspaceAction,
  type AudioWorkspaceState,
} from "./audio-workspace.js";
import "./audio.css";

type AudioDispatch = React.Dispatch<AudioWorkspaceAction>;

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const Button = ({
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly className?: string;
}) => (
  <button
    type="button"
    className={`audio-button ${className}`}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);

const Field = ({
  label,
  children,
  wide = false,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly wide?: boolean;
}) => (
  <label className={`audio-field${wide ? " is-wide" : ""}`}>
    <span>{label}</span>
    {children}
  </label>
);

const NumberInput = ({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
}) => (
  <input
    type="number"
    value={value}
    min={min}
    max={max}
    step={step}
    onChange={(event) => {
      const parsed = Number(event.currentTarget.value);
      if (!Number.isFinite(parsed)) return;
      onChange(Math.min(max, Math.max(min, parsed)));
    }}
  />
);

const CommitInput = ({
  value,
  onCommit,
}: {
  readonly value: string;
  readonly onCommit: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onFocus={() => setDraft(value)}
      onBlur={() => {
        const resolved = draft.trim();
        if (resolved && resolved !== value) onCommit(resolved);
        else setDraft(value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
};

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const downloadManifest = (state: AudioWorkspaceState): void => {
  const manifest = audioWorkspaceManifest(state);
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(manifest, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${manifest.projectId}.audio-mix.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const BusStrip = ({
  bus,
  execute,
}: {
  readonly bus: AudioBusMix;
  readonly execute: (command: AudioEditorCommand, notice?: string) => void;
}) => {
  const replace = (next: AudioBusMix, notice: string): void =>
    execute(replaceAudioBusCommand(bus.id, next), notice);

  return (
    <article className={`audio-bus-strip${bus.muted ? " is-muted" : ""}`}>
      <header>
        <strong>{bus.id}</strong>
        <span>{bus.muted ? "MUTED" : percent(bus.volume)}</span>
      </header>
      <div className="audio-meter" aria-hidden="true">
        <span style={{ height: `${Math.round(bus.volume * 100)}%` }} />
      </div>
      <input
        aria-label={`${bus.id} volume`}
        type="range"
        min={0}
        max={100}
        value={Math.round(bus.volume * 100)}
        onChange={(event) =>
          replace(
            { ...bus, volume: Number(event.currentTarget.value) / 100 },
            `Adjusted ${bus.id} bus level.`,
          )
        }
      />
      <label className="audio-check">
        <input
          type="checkbox"
          checked={bus.muted}
          onChange={(event) =>
            replace(
              { ...bus, muted: event.currentTarget.checked },
              `${event.currentTarget.checked ? "Muted" : "Unmuted"} ${bus.id} bus.`,
            )
          }
        />
        Mute
      </label>
      <Field label="Voices">
        <NumberInput
          value={bus.maxVoices}
          min={1}
          max={128}
          onChange={(maxVoices) =>
            replace(
              { ...bus, maxVoices: Math.round(maxVoices) },
              `Updated ${bus.id} voice limit.`,
            )
          }
        />
      </Field>
      <Field label="Steal policy">
        <select
          value={bus.stealPolicy}
          onChange={(event) =>
            replace(
              {
                ...bus,
                stealPolicy: event.currentTarget
                  .value as AudioBusMix["stealPolicy"],
              },
              `Updated ${bus.id} voice policy.`,
            )
          }
        >
          <option value="lowest-priority">Lowest priority</option>
          <option value="oldest">Oldest</option>
          <option value="quietest">Quietest</option>
        </select>
      </Field>
    </article>
  );
};

const CueInspector = ({
  state,
  dispatch,
  execute,
}: {
  readonly state: AudioWorkspaceState;
  readonly dispatch: AudioDispatch;
  readonly execute: (command: AudioEditorCommand, notice?: string) => void;
}) => {
  const manifest = audioWorkspaceManifest(state);
  const cue = selectedAudioCue(state);
  const audioAssets = state.project.assets.filter((asset) => asset.kind === "audio");

  const addCue = (): void => {
    const index = manifest.cues.length + 1;
    const asset =
      audioAssets.find(
        (candidate) =>
          !manifest.cues.some((cueCandidate) => cueCandidate.assetId === candidate.id),
      ) ?? audioAssets[0];
    if (!asset) return;
    const cueId = id<"audio-cue">(`audio-cue.custom.${index}`);
    const next: AudioCue = {
      id: cueId,
      name: `Custom cue ${index}`,
      assetId: asset.id,
      bus: "effects",
      volume: 1,
      startOffsetMilliseconds: 0,
      fadeInTicks: 0,
      fadeOutTicks: 0,
      loop: null,
      polyphony: "overlap",
      maxInstances: 8,
      priority: 0,
      interruptGroup: null,
    };
    execute(insertAudioCueCommand(state, next), "Added audio cue.");
    dispatch({ type: "select-cue", cueId });
  };

  const replace = (next: AudioCue, notice: string): void =>
    execute(replaceSelectedAudioCueCommand(state, next), notice);

  return (
    <section className="audio-panel audio-cues-panel">
      <div className="audio-panel-heading">
        <div>
          <span className="audio-eyebrow">Library</span>
          <h2>Audio cues</h2>
        </div>
        <Button onClick={addCue} disabled={audioAssets.length === 0}>
          Add cue
        </Button>
      </div>
      <div className="audio-cue-layout">
        <div className="audio-cue-list" role="listbox" aria-label="Audio cues">
          {manifest.cues.map((candidate) => (
            <button
              type="button"
              key={candidate.id}
              className={candidate.id === state.selectedCueId ? "is-selected" : ""}
              onClick={() =>
                dispatch({ type: "select-cue", cueId: candidate.id })
              }
            >
              <span className={`audio-bus-dot bus-${candidate.bus}`} />
              <span>
                <strong>{candidate.name}</strong>
                <small>{candidate.bus} · {percent(candidate.volume)}</small>
              </span>
            </button>
          ))}
        </div>
        {cue ? (
          <div className="audio-inspector-grid">
            <Field label="Cue name" wide>
              <CommitInput
                value={cue.name}
                onCommit={(name) => replace({ ...cue, name }, "Renamed audio cue.")}
              />
            </Field>
            <Field label="Source asset" wide>
              <select
                value={cue.assetId}
                onChange={(event) =>
                  replace(
                    {
                      ...cue,
                      assetId: id<"asset">(event.currentTarget.value),
                    },
                    "Changed cue source asset.",
                  )
                }
              >
                {audioAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bus">
              <select
                value={cue.bus}
                onChange={(event) =>
                  replace(
                    {
                      ...cue,
                      bus: event.currentTarget.value as AudioContentBusId,
                    },
                    "Changed cue bus.",
                  )
                }
              >
                {audioContentBusIds.map((busId) => (
                  <option key={busId} value={busId}>
                    {busId}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Volume ${percent(cue.volume)}`}>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(cue.volume * 100)}
                onChange={(event) =>
                  replace(
                    {
                      ...cue,
                      volume: Number(event.currentTarget.value) / 100,
                    },
                    "Adjusted cue volume.",
                  )
                }
              />
            </Field>
            <Field label="Fade in ticks">
              <NumberInput
                value={cue.fadeInTicks}
                min={0}
                max={3600}
                onChange={(fadeInTicks) =>
                  replace(
                    { ...cue, fadeInTicks: Math.round(fadeInTicks) },
                    "Updated cue fade in.",
                  )
                }
              />
            </Field>
            <Field label="Fade out ticks">
              <NumberInput
                value={cue.fadeOutTicks}
                min={0}
                max={3600}
                onChange={(fadeOutTicks) =>
                  replace(
                    { ...cue, fadeOutTicks: Math.round(fadeOutTicks) },
                    "Updated cue fade out.",
                  )
                }
              />
            </Field>
            <Field label="Start offset ms">
              <NumberInput
                value={cue.startOffsetMilliseconds}
                min={0}
                max={86_400_000}
                onChange={(startOffsetMilliseconds) =>
                  replace(
                    {
                      ...cue,
                      startOffsetMilliseconds: Math.round(
                        startOffsetMilliseconds,
                      ),
                    },
                    "Updated cue start offset.",
                  )
                }
              />
            </Field>
            <Field label="Priority">
              <NumberInput
                value={cue.priority}
                min={-1000}
                max={1000}
                onChange={(priority) =>
                  replace(
                    { ...cue, priority: Math.round(priority) },
                    "Updated cue priority.",
                  )
                }
              />
            </Field>
            <Field label="Polyphony">
              <select
                value={cue.polyphony}
                onChange={(event) => {
                  const polyphony = event.currentTarget
                    .value as AudioCue["polyphony"];
                  replace(
                    {
                      ...cue,
                      polyphony,
                      maxInstances:
                        polyphony === "overlap" ? cue.maxInstances : 1,
                    },
                    "Updated cue polyphony.",
                  );
                }}
              >
                <option value="overlap">Overlap</option>
                <option value="restart">Restart</option>
                <option value="ignore">Ignore while playing</option>
              </select>
            </Field>
            <Field label="Max instances">
              <NumberInput
                value={cue.maxInstances}
                min={1}
                max={32}
                onChange={(maxInstances) =>
                  replace(
                    { ...cue, maxInstances: Math.round(maxInstances) },
                    "Updated cue instance limit.",
                  )
                }
              />
            </Field>
            <Field label="Interrupt group" wide>
              <input
                value={cue.interruptGroup ?? ""}
                placeholder="None"
                onChange={(event) =>
                  replace(
                    {
                      ...cue,
                      interruptGroup:
                        event.currentTarget.value.trim() || null,
                    },
                    "Updated cue interrupt group.",
                  )
                }
              />
            </Field>
            <label className="audio-loop-toggle">
              <input
                type="checkbox"
                checked={cue.loop !== null}
                onChange={(event) =>
                  replace(
                    {
                      ...cue,
                      loop: event.currentTarget.checked
                        ? {
                            startMilliseconds: 0,
                            endMilliseconds: 10_000,
                            crossfadeMilliseconds: 100,
                          }
                        : null,
                    },
                    `${event.currentTarget.checked ? "Enabled" : "Disabled"} cue loop.`,
                  )
                }
              />
              Seamless loop
            </label>
            {cue.loop ? (
              <div className="audio-loop-grid">
                <Field label="Loop start ms">
                  <NumberInput
                    value={cue.loop.startMilliseconds}
                    min={0}
                    max={86_400_000}
                    onChange={(startMilliseconds) =>
                      replace(
                        {
                          ...cue,
                          loop: {
                            ...cue.loop!,
                            startMilliseconds: Math.round(startMilliseconds),
                          },
                        },
                        "Updated loop start.",
                      )
                    }
                  />
                </Field>
                <Field label="Loop end ms">
                  <NumberInput
                    value={cue.loop.endMilliseconds}
                    min={1}
                    max={86_400_000}
                    onChange={(endMilliseconds) =>
                      replace(
                        {
                          ...cue,
                          loop: {
                            ...cue.loop!,
                            endMilliseconds: Math.round(endMilliseconds),
                          },
                        },
                        "Updated loop end.",
                      )
                    }
                  />
                </Field>
                <Field label="Crossfade ms">
                  <NumberInput
                    value={cue.loop.crossfadeMilliseconds}
                    min={0}
                    max={60_000}
                    onChange={(crossfadeMilliseconds) =>
                      replace(
                        {
                          ...cue,
                          loop: {
                            ...cue.loop!,
                            crossfadeMilliseconds: Math.round(
                              crossfadeMilliseconds,
                            ),
                          },
                        },
                        "Updated loop crossfade.",
                      )
                    }
                  />
                </Field>
              </div>
            ) : null}
            <div className="audio-danger-row">
              <Button
                className="is-danger"
                onClick={() =>
                  execute(
                    { kind: "remove-cue", cueId: cue.id },
                    "Removed audio cue.",
                  )
                }
              >
                Remove cue
              </Button>
            </div>
          </div>
        ) : (
          <p className="audio-empty">Add an audio cue to begin authoring.</p>
        )}
      </div>
    </section>
  );
};

const SoundscapeEditor = ({
  state,
  dispatch,
  execute,
}: {
  readonly state: AudioWorkspaceState;
  readonly dispatch: AudioDispatch;
  readonly execute: (command: AudioEditorCommand, notice?: string) => void;
}) => {
  const manifest = audioWorkspaceManifest(state);
  const soundscape = selectedAudioSoundscape(state);
  const scene = state.project.scenes.find(
    (candidate) => candidate.id === state.selectedSceneId,
  );

  const addSoundscape = (): void =>
    execute(
      {
        kind: "insert-soundscape",
        index: manifest.soundscapes.length,
        soundscape: { sceneId: state.selectedSceneId, layers: [] },
      },
      "Added scene soundscape.",
    );

  const addLayer = (): void => {
    if (!soundscape) return;
    const hasMusic = soundscape.layers.some((layer) => layer.role === "music");
    const role: AudioSceneLayer["role"] = hasMusic ? "ambience" : "music";
    const expectedBus = role === "music" ? "music" : "ambience";
    const cue = manifest.cues.find((candidate) => candidate.bus === expectedBus);
    if (!cue) return;
    const index = soundscape.layers.length + 1;
    execute(
      insertSceneLayerCommand(state, {
        id: id<"audio-scene-layer">(
          `audio-scene-layer.${state.selectedSceneId}.${index}`,
        ),
        cueId: cue.id,
        role,
        startDelayTicks: 0,
        fadeInTicks: cue.fadeInTicks,
        fadeOutTicks: cue.fadeOutTicks,
        restartPolicy: role === "music" ? "continue" : "resume",
      }),
      "Added soundscape layer.",
    );
  };

  return (
    <section className="audio-panel audio-soundscape-panel">
      <div className="audio-panel-heading">
        <div>
          <span className="audio-eyebrow">Rooms</span>
          <h2>Scene soundscapes</h2>
        </div>
        <Field label="Scene">
          <select
            value={state.selectedSceneId}
            onChange={(event) =>
              dispatch({
                type: "select-scene",
                sceneId: id<"scene">(event.currentTarget.value),
              })
            }
          >
            {state.project.scenes.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="audio-scene-summary">
        <strong>{scene?.name ?? state.selectedSceneId}</strong>
        <span>{soundscape?.layers.length ?? 0} active layers</span>
      </div>
      {!soundscape ? (
        <div className="audio-empty-action">
          <p>This room has no authored music or ambience yet.</p>
          <Button onClick={addSoundscape}>Create soundscape</Button>
        </div>
      ) : (
        <>
          <div className="audio-layer-stack">
            {soundscape.layers.map((layer) => {
              const availableCues = manifest.cues.filter((cue) =>
                layer.role === "music"
                  ? cue.bus === "music"
                  : cue.bus === "ambience",
              );
              return (
                <article key={layer.id} className={`audio-layer role-${layer.role}`}>
                  <div className="audio-layer-title">
                    <span className={`audio-bus-dot bus-${layer.role === "music" ? "music" : "ambience"}`} />
                    <strong>{layer.id}</strong>
                    <Button
                      className="is-quiet"
                      onClick={() =>
                        execute(
                          {
                            kind: "remove-scene-layer",
                            sceneId: state.selectedSceneId,
                            layerId: layer.id,
                          },
                          "Removed soundscape layer.",
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="audio-layer-grid">
                    <Field label="Role">
                      <select
                        value={layer.role}
                        onChange={(event) => {
                          const role = event.currentTarget
                            .value as AudioSceneLayer["role"];
                          const expectedBus =
                            role === "music" ? "music" : "ambience";
                          const cue = manifest.cues.find(
                            (candidate) => candidate.bus === expectedBus,
                          );
                          if (!cue) return;
                          execute(
                            replaceSceneLayerCommand(state, {
                              ...layer,
                              role,
                              cueId: cue.id,
                            }),
                            "Updated soundscape role.",
                          );
                        }}
                      >
                        <option value="music">Music</option>
                        <option value="ambience">Ambience</option>
                        <option value="room-tone">Room tone</option>
                      </select>
                    </Field>
                    <Field label="Cue" wide>
                      <select
                        value={layer.cueId}
                        onChange={(event) =>
                          execute(
                            replaceSceneLayerCommand(state, {
                              ...layer,
                              cueId: id<"audio-cue">(
                                event.currentTarget.value,
                              ),
                            }),
                            "Changed soundscape cue.",
                          )
                        }
                      >
                        {availableCues.map((cue) => (
                          <option key={cue.id} value={cue.id}>
                            {cue.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Start delay">
                      <NumberInput
                        value={layer.startDelayTicks}
                        min={0}
                        max={3600}
                        onChange={(startDelayTicks) =>
                          execute(
                            replaceSceneLayerCommand(state, {
                              ...layer,
                              startDelayTicks: Math.round(startDelayTicks),
                            }),
                            "Updated layer delay.",
                          )
                        }
                      />
                    </Field>
                    <Field label="Fade in">
                      <NumberInput
                        value={layer.fadeInTicks}
                        min={0}
                        max={3600}
                        onChange={(fadeInTicks) =>
                          execute(
                            replaceSceneLayerCommand(state, {
                              ...layer,
                              fadeInTicks: Math.round(fadeInTicks),
                            }),
                            "Updated layer fade in.",
                          )
                        }
                      />
                    </Field>
                    <Field label="Fade out">
                      <NumberInput
                        value={layer.fadeOutTicks}
                        min={0}
                        max={3600}
                        onChange={(fadeOutTicks) =>
                          execute(
                            replaceSceneLayerCommand(state, {
                              ...layer,
                              fadeOutTicks: Math.round(fadeOutTicks),
                            }),
                            "Updated layer fade out.",
                          )
                        }
                      />
                    </Field>
                    <Field label="Re-entry">
                      <select
                        value={layer.restartPolicy}
                        onChange={(event) =>
                          execute(
                            replaceSceneLayerCommand(state, {
                              ...layer,
                              restartPolicy: event.currentTarget
                                .value as AudioSceneLayer["restartPolicy"],
                            }),
                            "Updated layer restart policy.",
                          )
                        }
                      >
                        <option value="continue">Continue</option>
                        <option value="resume">Resume offset</option>
                        <option value="restart">Restart</option>
                      </select>
                    </Field>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="audio-panel-actions">
            <Button onClick={addLayer}>Add layer</Button>
            <Button
              className="is-danger"
              onClick={() =>
                execute(
                  {
                    kind: "remove-soundscape",
                    sceneId: state.selectedSceneId,
                  },
                  "Removed scene soundscape.",
                )
              }
            >
              Remove soundscape
            </Button>
          </div>
        </>
      )}
    </section>
  );
};

const SpeechEditor = ({
  state,
  dispatch,
  execute,
}: {
  readonly state: AudioWorkspaceState;
  readonly dispatch: AudioDispatch;
  readonly execute: (command: AudioEditorCommand, notice?: string) => void;
}) => {
  const manifest = audioWorkspaceManifest(state);
  const binding = selectedAudioSpeechBinding(state);
  const speechCues = manifest.cues.filter((cue) => cue.bus === "speech");
  const lines = state.project.dialogues.flatMap((dialogue) =>
    dialogue.nodes.flatMap((node) =>
      node.lines.map((line) => ({
        id: line.id,
        label: `${dialogue.name}: ${line.text}`,
      })),
    ),
  );

  const addBinding = (): void => {
    const line = lines.find(
      (candidate) =>
        !manifest.speechBindings.some(
          (existing) => existing.dialogueLineId === candidate.id,
        ),
    );
    const cue = speechCues[0];
    if (!line || !cue) return;
    const bindingId = id<"audio-speech-binding">(
      `audio-speech-binding.custom.${manifest.speechBindings.length + 1}`,
    );
    execute(
      {
        kind: "insert-speech-binding",
        index: manifest.speechBindings.length,
        binding: {
          id: bindingId,
          dialogueLineId: line.id,
          cueId: cue.id,
          leadInTicks: 0,
          tailTicks: 0,
          markers: [],
        },
      },
      "Added speech binding.",
    );
    dispatch({ type: "select-binding", bindingId });
  };

  const replace = (next: AudioSpeechBinding, notice: string): void =>
    execute(replaceSpeechBindingCommand(next), notice);

  return (
    <section className="audio-panel audio-speech-panel">
      <div className="audio-panel-heading">
        <div>
          <span className="audio-eyebrow">Performance</span>
          <h2>Speech bindings</h2>
        </div>
        <Button
          onClick={addBinding}
          disabled={speechCues.length === 0 || lines.length === 0}
        >
          Bind line
        </Button>
      </div>
      <div className="audio-binding-tabs">
        {manifest.speechBindings.map((candidate) => (
          <button
            type="button"
            key={candidate.id}
            className={candidate.id === state.selectedBindingId ? "is-selected" : ""}
            onClick={() =>
              dispatch({ type: "select-binding", bindingId: candidate.id })
            }
          >
            {candidate.id.replace("audio-speech-binding.", "")}
          </button>
        ))}
      </div>
      {binding ? (
        <div className="audio-speech-layout">
          <div className="audio-inspector-grid">
            <Field label="Dialogue line" wide>
              <select
                value={binding.dialogueLineId}
                onChange={(event) =>
                  replace(
                    {
                      ...binding,
                      dialogueLineId: id<"dialogue-line">(
                        event.currentTarget.value,
                      ),
                    },
                    "Changed bound dialogue line.",
                  )
                }
              >
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Speech cue" wide>
              <select
                value={binding.cueId}
                onChange={(event) =>
                  replace(
                    {
                      ...binding,
                      cueId: id<"audio-cue">(event.currentTarget.value),
                    },
                    "Changed speech cue.",
                  )
                }
              >
                {speechCues.map((cue) => (
                  <option key={cue.id} value={cue.id}>
                    {cue.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lead in ticks">
              <NumberInput
                value={binding.leadInTicks}
                min={0}
                max={600}
                onChange={(leadInTicks) =>
                  replace(
                    { ...binding, leadInTicks: Math.round(leadInTicks) },
                    "Updated speech lead in.",
                  )
                }
              />
            </Field>
            <Field label="Tail ticks">
              <NumberInput
                value={binding.tailTicks}
                min={0}
                max={600}
                onChange={(tailTicks) =>
                  replace(
                    { ...binding, tailTicks: Math.round(tailTicks) },
                    "Updated speech tail.",
                  )
                }
              />
            </Field>
          </div>
          <div className="audio-marker-editor">
            <div className="audio-section-row">
              <h3>Mouth and performance markers</h3>
              <Button
                onClick={() => {
                  const previous = binding.markers.at(-1)?.atTick ?? -12;
                  replace(
                    {
                      ...binding,
                      markers: [
                        ...binding.markers,
                        { atTick: previous + 12, name: "mouth.open" },
                      ],
                    },
                    "Added speech marker.",
                  );
                }}
              >
                Add marker
              </Button>
            </div>
            {binding.markers.length === 0 ? (
              <p className="audio-empty">No performance markers authored.</p>
            ) : (
              <div className="audio-marker-list">
                {binding.markers.map((marker, markerIndex) => (
                  <div key={`${marker.atTick}:${marker.name}:${markerIndex}`}>
                    <NumberInput
                      value={marker.atTick}
                      min={0}
                      max={36_000}
                      onChange={(atTick) =>
                        replace(
                          {
                            ...binding,
                            markers: binding.markers.map((candidate, index) =>
                              index === markerIndex
                                ? { ...candidate, atTick: Math.round(atTick) }
                                : candidate,
                            ),
                          },
                          "Updated speech marker tick.",
                        )
                      }
                    />
                    <input
                      value={marker.name}
                      onChange={(event) =>
                        replace(
                          {
                            ...binding,
                            markers: binding.markers.map((candidate, index) =>
                              index === markerIndex
                                ? {
                                    ...candidate,
                                    name: event.currentTarget.value || "marker",
                                  }
                                : candidate,
                            ),
                          },
                          "Updated speech marker name.",
                        )
                      }
                    />
                    <Button
                      className="is-quiet"
                      onClick={() =>
                        replace(
                          {
                            ...binding,
                            markers: binding.markers.filter(
                              (_candidate, index) => index !== markerIndex,
                            ),
                          },
                          "Removed speech marker.",
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="audio-danger-row">
            <Button
              className="is-danger"
              onClick={() =>
                execute(
                  {
                    kind: "remove-speech-binding",
                    bindingId: binding.id,
                  },
                  "Removed speech binding.",
                )
              }
            >
              Remove binding
            </Button>
          </div>
        </div>
      ) : (
        <p className="audio-empty">No dialogue line is bound to recorded speech.</p>
      )}
    </section>
  );
};

const DuckingEditor = ({
  state,
  dispatch,
  execute,
}: {
  readonly state: AudioWorkspaceState;
  readonly dispatch: AudioDispatch;
  readonly execute: (command: AudioEditorCommand, notice?: string) => void;
}) => {
  const manifest = audioWorkspaceManifest(state);
  const selected = selectedAudioDuckingRule(state);

  const addRule = (): void => {
    const ruleId = id<"audio-ducking-rule">(
      `audio-ducking-rule.custom.${manifest.ducking.length + 1}`,
    );
    const rule: AudioDuckingRule = {
      id: ruleId,
      sourceBus: "speech",
      targetBus: "effects",
      targetVolume: 0.72,
      attackTicks: 4,
      releaseTicks: 12,
    };
    execute(
      {
        kind: "insert-ducking-rule",
        index: manifest.ducking.length,
        rule,
      },
      "Added ducking rule.",
    );
    dispatch({ type: "select-ducking-rule", ruleId });
  };

  const replace = (rule: AudioDuckingRule, notice: string): void =>
    execute(replaceDuckingRuleCommand(rule), notice);

  return (
    <section className="audio-panel audio-ducking-panel">
      <div className="audio-panel-heading">
        <div>
          <span className="audio-eyebrow">Clarity</span>
          <h2>Bus ducking</h2>
        </div>
        <Button onClick={addRule}>Add rule</Button>
      </div>
      <div className="audio-ducking-layout">
        <div className="audio-ducking-list">
          {manifest.ducking.map((rule) => (
            <button
              type="button"
              key={rule.id}
              className={
                rule.id === state.selectedDuckingRuleId ? "is-selected" : ""
              }
              onClick={() =>
                dispatch({ type: "select-ducking-rule", ruleId: rule.id })
              }
            >
              <strong>{rule.sourceBus}</strong>
              <span>ducks</span>
              <strong>{rule.targetBus}</strong>
              <small>{percent(rule.targetVolume)}</small>
            </button>
          ))}
        </div>
        {selected ? (
          <div className="audio-inspector-grid">
            <Field label="Source bus">
              <select
                value={selected.sourceBus}
                onChange={(event) =>
                  replace(
                    {
                      ...selected,
                      sourceBus: event.currentTarget
                        .value as AudioContentBusId,
                    },
                    "Changed ducking source bus.",
                  )
                }
              >
                {audioContentBusIds.map((busId) => (
                  <option key={busId} value={busId}>
                    {busId}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target bus">
              <select
                value={selected.targetBus}
                onChange={(event) =>
                  replace(
                    {
                      ...selected,
                      targetBus: event.currentTarget
                        .value as AudioContentBusId,
                    },
                    "Changed ducking target bus.",
                  )
                }
              >
                {audioContentBusIds.map((busId) => (
                  <option key={busId} value={busId}>
                    {busId}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Target level ${percent(selected.targetVolume)}`} wide>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(selected.targetVolume * 100)}
                onChange={(event) =>
                  replace(
                    {
                      ...selected,
                      targetVolume: Number(event.currentTarget.value) / 100,
                    },
                    "Adjusted ducking target level.",
                  )
                }
              />
            </Field>
            <Field label="Attack ticks">
              <NumberInput
                value={selected.attackTicks}
                min={0}
                max={600}
                onChange={(attackTicks) =>
                  replace(
                    { ...selected, attackTicks: Math.round(attackTicks) },
                    "Updated ducking attack.",
                  )
                }
              />
            </Field>
            <Field label="Release ticks">
              <NumberInput
                value={selected.releaseTicks}
                min={0}
                max={600}
                onChange={(releaseTicks) =>
                  replace(
                    { ...selected, releaseTicks: Math.round(releaseTicks) },
                    "Updated ducking release.",
                  )
                }
              />
            </Field>
            <div className="audio-danger-row">
              <Button
                className="is-danger"
                onClick={() =>
                  execute(
                    {
                      kind: "remove-ducking-rule",
                      ruleId: selected.id,
                    },
                    "Removed ducking rule.",
                  )
                }
              >
                Remove rule
              </Button>
            </div>
          </div>
        ) : (
          <p className="audio-empty">No ducking rules authored.</p>
        )}
      </div>
    </section>
  );
};

export const AudioApp = () => {
  const [state, dispatch] = useReducer(
    audioWorkspaceReducer,
    createAudioWorkspace(studioAudioProject, studioAudioMix),
  );
  const manifest = audioWorkspaceManifest(state);
  const issues = useMemo(() => audioIssuesForSelection(state), [state]);
  const allIssues = useMemo(
    () =>
      state.project
        ? audioIssuesForSelection({
            ...state,
            selectedCueId: null,
            selectedBindingId: null,
            selectedDuckingRuleId: null,
          })
        : [],
    [state],
  );
  const errorCount = allIssues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = allIssues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  const execute = useCallback(
    (command: AudioEditorCommand, notice?: string): void =>
      dispatch({ type: "execute", command, ...(notice ? { notice } : {}) }),
    [],
  );

  return (
    <main className="audio-studio">
      <header className="audio-topbar">
        <div>
          <span className="audio-eyebrow">EVAVO Adventure Studio</span>
          <h1>Audio Studio</h1>
          <p>
            Author deterministic music, room tone, speech, effects, fades,
            looping, polyphony, and mix clarity at the project tick rate.
          </p>
        </div>
        <div className="audio-toolbar">
          <Button
            disabled={state.history.undoStack.length === 0}
            onClick={() => dispatch({ type: "undo" })}
          >
            Undo
          </Button>
          <Button
            disabled={state.history.redoStack.length === 0}
            onClick={() => dispatch({ type: "redo" })}
          >
            Redo
          </Button>
          <Button
            disabled={!audioWorkspaceIsDirty(state)}
            onClick={() => dispatch({ type: "mark-saved" })}
          >
            Mark saved
          </Button>
          <Button className="is-primary" onClick={() => downloadManifest(state)}>
            Export mix
          </Button>
        </div>
      </header>

      <section className="audio-summary-grid" aria-label="Audio project summary">
        <article>
          <span>Cues</span>
          <strong>{manifest.cues.length}</strong>
          <small>{manifest.cues.filter((cue) => cue.loop).length} looped</small>
        </article>
        <article>
          <span>Soundscapes</span>
          <strong>{manifest.soundscapes.length}</strong>
          <small>{manifest.soundscapes.reduce((sum, item) => sum + item.layers.length, 0)} layers</small>
        </article>
        <article>
          <span>Speech</span>
          <strong>{manifest.speechBindings.length}</strong>
          <small>{manifest.speechBindings.reduce((sum, item) => sum + item.markers.length, 0)} markers</small>
        </article>
        <article className={errorCount > 0 ? "has-errors" : warningCount > 0 ? "has-warnings" : "is-clean"}>
          <span>Validation</span>
          <strong>{errorCount > 0 ? errorCount : warningCount}</strong>
          <small>{errorCount > 0 ? "blocking errors" : warningCount > 0 ? "warnings" : "clean"}</small>
        </article>
      </section>

      <section className="audio-panel audio-mixer-panel">
        <div className="audio-panel-heading">
          <div>
            <span className="audio-eyebrow">Mixer</span>
            <h2>Runtime buses</h2>
          </div>
          <span className="audio-tick-rate">
            {manifest.logicalTicksPerSecond} ticks / second
          </span>
        </div>
        <div className="audio-bus-grid">
          {manifest.buses.map((bus) => (
            <BusStrip key={bus.id} bus={bus} execute={execute} />
          ))}
        </div>
      </section>

      <CueInspector state={state} dispatch={dispatch} execute={execute} />
      <div className="audio-two-column">
        <SoundscapeEditor
          state={state}
          dispatch={dispatch}
          execute={execute}
        />
        <DuckingEditor state={state} dispatch={dispatch} execute={execute} />
      </div>
      <SpeechEditor state={state} dispatch={dispatch} execute={execute} />

      <section className="audio-panel audio-diagnostics-panel">
        <div className="audio-panel-heading">
          <div>
            <span className="audio-eyebrow">Guard rails</span>
            <h2>Selected diagnostics</h2>
          </div>
          <span>{issues.length} relevant</span>
        </div>
        {issues.length === 0 ? (
          <p className="audio-clean-copy">
            The selected cue, scene, speech binding, and ducking rule satisfy the
            canonical audio contract.
          </p>
        ) : (
          <div className="audio-issue-list">
            {issues.map((issue) => (
              <article key={`${issue.code}:${issue.path}`} className={`is-${issue.severity}`}>
                <strong>{issue.code}</strong>
                <code>{issue.path}</code>
                <p>{issue.message}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {state.notice ? (
        <button
          type="button"
          className="audio-notice"
          onClick={() => dispatch({ type: "clear-notice" })}
        >
          {state.notice}
        </button>
      ) : null}
    </main>
  );
};
