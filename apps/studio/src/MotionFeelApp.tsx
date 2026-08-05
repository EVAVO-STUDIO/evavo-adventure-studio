import { useMemo, useState, type ChangeEvent } from "react";
import {
  adventureProductionProfiles,
  type AdventureProductionProfile,
} from "@evavo/adventure-design/production-profiles";
import {
  adventurePlayFeelProfileForProductionProfile,
  advanceAdventureCamera,
  advanceAdventureFramePacing,
  auditAdventureMotionTrace,
  auditAdventurePlayFeelProfile,
  createAdventureCameraState,
  createAdventureFramePacingState,
  simulateAdventureMotion,
} from "@evavo/adventure-play-feel";
import {
  Metric,
  MotionFeelButton,
  MotionStage,
  TimingContract,
  VelocityGraph,
  motionFeelStyle,
  type MotionFeelView,
} from "./motion-feel-components.js";
import "./motion-feel.css";

const route = [
  { x: 28, y: 186 },
  { x: 152, y: 186 },
  { x: 204, y: 142 },
  { x: 328, y: 142 },
  { x: 432, y: 178 },
] as const;

const cameraTrace = (
  profile: ReturnType<typeof adventurePlayFeelProfileForProductionProfile>,
  samples: ReturnType<typeof simulateAdventureMotion>["samples"],
) => {
  let camera = createAdventureCameraState();
  const states = [camera];
  for (const sample of samples.slice(1)) {
    const previous = samples[Math.max(0, sample.tick - 1)] ?? sample;
    const velocity = {
      x:
        (sample.unquantizedPosition.x - previous.unquantizedPosition.x) *
        profile.logicalTicksPerSecond,
      y:
        (sample.unquantizedPosition.y - previous.unquantizedPosition.y) *
        profile.logicalTicksPerSecond,
    };
    camera = advanceAdventureCamera(
      camera,
      {
        position: sample.unquantizedPosition,
        velocityPixelsPerSecond: velocity,
        ...(profile.camera.mode === "shot-led"
          ? {
              shotPosition: {
                x: sample.tick < samples.length * 0.52 ? 0 : 160,
                y: sample.tick < samples.length * 0.72 ? 20 : 40,
              },
            }
          : {}),
      },
      { width: 220, height: 138 },
      { width: 480, height: 240 },
      profile,
    ).state;
    states.push(camera);
  }
  return states;
};

const pacingEvidence = (
  profile: ReturnType<typeof adventurePlayFeelProfileForProductionProfile>,
) => {
  const deltas = [16, 17, 16, 33, 8, 24, 120, 16, 250, 16] as const;
  let state = createAdventureFramePacingState();
  return deltas.map((milliseconds, index) => {
    const advanced = advanceAdventureFramePacing(state, milliseconds, profile);
    state = advanced.state;
    return { frame: index + 1, milliseconds, ...advanced };
  });
};

const profileAt = (index: number): AdventureProductionProfile =>
  adventureProductionProfiles[index] ?? adventureProductionProfiles[0]!;

export const MotionFeelApp = () => {
  const [profileIndex, setProfileIndex] = useState(0);
  const [view, setView] = useState<MotionFeelView>("motion");
  const [sampleTick, setSampleTick] = useState(0);
  const productionProfile = profileAt(profileIndex);
  const profile = useMemo(
    () => adventurePlayFeelProfileForProductionProfile(productionProfile.id),
    [productionProfile.id],
  );
  const trace = useMemo(() => simulateAdventureMotion(route, profile), [profile]);
  const cameras = useMemo(() => cameraTrace(profile, trace.samples), [profile, trace]);
  const pacing = useMemo(() => pacingEvidence(profile), [profile]);
  const boundedTick = Math.min(sampleTick, trace.arrivalTick);
  const sample = trace.samples[boundedTick] ?? trace.samples.at(-1)!;
  const camera = cameras[boundedTick] ?? cameras.at(-1)!;
  const traceIssues = useMemo(
    () => auditAdventureMotionTrace(trace, profile),
    [trace, profile],
  );
  const profileReport = useMemo(
    () =>
      auditAdventurePlayFeelProfile(profile, {
        logicalTicksPerSecond: profile.logicalTicksPerSecond,
        pixelMotionPolicy:
          productionProfile.pixelMotionPolicy === "free"
            ? "free"
            : productionProfile.pixelMotionPolicy,
        renderInterpolation: profile.presentation.renderInterpolation,
      }),
    [profile, productionProfile],
  );
  const footfalls = trace.samples.filter((entry) => entry.footfall !== null).length;
  const droppedMilliseconds = pacing.reduce(
    (total, entry) => total + entry.droppedMilliseconds,
    0,
  );

  const selectProfile = (index: number): void => {
    setProfileIndex(index);
    setSampleTick(0);
  };

  return (
    <main className="mfl-app" style={motionFeelStyle(productionProfile)}>
      <header className="mfl-topbar">
        <div className="mfl-brand">
          <span className="mfl-brand-mark">M</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Motion & Timing Lab</strong>
          </div>
        </div>
        <label className="mfl-profile-picker">
          <span>Production family</span>
          <select
            value={profileIndex}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              selectProfile(Number(event.currentTarget.value))
            }
          >
            {adventureProductionProfiles.map((candidate, index) => (
              <option key={candidate.id} value={index}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <div className={`mfl-ready-state is-${profileReport.status}`}>
          <span />
          <strong>{profileReport.status}</strong>
          <em>{profileReport.score}/100</em>
        </div>
      </header>

      <nav className="mfl-toolbar" aria-label="Motion and timing lab views">
        <div>
          <MotionFeelButton active={view === "motion"} onClick={() => setView("motion")}>
            Motion
          </MotionFeelButton>
          <MotionFeelButton active={view === "camera"} onClick={() => setView("camera")}>
            Camera
          </MotionFeelButton>
          <MotionFeelButton active={view === "timing"} onClick={() => setView("timing")}>
            Frame timing
          </MotionFeelButton>
          <MotionFeelButton active={view === "contract"} onClick={() => setView("contract")}>
            Contract
          </MotionFeelButton>
        </div>
        <p>
          Fixed-step story state · bounded kinematics · native display
          quantization
        </p>
      </nav>

      <div className="mfl-workspace">
        <aside className="mfl-rail">
          <section>
            <span className="mfl-eyebrow">SELECTED PLAY-FEEL CONTRACT</span>
            <h1>{profile.label}</h1>
            <p>{profile.summary}</p>
            <code>{profile.id}</code>
          </section>
          <dl className="mfl-metrics">
            <Metric
              label="Logical rate"
              value={`${profile.logicalTicksPerSecond} Hz`}
            />
            <Metric
              label="Top speed"
              value={`${profile.movement.topSpeedPixelsPerSecond} px/s`}
            />
            <Metric
              label="Arrival"
              value={`${trace.arrivalTick} ticks`}
              detail={`${(
                trace.arrivalTick / profile.logicalTicksPerSecond
              ).toFixed(2)} seconds`}
            />
            <Metric
              label="Walk cycle"
              value={`${profile.animation.pixelsPerWalkCycle} px`}
            />
            <Metric label="Footfalls" value={footfalls} />
            <Metric label="Camera" value={profile.camera.mode} />
            <Metric
              label="Interpolation"
              value={profile.presentation.renderInterpolation}
            />
          </dl>
          <section className="mfl-profile-stack">
            <span className="mfl-eyebrow">FAMILY COMPARISON</span>
            {adventureProductionProfiles.map((candidate, index) => {
              const candidateFeel =
                adventurePlayFeelProfileForProductionProfile(candidate.id);
              return (
                <button
                  type="button"
                  key={candidate.id}
                  className={index === profileIndex ? "is-selected" : ""}
                  onClick={() => selectProfile(index)}
                >
                  <span>{candidate.label}</span>
                  <strong>
                    {candidateFeel.movement.topSpeedPixelsPerSecond}
                  </strong>
                  <small>px/s</small>
                </button>
              );
            })}
          </section>
        </aside>

        <section className="mfl-canvas">
          {view === "motion" || view === "camera" ? (
            <>
              <header className="mfl-stage-heading">
                <div>
                  <span className="mfl-eyebrow">
                    {view === "camera"
                      ? "CAMERA + ACTOR COORDINATION"
                      : "DETERMINISTIC NATIVE KINEMATICS"}
                  </span>
                  <h1>
                    {view === "camera"
                      ? `${profile.camera.mode} camera`
                      : "Authored movement envelope"}
                  </h1>
                  <p>
                    {view === "camera"
                      ? "The camera follows only within its family contract " +
                        "while hit geometry remains in canonical world coordinates."
                      : "Acceleration, braking, sharp-corner slowdown, route " +
                        "quantization and distance-locked footfalls are " +
                        "evaluated on logical ticks."}
                  </p>
                </div>
                <div className="mfl-tick-readout">
                  <strong>{boundedTick}</strong>
                  <span>/ {trace.arrivalTick}</span>
                </div>
              </header>
              <MotionStage
                profile={profile}
                trace={trace}
                sample={sample}
                camera={camera}
              />
              <label className="mfl-scrubber">
                <span>Logical tick</span>
                <input
                  type="range"
                  min="0"
                  max={trace.arrivalTick}
                  value={boundedTick}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSampleTick(Number(event.currentTarget.value))
                  }
                />
                <output>
                  {sample.phase} · {sample.velocityPixelsPerSecond.toFixed(1)}
                  px/s
                </output>
              </label>
              <VelocityGraph trace={trace} activeTick={boundedTick} />
            </>
          ) : null}

          {view === "timing" ? (
            <section className="mfl-timing-view">
              <header>
                <div>
                  <span className="mfl-eyebrow">RENDER CADENCE EVIDENCE</span>
                  <h1>Simulation never inherits monitor jitter</h1>
                  <p>
                    Irregular frame deltas are converted into bounded logical
                    ticks. Only the profile-authorized camera interpolation
                    fraction is exposed to presentation.
                  </p>
                </div>
                <div className="mfl-drop-summary">
                  <strong>{droppedMilliseconds.toFixed(1)}</strong>
                  <span>ms deliberately dropped</span>
                </div>
              </header>
              <div
                className="mfl-frame-table"
                role="table"
                aria-label="Frame pacing evidence"
              >
                <div role="row" className="is-header">
                  <span>Frame</span>
                  <span>Delta</span>
                  <span>Ticks</span>
                  <span>Logical</span>
                  <span>Alpha</span>
                  <span>Dropped</span>
                </div>
                {pacing.map((entry) => (
                  <div role="row" key={entry.frame}>
                    <span>{entry.frame}</span>
                    <span>{entry.milliseconds} ms</span>
                    <strong>{entry.ticksToRun}</strong>
                    <span>{entry.state.logicalTick}</span>
                    <span>{entry.interpolationAlpha.toFixed(3)}</span>
                    <span>{entry.droppedMilliseconds.toFixed(1)} ms</span>
                  </div>
                ))}
              </div>
              <div className="mfl-timing-rules">
                <article>
                  <span>01</span>
                  <h2>Canonical ticks first</h2>
                  <p>
                    Input, movement, dialogue, sequences, score and saves
                    advance only on logical ticks.
                  </p>
                </article>
                <article>
                  <span>02</span>
                  <h2>Presentation is bounded</h2>
                  <p>
                    Large frame stalls cannot run an unbounded catch-up loop
                    or fast-forward puzzle state.
                  </p>
                </article>
                <article>
                  <span>03</span>
                  <h2>Interpolation is selective</h2>
                  <p>
                    Profiles may interpolate camera presentation, but never
                    canonical actors or interaction geometry.
                  </p>
                </article>
              </div>
            </section>
          ) : null}

          {view === "contract" ? <TimingContract profile={profile} /> : null}
        </section>

        <aside className="mfl-inspector">
          <section>
            <span className="mfl-eyebrow">CURRENT SAMPLE</span>
            <h2>{sample.phase}</h2>
            <dl>
              <div>
                <dt>Tick</dt>
                <dd>{sample.tick}</dd>
              </div>
              <div>
                <dt>Distance</dt>
                <dd>{sample.distancePixels.toFixed(2)} px</dd>
              </div>
              <div>
                <dt>Velocity</dt>
                <dd>{sample.velocityPixelsPerSecond.toFixed(2)} px/s</dd>
              </div>
              <div>
                <dt>Walk phase</dt>
                <dd>{sample.walkCyclePhase.toFixed(3)}</dd>
              </div>
              <div>
                <dt>Footfall</dt>
                <dd>{sample.footfall ?? "—"}</dd>
              </div>
              <div>
                <dt>Camera</dt>
                <dd>
                  {camera.position.x}, {camera.position.y}
                </dd>
              </div>
            </dl>
          </section>
          <section>
            <span className="mfl-eyebrow">AUTHENTICITY RULES</span>
            <ol>
              {profile.authenticityRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </section>
          <section>
            <span className="mfl-eyebrow">PROHIBITED SHORTCUTS</span>
            <ol>
              {profile.prohibitedShortcuts.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </section>
          <section className="mfl-proof-boundary">
            <span className="mfl-eyebrow">PROOF BOUNDARY</span>
            <h2>
              {traceIssues.length === 0
                ? "Deterministic trace verified"
                : `${traceIssues.length} trace findings`}
            </h2>
            <p>
              This proves renderer-neutral timing and movement. Final
              character art, cursor feel, audio latency, scene composition and
              puzzle comprehension still require compiled Player evidence.
            </p>
          </section>
          <footer>
            <span>Feel contract v{profile.profileVersion}</span>
            <code>{productionProfile.id}</code>
          </footer>
        </aside>
      </div>
    </main>
  );
};
