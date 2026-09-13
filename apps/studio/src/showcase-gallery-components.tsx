import type {
  AdventureInterfaceFamily,
  AdventureProductionProfile,
} from "@evavo/adventure-design/production-profiles";
import type {
  AdventureProductionShowcase,
  AdventureShowcaseActorBeat,
  AdventureShowcasePlate,
  AdventureShowcasePropBeat,
  AdventureShowcaseVisualMotif,
} from "@evavo/adventure-design/production-showcases";
import type { CSSProperties, ReactNode } from "react";
import { profileStyle } from "./production-profile-preview.js";

export const ShowcaseButton = ({
  children,
  active = false,
  onClick,
}: {
  readonly children: ReactNode;
  readonly active?: boolean;
  readonly onClick: () => void;
}) => (
  <button type="button" className={`scg-button${active ? " is-active" : ""}`} onClick={onClick}>
    {children}
  </button>
);

export const ShowcaseFamilyButton = ({
  profile,
  showcase,
  selected,
  onClick,
}: {
  readonly profile: AdventureProductionProfile;
  readonly showcase: AdventureProductionShowcase;
  readonly selected: boolean;
  readonly onClick: () => void;
}) => (
  <button
    type="button"
    className={`scg-family-button${selected ? " is-selected" : ""}`}
    onClick={onClick}
    style={profileStyle(profile)}
  >
    <span className="scg-family-number">{String(showcase.plates.length).padStart(2, "0")}</span>
    <span>
      <strong>{showcase.title}</strong>
      <small>{profile.label}</small>
    </span>
    <span className="scg-family-palette" aria-hidden="true">
      {profile.palette.keyColours.slice(0, 5).map((colour) => (
        <i key={colour} style={{ background: colour }} />
      ))}
    </span>
  </button>
);

const Background = ({ motif }: { readonly motif: AdventureShowcaseVisualMotif }) => {
  switch (motif) {
    case "enchanted-belltower":
      return (
        <g className="scg-scene-art is-enchanted-belltower">
          <rect width="320" height="200" className="scg-sky" />
          <path d="M0 92L46 55L84 83L130 42L176 82L228 50L320 95V200H0Z" className="scg-far" />
          <path
            d="M0 112C48 96 75 106 116 94C155 83 198 103 238 90C270 80 297 86 320 94V200H0Z"
            className="scg-mid"
          />
          <path d="M226 48H268V134H222V66Z" className="scg-architecture" />
          <path d="M219 64L245 38L274 64Z" className="scg-roof" />
          <rect x="238" y="72" width="10" height="14" className="scg-light" />
          <path
            d="M0 135C50 123 91 139 131 127C176 115 214 137 257 122C282 113 304 118 320 124V200H0Z"
            className="scg-ground"
          />
          <path d="M24 111C25 80 39 58 54 46C62 69 65 92 61 119Z" className="scg-foreground" />
          <path d="M54 55L28 79M56 68L77 84M48 76L22 98" className="scg-branch" />
        </g>
      );
    case "orbital-service-bay":
      return (
        <g className="scg-scene-art is-orbital-service-bay">
          <rect width="320" height="200" className="scg-sky" />
          <circle cx="34" cy="28" r="1" className="scg-star" />
          <circle cx="82" cy="44" r="1" className="scg-star" />
          <circle cx="278" cy="30" r="1" className="scg-star" />
          <rect x="0" y="38" width="320" height="128" className="scg-architecture" />
          <path d="M0 54H320M0 78H320M0 142H320" className="scg-panel-line" />
          <rect x="16" y="70" width="76" height="60" className="scg-mid" />
          <rect x="104" y="58" width="90" height="78" className="scg-far" />
          <path d="M214 60H304V144H214Z" className="scg-airlock" />
          <circle cx="258" cy="102" r="31" className="scg-airlock-core" />
          <path d="M10 150H310V200H0V160Z" className="scg-ground" />
          <path d="M0 42H320V50H0ZM0 164H320V172H0Z" className="scg-warning-stripe" />
          <path d="M28 38V18H86V38M154 38V12H206V38" className="scg-pipe" />
        </g>
      );
    case "rain-bookshop":
      return (
        <g className="scg-scene-art is-rain-bookshop">
          <rect width="320" height="200" className="scg-sky" />
          <rect x="0" y="36" width="320" height="130" className="scg-architecture" />
          <rect x="16" y="52" width="76" height="84" className="scg-shelf" />
          <path d="M20 70H88M20 91H88M20 112H88" className="scg-shelf-line" />
          <rect x="110" y="50" width="64" height="88" className="scg-shelf" />
          <path d="M114 69H170M114 90H170M114 111H170" className="scg-shelf-line" />
          <rect x="248" y="46" width="48" height="72" className="scg-window" />
          <path d="M272 46V118M248 80H296" className="scg-window-frame" />
          <path d="M190 112H280L292 153H176Z" className="scg-counter" />
          <path d="M0 148H320V200H0Z" className="scg-ground" />
          <path d="M251 50L258 70M268 48L277 74M282 52L291 80" className="scg-rain-streak" />
          <rect x="202" y="105" width="28" height="5" className="scg-accent" />
        </g>
      );
    case "island-harbour":
      return (
        <g className="scg-scene-art is-island-harbour">
          <rect width="320" height="200" className="scg-sky" />
          <path d="M0 86C70 74 112 80 166 72C226 63 272 72 320 66V128H0Z" className="scg-water" />
          <path d="M0 116C58 106 108 116 160 106C218 94 268 104 320 96V136H0Z" className="scg-water-mid" />
          <rect x="16" y="62" width="86" height="70" className="scg-architecture" />
          <path d="M10 62L56 36L108 62Z" className="scg-roof" />
          <rect x="230" y="38" width="28" height="86" className="scg-lighthouse" />
          <path d="M224 38L244 20L264 38Z" className="scg-roof" />
          <rect x="238" y="50" width="12" height="12" className="scg-light" />
          <path d="M0 128H320V200H0Z" className="scg-ground" />
          <path d="M108 120H264V132H108ZM126 132V186M172 132V186M222 132V186" className="scg-dock" />
          <path d="M286 74L304 80L293 86Z" className="scg-sail" />
        </g>
      );
    case "museum-dig":
      return (
        <g className="scg-scene-art is-museum-dig">
          <rect width="320" height="200" className="scg-sky" />
          <rect x="0" y="34" width="320" height="128" className="scg-architecture" />
          <rect x="18" y="48" width="76" height="72" className="scg-cabinet" />
          <path d="M22 72H90M22 96H90" className="scg-cabinet-line" />
          <rect x="114" y="54" width="92" height="68" className="scg-window" />
          <path d="M160 54V122M114 88H206" className="scg-window-frame" />
          <path d="M224 102H294L306 152H214Z" className="scg-workbench" />
          <path d="M0 146H320V200H0Z" className="scg-ground" />
          <circle cx="257" cy="105" r="24" className="scg-dial" />
          <path d="M257 82V128M234 105H280M242 90L272 120M272 90L242 120" className="scg-dial-line" />
          <rect x="132" y="128" width="40" height="13" className="scg-accent" />
        </g>
      );
    case "night-airfield":
      return (
        <g className="scg-scene-art is-night-airfield">
          <rect width="320" height="200" className="scg-sky" />
          <rect x="14" y="58" width="112" height="72" className="scg-hangar" />
          <path d="M8 58L70 32L134 58Z" className="scg-roof" />
          <path d="M145 102L214 72L294 91L274 116L181 121Z" className="scg-aircraft" />
          <path d="M201 78L222 48L239 80M184 115L164 142M250 112L276 142" className="scg-aircraft-line" />
          <path d="M0 126H320V200H0Z" className="scg-ground" />
          <path d="M0 152H320M0 176H320" className="scg-runway-line" />
          <circle cx="24" cy="166" r="3" className="scg-light" />
          <circle cx="74" cy="166" r="3" className="scg-light" />
          <circle cx="124" cy="166" r="3" className="scg-light" />
          <circle cx="174" cy="166" r="3" className="scg-light" />
          <circle cx="224" cy="166" r="3" className="scg-light" />
          <circle cx="274" cy="166" r="3" className="scg-light" />
        </g>
      );
    case "rain-tenement":
      return (
        <g className="scg-scene-art is-rain-tenement">
          <rect width="320" height="200" className="scg-sky" />
          <rect x="0" y="28" width="108" height="130" className="scg-building" />
          <rect x="116" y="44" width="86" height="114" className="scg-building-mid" />
          <rect x="210" y="20" width="110" height="138" className="scg-building" />
          <g className="scg-windows">
            <rect x="18" y="48" width="20" height="24" />
            <rect x="58" y="48" width="20" height="24" />
            <rect x="136" y="64" width="18" height="22" />
            <rect x="166" y="64" width="18" height="22" />
            <rect x="232" y="44" width="20" height="24" />
            <rect x="274" y="44" width="20" height="24" className="scg-light" />
          </g>
          <path d="M0 144H320V200H0Z" className="scg-ground" />
          <path d="M220 76H310V82H220M220 82V154M252 82V154M284 82V154" className="scg-fire-escape" />
          <path
            d="M14 10L28 40M54 8L66 42M112 12L126 48M176 8L190 40M238 12L252 46M294 8L308 40"
            className="scg-rain-streak"
          />
        </g>
      );
  }
};

const ActorShape = ({ actor }: { readonly actor: AdventureShowcaseActorBeat }) => {
  const width = Math.max(10, Math.round(actor.height * 0.32));
  const head = Math.max(6, Math.round(actor.height * 0.19));
  const bodyHeight = actor.height - head;
  const roleClass = `is-${actor.role}`;
  const scaleX = actor.facing === "left" ? -1 : 1;
  return (
    <g
      className={`scg-actor ${roleClass}`}
      transform={`translate(${actor.position.x} ${actor.position.y}) scale(${scaleX} 1)`}
    >
      <ellipse cx="0" cy={-bodyHeight - head / 2} rx={head / 2} ry={head / 2} />
      <path
        d={`M${-width / 2} ${-bodyHeight} L${width / 2} ${-bodyHeight} L${width * 0.42} -8 L${width * 0.2} 0 L${-width * 0.16} 0 L${-width * 0.44} -8Z`}
      />
      <path
        d={`M${width * 0.28} ${-bodyHeight + 6}L${width * 0.68} ${-bodyHeight / 2}`}
        className="scg-actor-arm"
      />
      <title>
        {actor.pose}: {actor.silhouetteNote}
      </title>
    </g>
  );
};

const PropShape = ({ prop }: { readonly prop: AdventureShowcasePropBeat }) => (
  <g className={`scg-prop is-${prop.role}${prop.interactive ? " is-interactive" : ""}`}>
    <rect x={prop.position.x} y={prop.position.y} width={prop.size.width} height={prop.size.height} rx="1" />
    {prop.interactive ? (
      <path
        d={`M${prop.position.x + 3} ${prop.position.y + 3}H${prop.position.x + prop.size.width - 3}`}
        className="scg-prop-accent"
      />
    ) : null}
    <title>
      {prop.label}: {prop.state}
    </title>
  </g>
);

const IconBarChrome = () => (
  <div className="scg-chrome scg-icon-chrome">
    {["↗", "◉", "✦", "◌", "◇", "▦"].map((icon) => (
      <span key={icon}>{icon}</span>
    ))}
  </div>
);

const TopicChrome = () => (
  <div className="scg-chrome scg-topic-chrome">
    <i />
    <div>
      <strong>TOPICS</strong>
      <span>ACCOUNT DATE</span>
      <span>CHAPEL</span>
      <span>WITNESS</span>
    </div>
  </div>
);

const VerbChrome = () => (
  <div className="scg-chrome scg-verb-chrome">
    <div className="scg-sentence">USE evidence WITH mechanism</div>
    <div className="scg-verbs">
      {["OPEN", "WALK TO", "USE", "PICK UP", "LOOK AT", "TALK TO"].map((verb) => (
        <span key={verb}>{verb}</span>
      ))}
    </div>
    <div className="scg-inventory">
      <span>evidence</span>
      <span>key</span>
      <span>chart</span>
    </div>
  </div>
);

const DossierChrome = () => (
  <div className="scg-chrome scg-dossier-chrome">
    <strong>ROUTE 03</strong>
    <span>21:40</span>
    <span>TRUST GUARDED</span>
  </div>
);

const MinimalChrome = ({ status }: { readonly status: string }) => (
  <div className="scg-chrome scg-minimal-chrome">{status}</div>
);

const InterfaceChrome = ({
  family,
  status,
}: {
  readonly family: AdventureInterfaceFamily;
  readonly status: string;
}) => {
  switch (family) {
    case "top-icon-bar":
      return <IconBarChrome />;
    case "portrait-topic-panel":
      return <TopicChrome />;
    case "bottom-verb-panel":
      return <VerbChrome />;
    case "cinematic-dossier":
      return <DossierChrome />;
    case "minimal-context":
      return <MinimalChrome status={status} />;
  }
};

const PlateOverlay = ({
  showcase,
  plate,
  profile,
}: {
  readonly showcase: AdventureProductionShowcase;
  readonly plate: AdventureShowcasePlate;
  readonly profile: AdventureProductionProfile;
}) => {
  if (plate.kind === "title") {
    return (
      <div className="scg-title-overlay">
        <small>{profile.splash.originalMarkName}</small>
        <strong>{showcase.title}</strong>
        <span>{showcase.genre}</span>
      </div>
    );
  }
  if (plate.kind === "dialogue") {
    return (
      <div className={`scg-dialogue-overlay is-${profile.interface.dialoguePresentation}`}>
        <span>{plate.statusText}</span>
      </div>
    );
  }
  if (plate.kind === "system") {
    return (
      <div className="scg-system-overlay">
        <strong>{showcase.systemTreatment}</strong>
        <span>{plate.statusText}</span>
      </div>
    );
  }
  return <InterfaceChrome family={profile.interface.family} status={plate.statusText} />;
};

export const NativeShowcasePlate = ({
  showcase,
  plate,
  profile,
}: {
  readonly showcase: AdventureProductionShowcase;
  readonly plate: AdventureShowcasePlate;
  readonly profile: AdventureProductionProfile;
}) => {
  const style = profileStyle(profile) as CSSProperties;
  return (
    <div
      className={`scg-native-frame is-${showcase.motif} is-${plate.kind} is-${profile.family}`}
      style={style}
    >
      <svg
        viewBox={`0 0 ${profile.nativeSize.width} ${profile.nativeSize.height}`}
        role="img"
        aria-label={`${showcase.title}: ${plate.name}`}
        shapeRendering="crispEdges"
      >
        <Background motif={showcase.motif} />
        <line
          x1="0"
          y1={plate.horizonY}
          x2={profile.nativeSize.width}
          y2={plate.horizonY}
          className="scg-horizon"
        />
        {plate.props.map((entry) => (
          <PropShape key={entry.id} prop={entry} />
        ))}
        {plate.actors.map((entry) => (
          <ActorShape key={entry.id} actor={entry} />
        ))}
        <g className="scg-focus-marker" transform={`translate(${plate.focalPoint.x} ${plate.focalPoint.y})`}>
          <path d="M-5 0H5M0-5V5" />
        </g>
      </svg>
      <PlateOverlay showcase={showcase} plate={plate} profile={profile} />
    </div>
  );
};

export const PlateButton = ({
  plate,
  active,
  onClick,
}: {
  readonly plate: AdventureShowcasePlate;
  readonly active: boolean;
  readonly onClick: () => void;
}) => (
  <ShowcaseButton active={active} onClick={onClick}>
    <span>{plate.kind}</span>
    <strong>{plate.name}</strong>
  </ShowcaseButton>
);
