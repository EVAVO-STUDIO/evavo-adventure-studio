import type { CSSProperties, ReactNode } from "react";
import type { AdventureProductionProfile } from "@evavo/adventure-design/production-profiles";
import type {
  AdventureCameraState,
  AdventureMotionTrace,
  AdventureMotionTraceSample,
  AdventurePlayFeelProfile,
} from "@evavo/adventure-play-feel";

export type MotionFeelView = "motion" | "camera" | "timing" | "contract";

export const MotionFeelButton = ({
  children,
  active = false,
  onClick,
}: {
  readonly children: ReactNode;
  readonly active?: boolean;
  readonly onClick: () => void;
}) => (
  <button
    type="button"
    className={`mfl-button${active ? " is-active" : ""}`}
    onClick={onClick}
  >
    {children}
  </button>
);

export const motionFeelStyle = (
  productionProfile: AdventureProductionProfile,
): CSSProperties => {
  const colours = productionProfile.palette.keyColours;
  return {
    "--mfl-ink": colours[0] ?? "#07090d",
    "--mfl-deep": colours[1] ?? "#1a2028",
    "--mfl-mid": colours[2] ?? "#4c6673",
    "--mfl-accent": colours[3] ?? "#ad4c43",
    "--mfl-warm": colours[4] ?? "#d5aa63",
    "--mfl-paper": colours[5] ?? "#e8e2cf",
  } as CSSProperties;
};

export const Metric = ({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly detail?: string;
}) => (
  <div className="mfl-metric">
    <dt>{label}</dt>
    <dd>{value}</dd>
    {detail ? <small>{detail}</small> : null}
  </div>
);

const phaseColourClass = (phase: AdventureMotionTraceSample["phase"]): string =>
  `is-${phase}`;

const sampledGhosts = (
  trace: AdventureMotionTrace,
): readonly AdventureMotionTraceSample[] => {
  const interval = Math.max(1, Math.floor(trace.arrivalTick / 12));
  return trace.samples.filter(
    (sample) => sample.tick % interval === 0 || sample.tick === trace.arrivalTick,
  );
};

export const MotionStage = ({
  profile,
  trace,
  sample,
  camera,
}: {
  readonly profile: AdventurePlayFeelProfile;
  readonly trace: AdventureMotionTrace;
  readonly sample: AdventureMotionTraceSample;
  readonly camera: AdventureCameraState;
}) => {
  const path = trace.route.points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
  const ghosts = sampledGhosts(trace);
  const cameraWidth = 220;
  const cameraHeight = 138;
  return (
    <div className="mfl-native-shell">
      <svg
        viewBox="0 0 480 240"
        role="img"
        aria-label={`${profile.label} deterministic motion stage`}
      >
        <defs>
          <pattern
            id={`mfl-grid-${profile.id}`}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <path d="M8 0H0V8" className="mfl-grid-line" fill="none" />
          </pattern>
          <linearGradient
            id={`mfl-ground-${profile.id}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" className="mfl-ground-start" />
            <stop offset="1" className="mfl-ground-end" />
          </linearGradient>
        </defs>
        <rect width="480" height="240" className="mfl-stage-background" />
        <rect
          width="480"
          height="240"
          fill={`url(#mfl-grid-${profile.id})`}
        />
        <path
          d="M0 119C80 96 144 101 218 117C302 135 388 116 480 93V240H0Z"
          fill={`url(#mfl-ground-${profile.id})`}
        />
        <path
          d="M32 86H119V136H32ZM330 60H438V130H330Z"
          className="mfl-architecture"
        />
        <path
          d="M58 86V45H95V86M352 60V31H405V60"
          className="mfl-architecture-detail"
        />
        <polyline points={path} className="mfl-route" />
        {trace.route.points.map((point, index) => (
          <g key={`${point.x}.${point.y}.${index}`} className="mfl-route-node">
            <circle cx={point.x} cy={point.y} r="4" />
            <text x={point.x + 6} y={point.y - 6}>
              {index + 1}
            </text>
          </g>
        ))}
        {ghosts.map((ghost) => (
          <g
            key={ghost.tick}
            className={`mfl-ghost ${phaseColourClass(ghost.phase)}`}
            transform={`translate(${ghost.position.x} ${ghost.position.y})`}
          >
            <circle r="3" />
            <line y1="-18" y2="0" />
          </g>
        ))}
        <g
          className={`mfl-actor ${phaseColourClass(sample.phase)}`}
          transform={`translate(${sample.position.x} ${sample.position.y})`}
        >
          <ellipse cy="2" rx="9" ry="3" className="mfl-actor-shadow" />
          <path d="M-6 -5L-5 -29L0 -38L6 -29L7 -5Z" />
          <circle cy="-43" r="6" />
          <path d="M-5 -27L-13 -14M6 -27L14 -17" />
          <path d="M-3 -5L-8 9M4 -5L9 9" />
        </g>
        <g
          className="mfl-camera-frame"
          transform={`translate(${camera.position.x} ${camera.position.y})`}
        >
          <rect width={cameraWidth} height={cameraHeight} />
          <path
            d={
              `M0 12V0H12M${cameraWidth - 12} 0H${cameraWidth}V12` +
              `M0 ${cameraHeight - 12}V${cameraHeight}H12` +
              `M${cameraWidth - 12} ${cameraHeight}H${cameraWidth}` +
              `V${cameraHeight - 12}`
            }
          />
          <text x="8" y="15">CAMERA</text>
        </g>
        <g className="mfl-stage-hud">
          <rect x="8" y="8" width="132" height="32" />
          <text x="16" y="22">
            TICK {sample.tick.toString().padStart(4, "0")}
          </text>
          <text x="16" y="34">
            {sample.phase.toLocaleUpperCase("en-US")} ·{" "}
            {sample.velocityPixelsPerSecond.toFixed(1)} PX/S
          </text>
        </g>
      </svg>
      <div className="mfl-native-footer">
        <span>canonical route position</span>
        <code>
          {sample.unquantizedPosition.x.toFixed(3)},{" "}
          {sample.unquantizedPosition.y.toFixed(3)}
        </code>
        <span>display position</span>
        <code>
          {sample.position.x.toFixed(3)}, {sample.position.y.toFixed(3)}
        </code>
      </div>
    </div>
  );
};

export const VelocityGraph = ({
  trace,
  activeTick,
}: {
  readonly trace: AdventureMotionTrace;
  readonly activeTick: number;
}) => {
  const width = 640;
  const height = 150;
  const maximum = Math.max(
    1,
    ...trace.samples.map((sample) => sample.velocityPixelsPerSecond),
  );
  const points = trace.samples
    .map((sample) => {
      const x = (sample.tick / trace.arrivalTick) * width;
      const y =
        height -
        (sample.velocityPixelsPerSecond / maximum) * (height - 20) -
        10;
      return `${x},${y}`;
    })
    .join(" ");
  const activeX = (activeTick / trace.arrivalTick) * width;
  return (
    <div className="mfl-velocity-graph">
      <header>
        <span>Velocity envelope</span>
        <strong>{maximum.toFixed(1)} PX/S</strong>
      </header>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Deterministic velocity envelope"
      >
        <path d={`M0 ${height - 10}H${width}`} className="mfl-chart-axis" />
        <polyline points={points} className="mfl-chart-line" />
        <line
          x1={activeX}
          x2={activeX}
          y1="0"
          y2={height}
          className="mfl-chart-cursor"
        />
      </svg>
    </div>
  );
};

export const TimingContract = ({
  profile,
}: {
  readonly profile: AdventurePlayFeelProfile;
}) => (
  <div className="mfl-contract-grid">
    <article>
      <span>MOVEMENT</span>
      <h3>{profile.movement.topSpeedPixelsPerSecond} px/s</h3>
      <p>
        {profile.movement.accelerationPixelsPerSecondSquared} px/s²
        acceleration · {profile.movement.decelerationPixelsPerSecondSquared}
        px/s² braking
      </p>
      <dl>
        <div>
          <dt>Turn threshold</dt>
          <dd>{profile.movement.turnSlowdownDegrees}°</dd>
        </div>
        <div>
          <dt>Corner speed</dt>
          <dd>{Math.round(profile.movement.turnSpeedMultiplier * 100)}%</dd>
        </div>
        <div>
          <dt>Retarget</dt>
          <dd>{profile.movement.retargetPolicy}</dd>
        </div>
        <div>
          <dt>Quantization</dt>
          <dd>{profile.movement.quantization}</dd>
        </div>
      </dl>
    </article>
    <article>
      <span>ANIMATION</span>
      <h3>{profile.animation.pixelsPerWalkCycle} px cycle</h3>
      <p>
        Distance-locked performance keeps footfalls independent of render
        cadence.
      </p>
      <dl>
        <div>
          <dt>Start pose</dt>
          <dd>{profile.animation.startPoseTicks} ticks</dd>
        </div>
        <div>
          <dt>Turn pose</dt>
          <dd>{profile.animation.turnPoseTicks} ticks</dd>
        </div>
        <div>
          <dt>Arrival pose</dt>
          <dd>{profile.animation.arrivalPoseTicks} ticks</dd>
        </div>
        <div>
          <dt>Idle hold</dt>
          <dd>{profile.animation.minimumIdleTicks} ticks</dd>
        </div>
      </dl>
    </article>
    <article>
      <span>CAMERA</span>
      <h3>{profile.camera.mode}</h3>
      <p>
        {profile.camera.lookAheadPixels} px look-ahead ·{" "}
        {profile.camera.settleTicks} tick settle
      </p>
      <dl>
        <div>
          <dt>Maximum speed</dt>
          <dd>{profile.camera.maximumSpeedPixelsPerSecond} px/s</dd>
        </div>
        <div>
          <dt>Acceleration</dt>
          <dd>{profile.camera.accelerationPixelsPerSecondSquared} px/s²</dd>
        </div>
        <div>
          <dt>Quantization</dt>
          <dd>{profile.camera.quantization}</dd>
        </div>
        <div>
          <dt>Interpolation</dt>
          <dd>{profile.presentation.renderInterpolation}</dd>
        </div>
      </dl>
    </article>
    <article>
      <span>INPUT + TRANSITIONS</span>
      <h3>{profile.input.commandBufferTicks} tick buffer</h3>
      <p>
        Intent is acknowledged immediately while canonical consequences remain
        tick ordered.
      </p>
      <dl>
        <div>
          <dt>Hover commit</dt>
          <dd>{profile.input.hoverCommitTicks} ticks</dd>
        </div>
        <div>
          <dt>Double activate</dt>
          <dd>{profile.input.doubleActivationWindowTicks} ticks</dd>
        </div>
        <div>
          <dt>Status hold</dt>
          <dd>{profile.presentation.statusMinimumTicks} ticks</dd>
        </div>
        <div>
          <dt>Scene transition</dt>
          <dd>
            {profile.presentation.sceneFadeOutTicks +
              profile.presentation.sceneDarkHoldTicks +
              profile.presentation.sceneFadeInTicks}{" "}
            ticks
          </dd>
        </div>
      </dl>
    </article>
  </div>
);
