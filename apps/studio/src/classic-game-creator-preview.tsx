import type {
  ClassicAdventureCreatorActor,
  ClassicAdventureCreatorProject,
  ClassicAdventureCreatorProp,
  ClassicAdventureCreatorScene,
} from "@evavo/adventure-design/classic-game-creator";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

export interface CreatorEntitySelection {
  readonly kind: "actor" | "prop";
  readonly id: string;
}

const colourAt = (project: ClassicAdventureCreatorProject, index: number, fallback: string): string =>
  project.palette.anchors[index] ?? fallback;

const SceneBackdrop = ({
  project,
  scene,
}: {
  readonly project: ClassicAdventureCreatorProject;
  readonly scene: ClassicAdventureCreatorScene;
}) => {
  const ink = colourAt(project, 0, "#090b12");
  const deep = colourAt(project, 1, "#1a2430");
  const mid = colourAt(project, 2, "#47596a");
  const accent = colourAt(project, 3, "#aa534b");
  const warm = colourAt(project, 4, "#d1a568");
  const paper = colourAt(project, 5, "#efe5cb");

  switch (scene.motif) {
    case "enchanted-belltower":
      return (
        <>
          <rect width="320" height="200" fill={deep} />
          <path d="M0 0H320V112L0 136Z" fill={mid} />
          <circle cx="246" cy="40" r="18" fill={paper} opacity="0.74" />
          <path d="M0 119L58 54L113 120L164 74L222 124L274 63L320 112V200H0Z" fill={ink} />
          <rect x="226" y="56" width="42" height="92" fill={ink} />
          <path d="M222 56L247 31L272 56Z" fill={ink} />
          <rect x="243" y="82" width="9" height="12" fill={warm} />
          <path d="M0 151Q68 137 135 154T320 146V200H0Z" fill={accent} opacity="0.32" />
          <g fill={ink} opacity="0.9">
            <circle cx="38" cy="130" r="26" />
            <circle cx="72" cy="122" r="31" />
            <circle cx="112" cy="132" r="24" />
          </g>
        </>
      );
    case "rain-bookshop":
      return (
        <>
          <rect width="320" height="200" fill={ink} />
          <rect x="8" y="14" width="304" height="152" fill={deep} />
          <rect x="18" y="22" width="82" height="132" fill={mid} opacity="0.48" />
          <rect x="112" y="20" width="70" height="136" fill={mid} opacity="0.36" />
          <rect x="194" y="18" width="106" height="138" fill={mid} opacity="0.46" />
          {[32, 55, 78, 101, 124, 147].map((y) => (
            <path key={y} d={`M16 ${y}H302`} stroke={warm} strokeOpacity="0.25" />
          ))}
          <rect x="216" y="31" width="58" height="70" fill={paper} opacity="0.16" />
          {[224, 236, 248, 260].map((x) => (
            <path key={x} d={`M${x} 32L${x - 11} 100`} stroke={paper} strokeOpacity="0.35" />
          ))}
          <path d="M0 156H320V200H0Z" fill={deep} />
          <path d="M0 174Q75 158 150 177T320 168V200H0Z" fill={ink} />
          <rect x="154" y="116" width="44" height="24" fill={accent} opacity="0.85" />
          <rect x="159" y="120" width="34" height="2" fill={paper} opacity="0.7" />
        </>
      );
    case "island-harbour":
      return (
        <>
          <rect width="320" height="200" fill={paper} />
          <rect width="320" height="112" fill={mid} />
          <circle cx="55" cy="34" r="18" fill={warm} />
          <path d="M0 95Q42 82 86 98T170 95T252 91T320 99V142H0Z" fill={deep} opacity="0.72" />
          <path d="M0 133Q48 121 96 136T192 130T320 135V200H0Z" fill={accent} opacity="0.42" />
          <rect x="222" y="43" width="29" height="91" fill={paper} />
          <path d="M217 43L236 25L256 43Z" fill={ink} />
          <rect x="230" y="62" width="13" height="13" fill={warm} />
          <g fill={deep}>
            <rect x="20" y="89" width="56" height="56" />
            <rect x="83" y="78" width="54" height="67" />
            <rect x="145" y="94" width="62" height="51" />
          </g>
          <path d="M0 146H320V200H0Z" fill={ink} opacity="0.64" />
          {[154, 168, 182].map((y) => (
            <path key={y} d={`M0 ${y}Q80 ${y - 8} 160 ${y}T320 ${y}`} stroke={paper} strokeOpacity="0.38" />
          ))}
        </>
      );
    default:
      return <rect width="320" height="200" fill={ink} />;
  }
};

const ActorGlyph = ({
  actor,
  selected,
  onSelect,
  onNudge,
}: {
  readonly actor: ClassicAdventureCreatorActor;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onNudge: (x: number, y: number) => void;
}) => {
  const width = Math.max(8, Math.round(actor.height * 0.34));
  const headRadius = Math.max(3, Math.round(width * 0.28));
  const x = actor.position.x - width / 2;
  const y = actor.position.y - actor.height;
  const handleKey = (event: ReactKeyboardEvent<SVGGElement>): void => {
    const step = event.shiftKey ? 8 : 1;
    const delta =
      event.key === "ArrowLeft"
        ? [-step, 0]
        : event.key === "ArrowRight"
          ? [step, 0]
          : event.key === "ArrowUp"
            ? [0, -step]
            : event.key === "ArrowDown"
              ? [0, step]
              : null;
    if (!delta) return;
    event.preventDefault();
    onNudge(delta[0] ?? 0, delta[1] ?? 0);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG interaction nodes cannot use HTML button elements.
    <g
      className={`ccp-entity ccp-actor${selected ? " is-selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`Actor ${actor.name}`}
      onClick={onSelect}
      onKeyDown={handleKey}
    >
      <ellipse
        cx={actor.position.x}
        cy={actor.position.y + 2}
        rx={width * 0.62}
        ry="3"
        className="ccp-entity-shadow"
      />
      <path
        d={`M${x + width * 0.2} ${y + actor.height} L${x + width * 0.32} ${
          y + headRadius * 2
        } L${x + width * 0.68} ${y + headRadius * 2} L${x + width * 0.82} ${y + actor.height}Z`}
      />
      <circle cx={actor.position.x} cy={y + headRadius} r={headRadius} className="ccp-actor-head" />
      <path
        d={
          actor.facing === "right"
            ? `M${actor.position.x + headRadius} ${y + headRadius}l${headRadius * 0.7} 1`
            : `M${actor.position.x - headRadius} ${y + headRadius}l${-headRadius * 0.7} 1`
        }
        className="ccp-actor-facing"
      />
      <rect x={x - 3} y={y - 3} width={width + 6} height={actor.height + 8} className="ccp-selection-box" />
    </g>
  );
};

const PropGlyph = ({
  prop,
  selected,
  onSelect,
  onNudge,
}: {
  readonly prop: ClassicAdventureCreatorProp;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onNudge: (x: number, y: number) => void;
}) => {
  const handleKey = (event: ReactKeyboardEvent<SVGGElement>): void => {
    const step = event.shiftKey ? 8 : 1;
    const delta =
      event.key === "ArrowLeft"
        ? [-step, 0]
        : event.key === "ArrowRight"
          ? [step, 0]
          : event.key === "ArrowUp"
            ? [0, -step]
            : event.key === "ArrowDown"
              ? [0, step]
              : null;
    if (!delta) return;
    event.preventDefault();
    onNudge(delta[0] ?? 0, delta[1] ?? 0);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG interaction nodes cannot use HTML button elements.
    <g
      className={`ccp-entity ccp-prop is-${prop.role}${selected ? " is-selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`Prop ${prop.name}`}
      onClick={onSelect}
      onKeyDown={handleKey}
    >
      <rect
        x={prop.position.x}
        y={prop.position.y}
        width={prop.size.width}
        height={prop.size.height}
        rx="1"
      />
      {prop.role === "clue" ? (
        <circle
          cx={prop.position.x + prop.size.width / 2}
          cy={prop.position.y + prop.size.height / 2}
          r={Math.max(2, Math.min(prop.size.width, prop.size.height) / 4)}
          className="ccp-prop-detail"
        />
      ) : null}
      <rect
        x={prop.position.x - 2}
        y={prop.position.y - 2}
        width={prop.size.width + 4}
        height={prop.size.height + 4}
        className="ccp-selection-box"
      />
    </g>
  );
};

const MiniIcon = ({ children }: { readonly children: ReactNode }) => (
  <g className="ccp-mini-icon">{children}</g>
);

const TemporaryIconBar = ({ project }: { readonly project: ClassicAdventureCreatorProject }) => (
  <g className="ccp-interface-preview ccp-icon-bar">
    <rect x="78" y="6" width="164" height="26" rx="2" />
    {project.interface.verbs.slice(0, 6).map((verb, index) => {
      const x = 84 + index * 26;
      return (
        <MiniIcon key={verb}>
          <rect x={x} y="10" width="20" height="18" rx="1" />
          <text x={x + 10} y="22" textAnchor="middle">
            {verb.slice(0, 1).toUpperCase()}
          </text>
        </MiniIcon>
      );
    })}
  </g>
);

const StorybookPortraitExchange = ({ scene }: { readonly scene: ClassicAdventureCreatorScene }) => (
  <g className="ccp-interface-preview ccp-storybook-dialogue">
    <rect x="20" y="146" width="280" height="42" rx="2" />
    <rect x="28" y="152" width="32" height="30" />
    <rect x="260" y="152" width="32" height="30" />
    <circle cx="44" cy="162" r="7" />
    <path d="M34 179Q44 166 54 179" />
    <circle cx="276" cy="162" r="7" />
    <path d="M266 179Q276 166 286 179" />
    <text x="160" y="162" textAnchor="middle">
      {scene.statusText}
    </text>
    <path d="M76 169H244" />
    <path d="M88 177H232" />
  </g>
);

const TopicLedger = ({ project }: { readonly project: ClassicAdventureCreatorProject }) => (
  <g className="ccp-interface-preview ccp-topic-ledger">
    <rect x="38" y="34" width="244" height="132" rx="2" />
    <rect x="46" y="44" width="58" height="76" />
    <rect x="216" y="44" width="58" height="76" />
    <path d="M54 112Q75 91 96 112" />
    <path d="M224 112Q245 91 266 112" />
    {Array.from({ length: Math.min(7, project.interface.topicRows) }, (_, index) => (
      <g key={index}>
        <rect x="112" y={46 + index * 14} width="96" height="10" />
        <text x="160" y={54 + index * 14} textAnchor="middle">
          TOPIC {index + 1}
        </text>
      </g>
    ))}
    <rect x="46" y="130" width="228" height="26" />
  </g>
);

const PersistentVerbPanel = ({ project }: { readonly project: ClassicAdventureCreatorProject }) => {
  const top = project.interface.gameplayViewportHeight;
  return (
    <g className="ccp-interface-preview ccp-verb-panel">
      <rect x="0" y={top} width="320" height={200 - top} />
      <rect x="6" y={top + 4} width="194" height="12" className="ccp-sentence-line" />
      <text x="10" y={top + 13}>
        USE STAMPED PERMIT WITH OFFICE WINDOW
      </text>
      {project.interface.verbs.slice(0, 9).map((verb, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        return (
          <g key={verb}>
            <rect x={6 + column * 64} y={top + 20 + row * 10} width="60" height="8" />
            <text x={36 + column * 64} y={top + 27 + row * 10} textAnchor="middle">
              {verb.toUpperCase()}
            </text>
          </g>
        );
      })}
      {Array.from({ length: Math.min(8, project.interface.inventorySlots) }, (_, index) => (
        <rect
          key={index}
          x={208 + (index % 4) * 26}
          y={top + 5 + Math.floor(index / 4) * 24}
          width="22"
          height="20"
          className="ccp-inventory-slot"
        />
      ))}
    </g>
  );
};

const InterfaceLayer = ({
  project,
  scene,
}: {
  readonly project: ClassicAdventureCreatorProject;
  readonly scene: ClassicAdventureCreatorScene;
}) => {
  if (scene.kind === "title") return null;
  if (project.interface.family === "temporary-icon-bar") {
    if (scene.kind === "gameplay") return <TemporaryIconBar project={project} />;
    if (scene.kind === "dialogue") {
      return <StorybookPortraitExchange scene={scene} />;
    }
    return null;
  }
  if (project.interface.family === "portrait-topic-ledger" && scene.kind === "dialogue") {
    return <TopicLedger project={project} />;
  }
  if (project.interface.family === "portrait-topic-ledger") {
    return (
      <g className="ccp-interface-preview ccp-narration-strip">
        <rect x="8" y="174" width="304" height="18" />
        <text x="160" y="186" textAnchor="middle">
          {scene.statusText}
        </text>
      </g>
    );
  }
  if (
    project.interface.family === "persistent-verb-panel" &&
    (scene.kind === "gameplay" || scene.kind === "dialogue")
  ) {
    return <PersistentVerbPanel project={project} />;
  }
  return null;
};

export const CreatorNativePreview = ({
  project,
  scene,
  selection,
  onSelect,
  onNudge,
}: {
  readonly project: ClassicAdventureCreatorProject;
  readonly scene: ClassicAdventureCreatorScene;
  readonly selection: CreatorEntitySelection | null;
  readonly onSelect: (selection: CreatorEntitySelection) => void;
  readonly onNudge: (selection: CreatorEntitySelection, deltaX: number, deltaY: number) => void;
}) => (
  <div className={`ccp-native-frame is-${project.family}`}>
    <svg
      viewBox="0 0 320 200"
      role="img"
      aria-label={`${project.title}: ${scene.name}`}
      shapeRendering="crispEdges"
    >
      <SceneBackdrop project={project} scene={scene} />
      <rect
        x={scene.interfaceSafeRect.x}
        y={scene.interfaceSafeRect.y}
        width={scene.interfaceSafeRect.width}
        height={scene.interfaceSafeRect.height}
        className="ccp-safe-rect"
      />
      <rect
        x="0"
        y={scene.walkLane.top}
        width="320"
        height={Math.max(1, scene.walkLane.bottom - scene.walkLane.top)}
        className="ccp-walk-lane"
      />
      <path d={`M0 ${scene.horizonY}H320`} className="ccp-horizon" />
      <g className="ccp-props">
        {scene.props.map((prop) => {
          const entity = { kind: "prop" as const, id: prop.id };
          return (
            <PropGlyph
              key={prop.id}
              prop={prop}
              selected={selection?.kind === "prop" && selection.id === prop.id}
              onSelect={() => onSelect(entity)}
              onNudge={(x, y) => onNudge(entity, x, y)}
            />
          );
        })}
      </g>
      <g className="ccp-actors">
        {scene.actors.map((actor) => {
          const entity = { kind: "actor" as const, id: actor.id };
          return (
            <ActorGlyph
              key={actor.id}
              actor={actor}
              selected={selection?.kind === "actor" && selection.id === actor.id}
              onSelect={() => onSelect(entity)}
              onNudge={(x, y) => onNudge(entity, x, y)}
            />
          );
        })}
      </g>
      <g className="ccp-focal-marker">
        <circle cx={scene.focalPoint.x} cy={scene.focalPoint.y} r="5" />
        <path d={`M${scene.focalPoint.x - 8} ${scene.focalPoint.y}H${scene.focalPoint.x + 8}`} />
        <path d={`M${scene.focalPoint.x} ${scene.focalPoint.y - 8}V${scene.focalPoint.y + 8}`} />
      </g>
      <InterfaceLayer project={project} scene={scene} />
    </svg>
    <footer>
      <span>1× native construction surface</span>
      <strong>{scene.interfaceSafeRect.height}px active viewport</strong>
      <code>{scene.id}</code>
    </footer>
  </div>
);
