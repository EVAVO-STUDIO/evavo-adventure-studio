import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  adventurePuzzleDependencyOrder,
  validateAdventureDesignDocument,
  type AdventureCutscene,
  type AdventureDesignDocument,
  type AdventureDesignId,
  type AdventureMapLocation,
  type AdventurePuzzle,
} from "@evavo/adventure-design";
import {
  adventureDesignHistoryIsDirty,
  createAdventureDesignHistory,
  executeAdventureDesignCommand,
  markAdventureDesignSaved,
  redoAdventureDesignCommand,
  undoAdventureDesignCommand,
  type AdventureDesignCommand,
  type AdventureDesignHistoryState,
} from "@evavo/adventure-design/editor";
import { showcaseAdventureDesigns } from "@evavo/adventure-design/showcases";
import "./adventure-design.css";

type DesignSurface = "bible" | "map" | "puzzles" | "cutscenes";

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

const designId = <T extends string>(value: string): AdventureDesignId<T> =>
  value as AdventureDesignId<T>;

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

const CommitText = ({
  value,
  rows = 3,
  onCommit,
}: {
  readonly value: string;
  readonly rows?: number;
  readonly onCommit: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      rows={rows}
      value={draft}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
        setDraft(event.currentTarget.value)
      }
      onBlur={() => {
        const normalized = draft.trim();
        if (normalized && normalized !== value) onCommit(normalized);
        else setDraft(value);
      }}
    />
  );
};

const downloadDocument = (document: AdventureDesignDocument): void => {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(document, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${document.projectId}.adventure-design.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const NativePreview = ({ document }: { readonly document: AdventureDesignDocument }) => {
  const colours = document.creativeDirection.palette.keyColours;
  const colour = (index: number, fallback: string): string =>
    colours[index % Math.max(1, colours.length)] ?? fallback;
  return (
    <div className="design-native-frame" aria-label="Original native-resolution production study">
      <svg viewBox="0 0 320 200" role="img" aria-label={document.title}>
        <rect width="320" height="200" fill={colour(0, "#0a0b10")} />
        <path d="M0 0H320V104L0 126Z" fill={colour(1, "#1c2430")} />
        <path d="M0 126L320 104V200H0Z" fill={colour(2, "#4b3e35")} />
        <path d="M18 120L82 44L144 118Z" fill={colour(3, "#8c6a52")} opacity="0.72" />
        <path d="M178 114L238 34L307 105Z" fill={colour(4, "#607d78")} opacity="0.78" />
        <rect x="216" y="58" width="44" height="74" fill={colour(0, "#090a0e")} />
        <rect x="222" y="64" width="32" height="62" fill={colour(5, "#b95a68")} opacity="0.58" />
        <path d="M69 164L75 126L84 113L94 128L98 164Z" fill={colour(5, "#f05a6b")} />
        <circle cx="84" cy="107" r="8" fill={colour(3, "#d4b995")} />
        <path d="M79 105L84 92L91 106Z" fill={colour(0, "#0a0b10")} />
        <path d="M0 176Q75 160 150 177T320 170V200H0Z" fill={colour(0, "#090a0f")} opacity="0.62" />
        <rect x="18" y="178" width="116" height="2" fill={colour(5, "#ff244e")} />
      </svg>
      <span>320 × 200 native study</span>
    </div>
  );
};

const BibleSurface = ({ document }: { readonly document: AdventureDesignDocument }) => (
  <div className="design-surface-scroll">
    <section className="design-hero-grid">
      <NativePreview document={document} />
      <div className="design-promise-panel">
        <span className="design-eyebrow">PLAYER PROMISE</span>
        <h2>{document.playerPromise}</h2>
        <p>{document.pitch}</p>
        <dl>
          <div>
            <dt>Production</dt>
            <dd>{document.creativeDirection.productionMode}</dd>
          </div>
          <div>
            <dt>Composition</dt>
            <dd>{document.creativeDirection.compositionMode}</dd>
          </div>
          <div>
            <dt>Native canvas</dt>
            <dd>
              {document.creativeDirection.nativeSize.width} × {document.creativeDirection.nativeSize.height}
            </dd>
          </div>
          <div>
            <dt>Colour budget</dt>
            <dd>{document.creativeDirection.palette.maxColours}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section className="design-card design-palette-card">
      <header>
        <div>
          <span className="design-eyebrow">PALETTE ARCHITECTURE</span>
          <h2>Value before decoration</h2>
        </div>
        <strong>{document.creativeDirection.palette.keyColours.length} anchors</strong>
      </header>
      <div className="design-swatches">
        {document.creativeDirection.palette.keyColours.map((colour) => (
          <span key={colour} style={{ background: colour }} title={colour} />
        ))}
      </div>
      <div className="design-three-column-copy">
        <article>
          <h3>Shadow</h3>
          <p>{document.creativeDirection.palette.shadowRule}</p>
        </article>
        <article>
          <h3>Highlight</h3>
          <p>{document.creativeDirection.palette.highlightRule}</p>
        </article>
        <article>
          <h3>Dither</h3>
          <p>{document.creativeDirection.palette.ditherRule}</p>
        </article>
      </div>
    </section>

    <section className="design-doctrine-grid">
      {[
        ["Perspective", document.creativeDirection.perspective],
        ["Lighting", document.creativeDirection.lighting],
        ["Materials", document.creativeDirection.materialLanguage],
        ["Actor silhouette", document.creativeDirection.actorSilhouette],
        ["Background hierarchy", document.creativeDirection.backgroundHierarchy],
        ["Portraits", document.creativeDirection.portraitTreatment],
        ["Animation cadence", document.creativeDirection.animationCadence],
        ["Interface", document.creativeDirection.interfaceTreatment],
        ["Music", document.creativeDirection.musicDirection],
        ["Ambience", document.creativeDirection.ambienceDirection],
      ].map(([label, copy]) => (
        <article className="design-card" key={label}>
          <span className="design-eyebrow">{label}</span>
          <p>{copy}</p>
        </article>
      ))}
    </section>
  </div>
);

const MapSurface = ({
  document,
  selectedLocationId,
  onSelect,
}: {
  readonly document: AdventureDesignDocument;
  readonly selectedLocationId: string | null;
  readonly onSelect: (id: AdventureMapLocation["id"]) => void;
}) => (
  <div className="design-surface-scroll">
    <section className="design-card design-map-card">
      <header>
        <div>
          <span className="design-eyebrow">ILLUSTRATED WORLD MAP</span>
          <h2>{document.map.title}</h2>
        </div>
        <strong>{document.map.locations.length} locations</strong>
      </header>
      <p>{document.map.artBrief}</p>
      <div className="design-map-board">
        <svg viewBox="0 0 320 200" aria-label="Adventure route map">
          <defs>
            <pattern id="map-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M16 0H0V16" fill="none" stroke="currentColor" strokeOpacity="0.12" />
            </pattern>
          </defs>
          <rect width="320" height="200" fill="url(#map-grid)" />
          {document.map.routes.map((route) => {
            const from = document.map.locations.find((location) => location.id === route.fromLocationId);
            const to = document.map.locations.find((location) => location.id === route.toLocationId);
            return from && to ? (
              <g key={route.id}>
                <line
                  x1={from.position.x}
                  y1={from.position.y}
                  x2={to.position.x}
                  y2={to.position.y}
                  className="design-map-route"
                />
                <text
                  x={(from.position.x + to.position.x) / 2}
                  y={(from.position.y + to.position.y) / 2 - 6}
                  className="design-map-route-label"
                >
                  {route.travelMode}
                </text>
              </g>
            ) : null;
          })}
          {document.map.locations.map((location) => (
            <g
              key={location.id}
              role="button"
              tabIndex={0}
              className={`design-map-node${selectedLocationId === location.id ? " is-selected" : ""}`}
              transform={`translate(${location.position.x} ${location.position.y})`}
              onClick={() => onSelect(location.id)}
              onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
                if (event.key === "Enter" || event.key === " ") onSelect(location.id);
              }}
            >
              <circle r="13" />
              <circle r="4" className="design-map-node-core" />
              <text y="25">{location.name}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>

    <section className="design-chapter-grid">
      {document.chapters
        .slice()
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((chapter) => (
          <article className="design-card" key={chapter.id}>
            <span className="design-eyebrow">
              {chapter.mode} {chapter.ordinal}
            </span>
            <h2>{chapter.name}</h2>
            <p>{chapter.playerObjective}</p>
            <footer>
              <strong>{chapter.requiredPuzzleIds.length} required threads</strong>
              <span>{chapter.completionBeat}</span>
            </footer>
          </article>
        ))}
    </section>
  </div>
);

const PuzzleSurface = ({
  document,
  selectedPuzzleId,
  onSelect,
}: {
  readonly document: AdventureDesignDocument;
  readonly selectedPuzzleId: string | null;
  readonly onSelect: (id: AdventurePuzzle["id"]) => void;
}) => {
  const order = useMemo(() => adventurePuzzleDependencyOrder(document), [document]);
  return (
    <div className="design-surface-scroll">
      <section className="design-card">
        <header>
          <div>
            <span className="design-eyebrow">PUZZLE DEPENDENCY ORDER</span>
            <h2>Readable causality, productive alternatives</h2>
          </div>
          <strong>{document.puzzles.length} threads</strong>
        </header>
        <div className="design-puzzle-flow">
          {order.map((id, index) => {
            const puzzle = document.puzzles.find((candidate) => candidate.id === id)!;
            return (
              <button
                type="button"
                key={puzzle.id}
                className={`design-puzzle-node${selectedPuzzleId === puzzle.id ? " is-selected" : ""}`}
                onClick={() => onSelect(puzzle.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{puzzle.name}</strong>
                <small>{puzzle.storyPayoff}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="design-puzzle-grid">
        {document.puzzles.map((puzzle) => (
          <article
            className={`design-card design-puzzle-card${selectedPuzzleId === puzzle.id ? " is-selected" : ""}`}
            key={puzzle.id}
            onClick={() => onSelect(puzzle.id)}
          >
            <header>
              <div>
                <span className="design-eyebrow">{shortId(puzzle.chapterId)}</span>
                <h2>{puzzle.name}</h2>
              </div>
              <strong>{puzzle.score} pts</strong>
            </header>
            <p>{puzzle.goal}</p>
            <div className="design-chip-row">
              {puzzle.clueIds.map((clueId) => {
                const clue = document.clues.find((candidate) => candidate.id === clueId);
                return <span key={clueId}>{clue?.name ?? clueId}</span>;
              })}
            </div>
            <ol className="design-hint-ladder">
              {puzzle.hints.map((hint) => (
                <li key={hint.level}>
                  <span>{hint.level}</span>
                  <p>{hint.text}</p>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>
    </div>
  );
};

const ShotThumbnail = ({
  document,
  shot,
}: {
  readonly document: AdventureDesignDocument;
  readonly shot: AdventureCutscene["shots"][number];
}) => {
  const colours = document.creativeDirection.palette.keyColours;
  return (
    <svg viewBox="0 0 160 90" aria-label={shot.framing}>
      <rect width="160" height="90" fill={colours[0] ?? "#08090d"} />
      <path d="M0 50L160 34V90H0Z" fill={colours[1] ?? "#202630"} />
      <rect x="104" y="15" width="36" height="48" fill={colours[2] ?? "#4e4034"} />
      <path d="M42 76L47 43L55 33L64 45L67 76Z" fill={colours[4] ?? "#cc5268"} />
      <circle cx="55" cy="29" r="7" fill={colours[3] ?? "#d0b28f"} />
      <rect x="8" y="78" width="144" height="2" fill={colours[5] ?? "#ff244e"} />
    </svg>
  );
};

const CutsceneSurface = ({
  document,
  selectedCutsceneId,
  onSelect,
}: {
  readonly document: AdventureDesignDocument;
  readonly selectedCutsceneId: string | null;
  readonly onSelect: (id: AdventureCutscene["id"]) => void;
}) => (
  <div className="design-surface-scroll">
    {document.cutscenes.map((cutscene) => (
      <section
        className={`design-card design-cutscene-card${selectedCutsceneId === cutscene.id ? " is-selected" : ""}`}
        key={cutscene.id}
      >
        <header onClick={() => onSelect(cutscene.id)}>
          <div>
            <span className="design-eyebrow">STORYBOARD · {cutscene.trigger.kind}</span>
            <h2>{cutscene.name}</h2>
          </div>
          <strong>{cutscene.skippable ? "SKIPPABLE · CONVERGENT" : "UNSKIPPABLE"}</strong>
        </header>
        <div className="design-storyboard">
          {cutscene.shots
            .slice()
            .sort((left, right) => left.order - right.order)
            .map((shot) => (
              <article key={shot.id} onClick={() => onSelect(cutscene.id)}>
                <ShotThumbnail document={document} shot={shot} />
                <span>SHOT {shot.order + 1} · {shot.durationTicks}t</span>
                <h3>{shot.framing}</h3>
                <p>{shot.staging}</p>
                <footer>{shot.transition}</footer>
              </article>
            ))}
        </div>
      </section>
    ))}
  </div>
);

const Inspector = ({
  surface,
  history,
  execute,
  selectedLocationId,
  selectedPuzzleId,
  selectedCutsceneId,
}: {
  readonly surface: DesignSurface;
  readonly history: AdventureDesignHistoryState;
  readonly execute: (command: AdventureDesignCommand, notice: string) => void;
  readonly selectedLocationId: string | null;
  readonly selectedPuzzleId: string | null;
  readonly selectedCutsceneId: string | null;
}) => {
  const document = history.document;
  const selectedLocation =
    document.map.locations.find((location) => location.id === selectedLocationId) ??
    document.map.locations[0] ??
    null;
  const selectedPuzzle =
    document.puzzles.find((puzzle) => puzzle.id === selectedPuzzleId) ??
    document.puzzles[0] ??
    null;
  const selectedCutscene =
    document.cutscenes.find((cutscene) => cutscene.id === selectedCutsceneId) ??
    document.cutscenes[0] ??
    null;

  if (surface === "map" && selectedLocation) {
    return (
      <aside className="design-inspector">
        <span className="design-eyebrow">LOCATION INSPECTOR</span>
        <h2>{selectedLocation.name}</h2>
        <code>{selectedLocation.id}</code>
        <label>
          <span>Art brief</span>
          <CommitText
            value={selectedLocation.artBrief}
            rows={6}
            onCommit={(artBrief) =>
              execute(
                {
                  kind: "replace-location",
                  id: selectedLocation.id,
                  value: { ...selectedLocation, artBrief },
                },
                "Updated location art brief.",
              )
            }
          />
        </label>
        <label>
          <span>Arrival beat</span>
          <CommitText
            value={selectedLocation.arrivalBeat}
            rows={5}
            onCommit={(arrivalBeat) =>
              execute(
                {
                  kind: "replace-location",
                  id: selectedLocation.id,
                  value: { ...selectedLocation, arrivalBeat },
                },
                "Updated arrival beat.",
              )
            }
          />
        </label>
        <dl>
          <div><dt>Kind</dt><dd>{selectedLocation.kind}</dd></div>
          <div><dt>Scene</dt><dd>{selectedLocation.sceneId ?? "Design only"}</dd></div>
          <div><dt>Unlocks</dt><dd>{selectedLocation.unlockedByPuzzleIds.length}</dd></div>
        </dl>
      </aside>
    );
  }

  if (surface === "puzzles" && selectedPuzzle) {
    return (
      <aside className="design-inspector">
        <span className="design-eyebrow">PUZZLE INSPECTOR</span>
        <h2>{selectedPuzzle.name}</h2>
        <code>{selectedPuzzle.id}</code>
        <label>
          <span>Player goal</span>
          <CommitText
            value={selectedPuzzle.goal}
            rows={5}
            onCommit={(goal) =>
              execute(
                {
                  kind: "replace-puzzle",
                  id: selectedPuzzle.id,
                  value: { ...selectedPuzzle, goal },
                },
                "Updated puzzle goal.",
              )
            }
          />
        </label>
        <label>
          <span>Story payoff</span>
          <CommitText
            value={selectedPuzzle.storyPayoff}
            rows={5}
            onCommit={(storyPayoff) =>
              execute(
                {
                  kind: "replace-puzzle",
                  id: selectedPuzzle.id,
                  value: { ...selectedPuzzle, storyPayoff },
                },
                "Updated puzzle payoff.",
              )
            }
          />
        </label>
        <dl>
          <div><dt>Solutions</dt><dd>{selectedPuzzle.solutions.length}</dd></div>
          <div><dt>Hints</dt><dd>{selectedPuzzle.hints.length}</dd></div>
          <div><dt>Failure</dt><dd>{selectedPuzzle.failure.mode}</dd></div>
          <div><dt>Score</dt><dd>{selectedPuzzle.score}</dd></div>
        </dl>
      </aside>
    );
  }

  if (surface === "cutscenes" && selectedCutscene) {
    const firstShot = selectedCutscene.shots[0];
    return (
      <aside className="design-inspector">
        <span className="design-eyebrow">CUTSCENE INSPECTOR</span>
        <h2>{selectedCutscene.name}</h2>
        <code>{selectedCutscene.id}</code>
        {firstShot ? (
          <>
            <label>
              <span>Opening shot staging</span>
              <CommitText
                value={firstShot.staging}
                rows={6}
                onCommit={(staging) =>
                  execute(
                    {
                      kind: "replace-cutscene",
                      id: selectedCutscene.id,
                      value: {
                        ...selectedCutscene,
                        shots: selectedCutscene.shots.map((shot) =>
                          shot.id === firstShot.id ? { ...shot, staging } : shot,
                        ),
                      },
                    },
                    "Updated opening storyboard shot.",
                  )
                }
              />
            </label>
            <label>
              <span>Camera rule</span>
              <CommitText
                value={firstShot.camera}
                rows={4}
                onCommit={(camera) =>
                  execute(
                    {
                      kind: "replace-cutscene",
                      id: selectedCutscene.id,
                      value: {
                        ...selectedCutscene,
                        shots: selectedCutscene.shots.map((shot) =>
                          shot.id === firstShot.id ? { ...shot, camera } : shot,
                        ),
                      },
                    },
                    "Updated opening camera rule.",
                  )
                }
              />
            </label>
          </>
        ) : null}
        <dl>
          <div><dt>Shots</dt><dd>{selectedCutscene.shots.length}</dd></div>
          <div><dt>Trigger</dt><dd>{selectedCutscene.trigger.kind}</dd></div>
          <div><dt>Final actions</dt><dd>{selectedCutscene.completionActions.length}</dd></div>
        </dl>
      </aside>
    );
  }

  return (
    <aside className="design-inspector">
      <span className="design-eyebrow">PRODUCTION BIBLE</span>
      <h2>Authenticity guardrails</h2>
      <div className="design-inspector-list">
        {document.creativeDirection.authenticityRules.map((rule) => (
          <article key={rule}><span>✓</span><p>{rule}</p></article>
        ))}
      </div>
      <span className="design-eyebrow design-inspector-section">PROHIBITED SHORTCUTS</span>
      <div className="design-inspector-list is-danger">
        {document.creativeDirection.prohibitedShortcuts.map((rule) => (
          <article key={rule}><span>×</span><p>{rule}</p></article>
        ))}
      </div>
    </aside>
  );
};

export const AdventureDesignApp = () => {
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const [history, setHistory] = useState(() =>
    createAdventureDesignHistory(showcaseAdventureDesigns[0]!),
  );
  const [surface, setSurface] = useState<DesignSurface>("bible");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    showcaseAdventureDesigns[0]!.map.locations[0]?.id ?? null,
  );
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(
    showcaseAdventureDesigns[0]!.puzzles[0]?.id ?? null,
  );
  const [selectedCutsceneId, setSelectedCutsceneId] = useState<string | null>(
    showcaseAdventureDesigns[0]!.cutscenes[0]?.id ?? null,
  );
  const [notice, setNotice] = useState("Original production template loaded.");
  const issues = useMemo(
    () => validateAdventureDesignDocument(history.document),
    [history.document],
  );
  const dirty = adventureDesignHistoryIsDirty(history);

  const loadShowcase = (index: number): void => {
    const document = showcaseAdventureDesigns[index];
    if (!document) return;
    setShowcaseIndex(index);
    setHistory(createAdventureDesignHistory(document));
    setSelectedLocationId(document.map.locations[0]?.id ?? null);
    setSelectedPuzzleId(document.puzzles[0]?.id ?? null);
    setSelectedCutsceneId(document.cutscenes[0]?.id ?? null);
    setNotice(`Loaded ${document.title}.`);
  };

  const chooseShowcase = (event: ChangeEvent<HTMLSelectElement>): void => {
    loadShowcase(Number(event.currentTarget.value));
  };

  const execute = (command: AdventureDesignCommand, nextNotice: string): void => {
    try {
      setHistory((current) => executeAdventureDesignCommand(current, command));
      setNotice(nextNotice);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Design command failed.");
    }
  };

  const addPuzzleThread = (): void => {
    const chapter = history.document.chapters[0];
    const location = history.document.map.locations[0];
    if (!chapter || !location) return;
    const suffix = `${history.revision + 1}`;
    const clueId = designId<"clue">(`clue.custom.${suffix}`);
    const puzzleId = designId<"puzzle">(`puzzle.custom.${suffix}`);
    execute(
      {
        kind: "batch",
        commands: [
          {
            kind: "insert-clue",
            index: history.document.clues.length,
            value: {
              id: clueId,
              name: `New clue ${suffix}`,
              delivery: "environment",
              locationId: location.id,
              chapterId: chapter.id,
              text: "Describe an observable fact that teaches the rule without announcing the answer.",
              guaranteed: true,
              supportsPuzzleIds: [puzzleId],
            },
          },
          {
            kind: "insert-puzzle",
            index: history.document.puzzles.length,
            value: {
              id: puzzleId,
              name: `New puzzle thread ${suffix}`,
              chapterId: chapter.id,
              locationId: location.id,
              goal: "State a concrete player-facing objective.",
              storyPayoff: "State what changes in story, access or character understanding.",
              problemIntroducedBeforeSolution: true,
              dependencyIds: [],
              clueIds: [clueId],
              solutions: [
                {
                  id: designId<"puzzle-solution">(`solution.custom.${suffix}`),
                  label: "Primary observed solution",
                  steps: [
                    {
                      id: designId<"puzzle-step">(`step.custom.${suffix}.one`),
                      verb: "look",
                      target: "authored clue",
                      result: "The player understands the relevant physical or social rule.",
                      clueIds: [clueId],
                    },
                  ],
                },
              ],
              hints: [
                { level: 1, text: "Redirect attention to the important irregularity." },
                { level: 2, text: "Explain the governing rule without naming the final action." },
                { level: 3, text: "Name the intended action and target explicitly." },
              ],
              failure: {
                mode: "setback",
                warning: "The scene communicates risk before commitment.",
                recovery: "Return control without removing essential information.",
              },
              score: 5,
              optional: false,
              rationale: "Explain why this belongs in the player's emotional and mechanical arc.",
            },
          },
          {
            kind: "replace-chapter",
            id: chapter.id,
            value: {
              ...chapter,
              requiredPuzzleIds: [...chapter.requiredPuzzleIds, puzzleId],
            },
          },
        ],
      },
      "Created an atomic clue and puzzle thread.",
    );
    setSelectedPuzzleId(puzzleId);
    setSurface("puzzles");
  };

  const addCutscene = (): void => {
    const chapter = history.document.chapters[0];
    if (!chapter) return;
    const suffix = `${history.revision + 1}`;
    const cutsceneId = designId<"cutscene">(`cutscene.custom.${suffix}`);
    execute(
      {
        kind: "batch",
        commands: [
          {
            kind: "insert-cutscene",
            index: history.document.cutscenes.length,
            value: {
              id: cutsceneId,
              name: `New chapter beat ${suffix}`,
              chapterId: chapter.id,
              trigger: { kind: "chapter-close", chapterId: chapter.id },
              skippable: true,
              completionActions: [
                {
                  kind: "set-flag",
                  flag: `custom-cutscene-${suffix}-complete`,
                  value: true,
                },
              ],
              shots: [
                {
                  id: designId<"cutscene-shot">(`shot.custom.${suffix}.one`),
                  order: 0,
                  durationTicks: 90,
                  framing: "Wide establishing composition",
                  camera: "Locked native camera",
                  staging: "Establish geography, intent and the changed state before dialogue.",
                  transition: "Cut on action into the next playable scene",
                },
              ],
            },
          },
          {
            kind: "replace-chapter",
            id: chapter.id,
            value: { ...chapter, closingCutsceneId: cutsceneId },
          },
        ],
      },
      "Created a convergent chapter-closing storyboard.",
    );
    setSelectedCutsceneId(cutsceneId);
    setSurface("cutscenes");
  };

  return (
    <main className="design-app">
      <header className="design-topbar">
        <div className="design-brand">
          <span>EV</span>
          <div><strong>ADVENTURE DESIGN DIRECTOR</strong><small>AUTHENTIC PRODUCTION BIBLE</small></div>
        </div>
        <div className="design-document-title">
          <strong>{history.document.title}</strong>
          <span>{dirty ? "UNSAVED" : "SAVED"}</span>
        </div>
        <div className="design-top-actions">
          <Button onClick={() => setHistory(undoAdventureDesignCommand(history))} disabled={history.undoStack.length === 0}>Undo</Button>
          <Button onClick={() => setHistory(redoAdventureDesignCommand(history))} disabled={history.redoStack.length === 0}>Redo</Button>
          <Button
            className="primary-button"
            onClick={() => {
              setHistory(markAdventureDesignSaved(history));
              setNotice("Marked the current design document as saved.");
            }}
            disabled={!dirty}
          >
            Save state
          </Button>
          <Button onClick={() => downloadDocument(history.document)}>Export JSON</Button>
        </div>
      </header>

      <nav className="design-toolbar" aria-label="Adventure design surfaces">
        <div>
          {(["bible", "map", "puzzles", "cutscenes"] as const).map((item) => (
            <Button key={item} active={surface === item} onClick={() => setSurface(item)}>
              {item === "bible" ? "Direction Bible" : item === "map" ? "Map & Chapters" : item === "puzzles" ? "Puzzles & Clues" : "Cutscene Storyboard"}
            </Button>
          ))}
        </div>
        <div>
          <Button onClick={addPuzzleThread}>+ Puzzle thread</Button>
          <Button onClick={addCutscene}>+ Cutscene</Button>
        </div>
      </nav>

      <div className="design-workspace">
        <aside className="design-library">
          <div className="design-panel-heading">
            <span className="design-eyebrow">ORIGINAL SHOWCASES</span>
            <h2>Production identities</h2>
          </div>
          <label className="design-select-field">
            <span>Current design</span>
            <select value={showcaseIndex} onChange={chooseShowcase}>
              {showcaseAdventureDesigns.map((document, index) => (
                <option key={document.projectId} value={index}>{document.title}</option>
              ))}
            </select>
          </label>
          <div className="design-showcase-list">
            {showcaseAdventureDesigns.map((document, index) => (
              <button
                type="button"
                key={document.projectId}
                className={showcaseIndex === index ? "is-selected" : ""}
                onClick={() => loadShowcase(index)}
              >
                <strong>{document.title}</strong>
                <span>{document.creativeDirection.productionMode}</span>
              </button>
            ))}
          </div>
          <div className="design-validation-summary">
            <span className="design-eyebrow">DESIGN REVIEW</span>
            <strong>{issues.length === 0 ? "Production coherent" : `${issues.length} issue(s)`}</strong>
            <p>{issues[0]?.message ?? "Puzzle causality, references, hints and cutscene convergence are coherent."}</p>
          </div>
          <div className="design-notice" role="status">{notice}</div>
        </aside>

        <section className="design-canvas">
          {surface === "bible" ? <BibleSurface document={history.document} /> : null}
          {surface === "map" ? (
            <MapSurface
              document={history.document}
              selectedLocationId={selectedLocationId}
              onSelect={(id) => setSelectedLocationId(id)}
            />
          ) : null}
          {surface === "puzzles" ? (
            <PuzzleSurface
              document={history.document}
              selectedPuzzleId={selectedPuzzleId}
              onSelect={(id) => setSelectedPuzzleId(id)}
            />
          ) : null}
          {surface === "cutscenes" ? (
            <CutsceneSurface
              document={history.document}
              selectedCutsceneId={selectedCutsceneId}
              onSelect={(id) => setSelectedCutsceneId(id)}
            />
          ) : null}
        </section>

        <Inspector
          surface={surface}
          history={history}
          execute={execute}
          selectedLocationId={selectedLocationId}
          selectedPuzzleId={selectedPuzzleId}
          selectedCutsceneId={selectedCutsceneId}
        />
      </div>
    </main>
  );
};
