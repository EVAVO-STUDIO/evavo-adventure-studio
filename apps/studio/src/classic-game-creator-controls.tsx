import {
  useEffect,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type {
  ClassicAdventureCreatorProject,
  ClassicAdventureCreatorScene,
  ClassicAdventureCreatorTimingField,
} from "@evavo/adventure-design/classic-game-creator";

export type CreatorSurface = "scene" | "interface" | "puzzles" | "timing";

export const projectStyle = (project: ClassicAdventureCreatorProject): CSSProperties => {
  const colours = project.palette.anchors;
  return {
    "--cc-ink": colours[0] ?? "#090b12",
    "--cc-deep": colours[1] ?? "#1c2530",
    "--cc-mid": colours[2] ?? "#50616f",
    "--cc-accent": colours[3] ?? "#af574d",
    "--cc-warm": colours[4] ?? "#d2aa69",
    "--cc-paper": colours[5] ?? "#efe6cf",
  } as CSSProperties;
};

export const familyLabel = (project: ClassicAdventureCreatorProject): string => {
  switch (project.family) {
    case "storybook-icon":
      return "Storybook icon adventure";
    case "gothic-investigation":
      return "Gothic investigation";
    case "verb-panel-comedy":
      return "Persistent verb comedy";
  }
};

export const surfaceTabs: readonly {
  readonly id: CreatorSurface;
  readonly label: string;
  readonly note: string;
}[] = [
  { id: "scene", label: "Scene", note: "native staging" },
  { id: "interface", label: "Interface", note: "family grammar" },
  { id: "puzzles", label: "Puzzles", note: "causal recovery" },
  { id: "timing", label: "Timing", note: "logical ticks" },
];

export const timingControls: readonly {
  readonly field: ClassicAdventureCreatorTimingField;
  readonly label: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly note: string;
}[] = [
  {
    field: "pointerAcknowledgeTicks",
    label: "Pointer response",
    minimum: 0,
    maximum: 4,
    note: "Immediate visual acknowledgement after input.",
  },
  {
    field: "hoverCommitTicks",
    label: "Hover commit",
    minimum: 0,
    maximum: 8,
    note: "Delay before a target or verb settles.",
  },
  {
    field: "movementStartPoseTicks",
    label: "Walk anticipation",
    minimum: 1,
    maximum: 12,
    note: "Authored pose before route acceleration.",
  },
  {
    field: "turnPoseTicks",
    label: "Turn pose",
    minimum: 1,
    maximum: 10,
    note: "Visible directional weight at route changes.",
  },
  {
    field: "actionAnticipationTicks",
    label: "Action anticipation",
    minimum: 1,
    maximum: 16,
    note: "Readable preparation before object response.",
  },
  {
    field: "actionRecoveryTicks",
    label: "Action recovery",
    minimum: 1,
    maximum: 20,
    note: "Hold after consequence before control returns.",
  },
  {
    field: "wrongActionHoldTicks",
    label: "Wrong-action hold",
    minimum: 18,
    maximum: 120,
    note: "Enough time to read authored feedback.",
  },
  {
    field: "lineMinimumTicks",
    label: "Dialogue minimum",
    minimum: 48,
    maximum: 180,
    note: "Minimum readable line or narration hold.",
  },
  {
    field: "sceneFadeOutTicks",
    label: "Fade out",
    minimum: 4,
    maximum: 30,
    note: "Room departure cadence.",
  },
  {
    field: "sceneDarkHoldTicks",
    label: "Dark hold",
    minimum: 0,
    maximum: 18,
    note: "Breath between locations.",
  },
  {
    field: "sceneFadeInTicks",
    label: "Fade in",
    minimum: 4,
    maximum: 36,
    note: "Arrival and composition reveal.",
  },
];

export const Button = ({
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
    className={`cc-button${active ? " is-active" : ""} ${className}`}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);

export const CommitText = ({
  value,
  onCommit,
}: {
  readonly value: string;
  readonly onCommit: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="text"
      value={draft}
      onChange={(event: ChangeEvent<HTMLInputElement>) =>
        setDraft(event.currentTarget.value)
      }
      onBlur={() => {
        const normalized = draft.trim();
        if (normalized && normalized !== value) onCommit(normalized);
        else setDraft(value);
      }}
      onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
};

export const downloadProject = (project: ClassicAdventureCreatorProject): void => {
  const blob = new Blob([`${JSON.stringify(project, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.id}.classic-adventure.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const firstScene = (
  project: ClassicAdventureCreatorProject,
): ClassicAdventureCreatorScene => {
  const scene = project.scenes[0];
  if (!scene) throw new Error(`Creator project '${project.id}' has no scenes.`);
  return scene;
};

export const sceneById = (
  project: ClassicAdventureCreatorProject,
  id: string,
): ClassicAdventureCreatorScene =>
  project.scenes.find((scene) => scene.id === id) ?? firstScene(project);

export const sceneKindLabel = (scene: ClassicAdventureCreatorScene): string =>
  scene.kind === "gameplay"
    ? "ROOM"
    : scene.kind === "dialogue"
      ? "DIALOGUE"
      : scene.kind === "system"
        ? "SYSTEM"
        : "TITLE";

export const ProjectRailButton = ({
  project,
  selected,
  onClick,
}: {
  readonly project: ClassicAdventureCreatorProject;
  readonly selected: boolean;
  readonly onClick: () => void;
}) => (
  <button
    type="button"
    className={`cc-project-button${selected ? " is-selected" : ""}`}
    style={projectStyle(project)}
    onClick={onClick}
  >
    <span>{familyLabel(project)}</span>
    <strong>{project.title.replace(" Creator Project", "")}</strong>
    <small>
      {project.interface.family.replaceAll("-", " ")} · {project.palette.maxColours} colours
    </small>
  </button>
);

export const RangeField = ({
  label,
  value,
  minimum,
  maximum,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly onChange: (value: number) => void;
}) => (
  <label className="cc-range-field">
    <span>{label}</span>
    <input
      type="range"
      min={minimum}
      max={maximum}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) =>
        onChange(Number(event.currentTarget.value))
      }
    />
    <output>{value}</output>
  </label>
);
