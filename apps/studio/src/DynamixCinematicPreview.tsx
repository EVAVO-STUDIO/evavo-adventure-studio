import {
  formatDynamixGameClock,
  type DynamixCinematicContract,
  type DynamixCinematicState,
} from "@evavo/adventure-design/dynamix-cinematic";
import type { CSSProperties } from "react";

export const contractStyle = (contract: DynamixCinematicContract): CSSProperties =>
  ({
    "--dcl-ink": contract.id === "jade-horizon" ? "#08090c" : "#05080c",
    "--dcl-deep": contract.id === "jade-horizon" ? "#242733" : "#17242d",
    "--dcl-mid": contract.id === "jade-horizon" ? "#5c4d43" : "#3d5862",
    "--dcl-accent": contract.id === "jade-horizon" ? "#a13d37" : "#a3463f",
    "--dcl-warm": contract.id === "jade-horizon" ? "#b98a57" : "#9a8060",
    "--dcl-paper": contract.id === "jade-horizon" ? "#d7c5a4" : "#d2c8ac",
  }) as CSSProperties;

export const DynamixNativeScene = ({
  contract,
  state,
}: {
  readonly contract: DynamixCinematicContract;
  readonly state: DynamixCinematicState;
}) => {
  const action = state.activeAction
    ? contract.actions.find((candidate) => candidate.id === state.activeAction?.sequenceId)
    : null;
  const localTick = state.activeAction ? state.tick - state.activeAction.startedAtTick : 0;
  return (
    <div className={`dcl-native-frame is-${contract.id}`} style={contractStyle(contract)}>
      <svg
        viewBox="0 0 320 200"
        role="img"
        aria-label={`${contract.originalProofTitle} original native scene`}
        shapeRendering="crispEdges"
      >
        <rect width="320" height="200" className="dcl-sky" />
        {contract.id === "jade-horizon" ? (
          <>
            <path d="M0 92L54 68L106 82L162 54L218 78L270 58L320 88V200H0Z" className="dcl-far" />
            <rect x="18" y="56" width="104" height="74" className="dcl-building" />
            <path d="M12 56L68 32L128 56Z" className="dcl-roof" />
            <rect x="238" y="44" width="58" height="84" className="dcl-hangar" />
            <path d="M148 105L222 80L276 96L251 119L172 122Z" className="dcl-aircraft" />
            <path d="M0 126H320V200H0Z" className="dcl-ground" />
            <circle cx="28" cy="164" r="3" className="dcl-route-light" />
            <circle cx="76" cy="164" r="3" className="dcl-route-light" />
            <circle cx="124" cy="164" r="3" className="dcl-route-light" />
            <path d="M24 174H286" className="dcl-runway" />
          </>
        ) : (
          <>
            <rect x="0" y="24" width="94" height="132" className="dcl-building" />
            <rect x="102" y="42" width="92" height="114" className="dcl-building-mid" />
            <rect x="204" y="18" width="116" height="138" className="dcl-building" />
            <g className="dcl-windows">
              <rect x="16" y="44" width="18" height="22" />
              <rect x="52" y="44" width="18" height="22" />
              <rect x="120" y="62" width="18" height="22" />
              <rect x="154" y="62" width="18" height="22" />
              <rect x="226" y="40" width="18" height="22" />
              <rect x="272" y="40" width="18" height="22" className="is-lit" />
            </g>
            <path d="M214 76H310V82H214M220 82V154M252 82V154M284 82V154" className="dcl-escape" />
            <path d="M0 144H320V200H0Z" className="dcl-ground" />
            <path
              d="M12 8L24 38M48 5L62 42M94 10L110 46M154 5L170 40M218 8L234 44M280 4L298 42"
              className="dcl-rain"
            />
          </>
        )}
        <g className="dcl-actor" transform="translate(104 164)">
          <ellipse cx="0" cy="-47" rx="7" ry="8" />
          <path d="M-8 -39H8L10 -8L4 0H-4L-10 -8Z" />
          <path d="M7 -31L20 -22" className="dcl-arm" />
        </g>
        <g className="dcl-actor is-companion" transform="translate(208 157)">
          <ellipse cx="0" cy="-42" rx="7" ry="8" />
          <path d="M-8 -34H8L9 -7L4 0H-4L-9 -7Z" />
        </g>
        {action ? (
          <g className="dcl-action-overlay">
            <rect x="14" y="22" width="292" height="112" />
            <text x="24" y="39">{action.label.toLocaleUpperCase("en-US")}</text>
            <text x="24" y="52">ACTION TICK {localTick}</text>
            {action.windows.map((window, index) => (
              <g key={window.id} transform={`translate(24 ${68 + index * 18})`}>
                <rect width="245" height="13" />
                <rect
                  width={`${Math.max(
                    0,
                    Math.min(
                      245,
                      ((localTick - window.opensAtTick) /
                        Math.max(1, window.closesAtTick - window.opensAtTick)) *
                        245,
                    ),
                  )}`}
                  height="13"
                  className="is-progress"
                />
                <text x="4" y="9">
                  {window.input.toLocaleUpperCase("en-US")} {window.opensAtTick}-{window.closesAtTick}
                </text>
              </g>
            ))}
          </g>
        ) : null}
      </svg>
      <div className="dcl-clock">
        <span>{contract.timing.clockMode === "continuous" ? "CASE CLOCK" : "ROUTE TIME"}</span>
        <strong>{formatDynamixGameClock(state.gameMinute)}</strong>
      </div>
      <div className="dcl-scene-caption">
        <span>{state.locationId.replaceAll(".", " / ")}</span>
        <strong>{state.protagonistId.split(".").at(-1)?.toLocaleUpperCase("en-US")}</strong>
      </div>
    </div>
  );
};
