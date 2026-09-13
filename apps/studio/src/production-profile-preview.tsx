import type {
  AdventureInterfaceFamily,
  AdventureProductionProfile,
  AdventureSplashFamily,
} from "@evavo/adventure-design/production-profiles";
import type { CSSProperties } from "react";

export const profileStyle = (profile: AdventureProductionProfile): CSSProperties => {
  const colours = profile.palette.keyColours;
  return {
    "--ppf-ink": colours[0] ?? "#090a0f",
    "--ppf-deep": colours[1] ?? "#232731",
    "--ppf-mid": colours[2] ?? "#52606c",
    "--ppf-accent": colours[3] ?? "#b05545",
    "--ppf-warm": colours[4] ?? "#d1a968",
    "--ppf-paper": colours[5] ?? "#efe7cc",
  } as CSSProperties;
};

export const ProfileButton = ({
  profile,
  selected,
  onClick,
}: {
  readonly profile: AdventureProductionProfile;
  readonly selected: boolean;
  readonly onClick: () => void;
}) => (
  <button
    type="button"
    className={`ppf-profile-button${selected ? " is-selected" : ""}`}
    onClick={onClick}
    style={profileStyle(profile)}
  >
    <span className="ppf-profile-swatch" aria-hidden="true">
      {profile.palette.keyColours.slice(0, 4).map((colour) => (
        <i key={colour} style={{ background: colour }} />
      ))}
    </span>
    <span>
      <strong>{profile.label}</strong>
      <small>{profile.family.replaceAll("-", " ")}</small>
    </span>
    <em>
      {profile.nativeSize.width}×{profile.nativeSize.height}
    </em>
  </button>
);

const MarkGraphic = ({ family }: { readonly family: AdventureSplashFamily }) => {
  switch (family) {
    case "lantern-reveal":
      return (
        <g className="ppf-mark ppf-mark-lantern">
          <path d="M141 78H179L185 124H135Z" />
          <rect x="146" y="67" width="28" height="12" />
          <path d="M151 61C155 51 165 51 169 61" fill="none" />
          <circle cx="160" cy="99" r="11" className="ppf-mark-core" />
          <path d="M130 129C141 139 179 139 190 129" fill="none" />
        </g>
      );
    case "celestial-mark":
      return (
        <g className="ppf-mark ppf-mark-window">
          <path d="M160 57C181 57 197 75 197 99V130H123V99C123 75 139 57 160 57Z" />
          <path d="M160 58V130M124 99H196M136 73L184 123M184 73L136 123" fill="none" />
          <circle cx="160" cy="99" r="9" className="ppf-mark-core" />
        </g>
      );
    case "comic-transmission":
      return (
        <g className="ppf-mark ppf-mark-transmission">
          <path d="M135 84L167 68L184 92L153 108Z" />
          <path d="M151 106L187 91L191 119L158 132Z" />
          <path d="M137 84L129 119L158 132" fill="none" />
          <circle cx="167" cy="98" r="7" className="ppf-mark-core" />
          <path d="M185 78C200 72 208 82 210 93M188 87C198 84 203 89 204 97" fill="none" />
        </g>
      );
    case "kinetic-monolith":
      return (
        <g className="ppf-mark ppf-mark-monolith">
          <path d="M135 68L179 57L188 128L144 138Z" />
          <path d="M145 76L168 70L178 119L155 126Z" className="ppf-mark-core" />
          <path d="M128 135H195" fill="none" />
        </g>
      );
    case "pulp-panel":
      return (
        <g className="ppf-mark ppf-mark-pulp">
          <path d="M160 58L192 91L160 134L128 91Z" />
          <circle cx="160" cy="96" r="17" className="ppf-mark-core" />
          <path d="M160 61V132M131 91H189M145 75L178 116M177 76L144 116" fill="none" />
        </g>
      );
    case "noir-signal":
      return (
        <g className="ppf-mark ppf-mark-noir">
          <rect x="126" y="74" width="68" height="47" />
          <path d="M133 105L145 92L156 109L168 84L179 104L188 91" fill="none" />
          <rect x="144" y="128" width="32" height="4" className="ppf-mark-core" />
        </g>
      );
  }
};

export const SplashPreview = ({ profile }: { readonly profile: AdventureProductionProfile }) => (
  <article className="ppf-preview-card ppf-splash-card">
    <header>
      <div>
        <span className="ppf-eyebrow">ORIGINAL PUBLISHER SPLASH</span>
        <h2>{profile.splash.originalMarkName}</h2>
      </div>
      <code>{profile.splash.family}</code>
    </header>
    <div className="ppf-native-frame is-splash" style={profileStyle(profile)}>
      <svg viewBox="0 0 320 200" role="img" aria-label={`${profile.label} original splash preview`}>
        <defs>
          <pattern id={`ppf-grid-${profile.id}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0V8" className="ppf-splash-grid" fill="none" />
          </pattern>
          <radialGradient id={`ppf-glow-${profile.id}`} cx="50%" cy="47%" r="58%">
            <stop offset="0" className="ppf-glow-start" />
            <stop offset="1" className="ppf-glow-end" />
          </radialGradient>
        </defs>
        <rect width="320" height="200" className="ppf-splash-background" />
        <rect width="320" height="200" fill={`url(#ppf-glow-${profile.id})`} />
        <rect width="320" height="200" fill={`url(#ppf-grid-${profile.id})`} />
        <MarkGraphic family={profile.splash.family} />
        <text x="160" y="157" className="ppf-splash-title">
          {profile.splash.originalMarkName.toLocaleUpperCase("en-US")}
        </text>
        <text x="160" y="172" className="ppf-splash-subtitle">
          AN ORIGINAL EVAVO PRODUCTION PROFILE
        </text>
      </svg>
    </div>
    <div className="ppf-timeline" role="img" aria-label="Splash timeline">
      {profile.splash.beats.map((entry) => (
        <div
          key={entry.id}
          style={{ flexGrow: entry.durationTicks }}
          title={`${entry.startTick}–${entry.startTick + entry.durationTicks}: ${entry.composition}`}
        >
          <span>{entry.role.replaceAll("-", " ")}</span>
          <small>{entry.durationTicks}t</small>
        </div>
      ))}
    </div>
    <footer>
      <span>Skip after {profile.splash.skippableAfterTick} ticks</span>
      <span>Total {profile.splash.totalTicks} ticks</span>
    </footer>
  </article>
);

const IconBar = () => (
  <div className="ppf-ui-icon-bar" role="img" aria-label="Top icon bar preview">
    {[
      ["↗", "Walk"],
      ["◉", "Look"],
      ["✦", "Use"],
      ["◌", "Talk"],
      ["◇", "Item"],
      ["▦", "System"],
    ].map(([icon, label]) => (
      <span key={label} title={label}>
        <b>{icon}</b>
      </span>
    ))}
  </div>
);

const VerbPanel = () => (
  <div className="ppf-ui-verb-panel" role="img" aria-label="Verb and inventory panel preview">
    <div className="ppf-sentence-line">USE brass lens WITH signal housing</div>
    <div className="ppf-verbs">
      {["OPEN", "WALK TO", "USE", "CLOSE", "PICK UP", "LOOK AT", "PUSH", "TALK TO", "PULL"].map((verb) => (
        <span key={verb}>{verb}</span>
      ))}
    </div>
    <div className="ppf-inventory-list">
      <span>brass lens</span>
      <span>folded chart</span>
      <span>service key</span>
    </div>
  </div>
);

const TopicPanel = () => (
  <div className="ppf-ui-topic-panel" role="img" aria-label="Investigation topic panel preview">
    <div className="ppf-portrait-silhouette" />
    <div>
      <strong>INTERVIEW TOPICS</strong>
      <span>the red account</span>
      <span>river chapel</span>
      <span>missing witness</span>
    </div>
  </div>
);

const DossierPanel = () => (
  <div className="ppf-ui-dossier" role="img" aria-label="Cinematic dossier preview">
    <header>
      <span>ROUTE 03</span>
      <strong>JADE HORIZON</strong>
    </header>
    <dl>
      <div>
        <dt>TIME</dt>
        <dd>21:40</dd>
      </div>
      <div>
        <dt>TRUST</dt>
        <dd>GUARDED</dd>
      </div>
      <div>
        <dt>FARE</dt>
        <dd>₡ 840</dd>
      </div>
    </dl>
  </div>
);

const MinimalContext = () => (
  <>
    <div className="ppf-minimal-caption">The signal repeats your name in the wrong voice.</div>
    <div className="ppf-context-cursor" aria-hidden="true">
      +
    </div>
  </>
);

const InterfaceChrome = ({ family }: { readonly family: AdventureInterfaceFamily }) => {
  switch (family) {
    case "top-icon-bar":
      return <IconBar />;
    case "bottom-verb-panel":
      return <VerbPanel />;
    case "portrait-topic-panel":
      return <TopicPanel />;
    case "cinematic-dossier":
      return <DossierPanel />;
    case "minimal-context":
      return <MinimalContext />;
  }
};

const StageSet = ({ profile }: { readonly profile: AdventureProductionProfile }) => {
  const family = profile.family;
  return (
    <div className={`ppf-stage-set is-${family}`}>
      <div className="ppf-stage-sky" />
      <div className="ppf-stage-architecture">
        <i className="is-left" />
        <i className="is-centre" />
        <i className="is-right" />
      </div>
      <div className="ppf-stage-light" />
      <div className="ppf-stage-ground" />
      <div className="ppf-stage-prop is-primary" />
      <div className="ppf-stage-prop is-secondary" />
      <div className="ppf-stage-actor is-player">
        <i />
      </div>
      <div className="ppf-stage-actor is-npc">
        <i />
      </div>
      <div className="ppf-stage-rain" />
      <InterfaceChrome family={profile.interface.family} />
    </div>
  );
};

export const InterfacePreview = ({ profile }: { readonly profile: AdventureProductionProfile }) => (
  <article className="ppf-preview-card ppf-interface-card">
    <header>
      <div>
        <span className="ppf-eyebrow">INTERFACE + SCENE GRAMMAR</span>
        <h2>{profile.interface.family.replaceAll("-", " ")}</h2>
      </div>
      <code>{profile.interface.primaryInteractionMode}</code>
    </header>
    <div className="ppf-native-frame is-game" style={profileStyle(profile)}>
      <StageSet profile={profile} />
    </div>
    <div className="ppf-interface-contract">
      <span>{profile.interface.persistentChromePercent}% persistent chrome</span>
      <span>{profile.interface.sentenceLine ? "sentence line" : "context feedback"}</span>
      <span>{profile.interface.dialoguePresentation.replaceAll("-", " ")}</span>
    </div>
  </article>
);
