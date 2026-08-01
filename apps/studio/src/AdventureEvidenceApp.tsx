import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  parseArtDirectionManifest,
  type ArtDirectionManifest,
} from "@evavo/adventure-art-direction";
import {
  parseArtVisualEvidenceManifest,
  type ArtVisualEvidenceManifest,
} from "@evavo/adventure-art-direction/evidence";
import {
  parseAssetBuildManifest,
  type AssetBuildManifest,
} from "@evavo/adventure-asset-contract";
import {
  parseBitmapFontManifest,
  type BitmapFontManifest,
} from "@evavo/adventure-bitmap-font";
import {
  createAdventureAuthenticityEvidenceRequirements,
  evaluateAdventureCompiledEvidence,
  type AdventureCompiledEvidenceFinding,
} from "@evavo/adventure-design/compiled-evidence";
import { showcaseAdventureDesigns } from "@evavo/adventure-design/showcases";
import {
  parseAdventureProject,
  type AdventureProject,
} from "@evavo/adventure-project-schema";
import {
  parseUiSkinManifest,
  type UiSkinManifest,
} from "@evavo/adventure-ui-skin";
import "./adventure-evidence.css";

type ArtifactKind =
  | "project"
  | "art-direction"
  | "asset-build"
  | "pixel-evidence"
  | "bitmap-fonts"
  | "ui-skins";

interface ArtifactMeta {
  readonly name: string | null;
  readonly error: string | null;
}

interface EvidenceValues {
  readonly project: AdventureProject | null;
  readonly artDirection: ArtDirectionManifest | null;
  readonly assetBuild: AssetBuildManifest | null;
  readonly pixelEvidence: ArtVisualEvidenceManifest | null;
  readonly bitmapFonts: BitmapFontManifest | null;
  readonly uiSkins: UiSkinManifest | null;
}

const kindByRequirementId: Readonly<Record<string, ArtifactKind>> = {
  "canonical-project": "project",
  "art-direction": "art-direction",
  "asset-build": "asset-build",
  "pixel-evidence": "pixel-evidence",
  "bitmap-fonts": "bitmap-fonts",
  "ui-skins": "ui-skins",
};

const artifactKinds: readonly ArtifactKind[] = [
  "project",
  "art-direction",
  "asset-build",
  "pixel-evidence",
  "bitmap-fonts",
  "ui-skins",
];

const initialMeta = (): Record<ArtifactKind, ArtifactMeta> => ({
  project: { name: null, error: null },
  "art-direction": { name: null, error: null },
  "asset-build": { name: null, error: null },
  "pixel-evidence": { name: null, error: null },
  "bitmap-fonts": { name: null, error: null },
  "ui-skins": { name: null, error: null },
});

const initialValues = (): EvidenceValues => ({
  project: null,
  artDirection: null,
  assetBuild: null,
  pixelEvidence: null,
  bitmapFonts: null,
  uiSkins: null,
});

const parseJson = (text: string, label: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new SyntaxError(
      `${label} is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const parseArtifact = (kind: ArtifactKind, text: string): unknown => {
  const input = parseJson(text, kind);
  switch (kind) {
    case "project":
      return parseAdventureProject(input);
    case "art-direction":
      return parseArtDirectionManifest(input);
    case "asset-build":
      return parseAssetBuildManifest(input);
    case "pixel-evidence":
      return parseArtVisualEvidenceManifest(input);
    case "bitmap-fonts":
      return parseBitmapFontManifest(input);
    case "ui-skins":
      return parseUiSkinManifest(input);
  }
};

const withArtifactValue = (
  values: EvidenceValues,
  kind: ArtifactKind,
  value: unknown | null,
): EvidenceValues => {
  switch (kind) {
    case "project":
      return { ...values, project: value as AdventureProject | null };
    case "art-direction":
      return { ...values, artDirection: value as ArtDirectionManifest | null };
    case "asset-build":
      return { ...values, assetBuild: value as AssetBuildManifest | null };
    case "pixel-evidence":
      return {
        ...values,
        pixelEvidence: value as ArtVisualEvidenceManifest | null,
      };
    case "bitmap-fonts":
      return { ...values, bitmapFonts: value as BitmapFontManifest | null };
    case "ui-skins":
      return { ...values, uiSkins: value as UiSkinManifest | null };
  }
};

const artifactValue = (
  values: EvidenceValues,
  kind: ArtifactKind,
): unknown | null => {
  switch (kind) {
    case "project":
      return values.project;
    case "art-direction":
      return values.artDirection;
    case "asset-build":
      return values.assetBuild;
    case "pixel-evidence":
      return values.pixelEvidence;
    case "bitmap-fonts":
      return values.bitmapFonts;
    case "ui-skins":
      return values.uiSkins;
  }
};

const Button = ({
  children,
  onClick,
  disabled = false,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) => (
  <button type="button" className="evd-button" onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

const ArtifactPicker = ({
  kind,
  label,
  artifact,
  name,
  error,
  onLoad,
  onClear,
}: {
  readonly kind: ArtifactKind;
  readonly label: string;
  readonly artifact: string;
  readonly name: string | null;
  readonly error: string | null;
  readonly onLoad: (kind: ArtifactKind, file: File) => Promise<void>;
  readonly onClear: (kind: ArtifactKind) => void;
}) => {
  const inputId = `evidence-file-${kind}`;
  return (
    <article className={`evd-file-card${error ? " has-error" : ""}`}>
      <label htmlFor={inputId}>
        <span>{label}</span>
        <strong>{name ?? artifact}</strong>
        <small>{error ?? (name ? "Parsed locally" : "Choose JSON file")}</small>
      </label>
      <input
        id={inputId}
        type="file"
        accept="application/json,.json"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const file = event.currentTarget.files?.[0];
          if (file) void onLoad(kind, file);
          event.currentTarget.value = "";
        }}
      />
      {name || error ? (
        <button type="button" onClick={() => onClear(kind)} aria-label={`Clear ${label}`}>
          Clear
        </button>
      ) : null}
    </article>
  );
};

const Finding = ({ finding }: { readonly finding: AdventureCompiledEvidenceFinding }) => (
  <article className={`evd-finding is-${finding.severity}`}>
    <div>
      <span>{finding.severity}</span>
      <strong>{finding.area}</strong>
    </div>
    <section>
      <h3>{finding.message}</h3>
      <code>{finding.path}</code>
      <p>{finding.recommendation}</p>
    </section>
  </article>
);

export const AdventureEvidenceApp = () => {
  const [designIndex, setDesignIndex] = useState(0);
  const [values, setValues] = useState<EvidenceValues>(initialValues);
  const [meta, setMeta] = useState<Record<ArtifactKind, ArtifactMeta>>(initialMeta);
  const generations = useRef<Record<ArtifactKind, number>>({
    project: 0,
    "art-direction": 0,
    "asset-build": 0,
    "pixel-evidence": 0,
    "bitmap-fonts": 0,
    "ui-skins": 0,
  });
  const design = showcaseAdventureDesigns[designIndex] ?? showcaseAdventureDesigns[0]!;
  const requirements = useMemo(
    () => createAdventureAuthenticityEvidenceRequirements(design),
    [design],
  );
  const report = useMemo(() => {
    if (
      !values.project ||
      !values.artDirection ||
      !values.assetBuild ||
      !values.pixelEvidence
    ) {
      return null;
    }
    return evaluateAdventureCompiledEvidence(design, {
      project: values.project,
      artDirection: values.artDirection,
      compiledAssets: values.assetBuild,
      visualEvidence: values.pixelEvidence,
      ...(values.bitmapFonts ? { bitmapFonts: values.bitmapFonts } : {}),
      ...(values.uiSkins ? { uiSkins: values.uiSkins } : {}),
    });
  }, [design, values]);

  const loadFile = async (kind: ArtifactKind, file: File): Promise<void> => {
    const generation = generations.current[kind] + 1;
    generations.current[kind] = generation;
    try {
      const parsed = parseArtifact(kind, await file.text());
      if (generations.current[kind] !== generation) return;
      setValues((current) => withArtifactValue(current, kind, parsed));
      setMeta((current) => ({
        ...current,
        [kind]: { name: file.name, error: null },
      }));
    } catch (error) {
      if (generations.current[kind] !== generation) return;
      setValues((current) => withArtifactValue(current, kind, null));
      setMeta((current) => ({
        ...current,
        [kind]: {
          name: file.name,
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  };

  const clearFile = (kind: ArtifactKind): void => {
    generations.current[kind] += 1;
    setValues((current) => withArtifactValue(current, kind, null));
    setMeta((current) => ({ ...current, [kind]: { name: null, error: null } }));
  };

  const loadedCount = artifactKinds.filter(
    (kind) => artifactValue(values, kind) !== null,
  ).length;
  const clearAll = (): void => {
    for (const kind of artifactKinds) generations.current[kind] += 1;
    setValues(initialValues());
    setMeta(initialMeta());
  };
  const status = report?.status ?? "waiting";

  return (
    <main className="evd-app">
      <header className="evd-topbar">
        <div className="evd-brand">
          <span className="evd-mark">P</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Compiled Proof Lab</strong>
          </div>
        </div>
        <label className="evd-design-picker">
          <span>Design target</span>
          <select
            value={designIndex}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setDesignIndex(Number(event.currentTarget.value))
            }
          >
            {showcaseAdventureDesigns.map((candidate, index) => (
              <option key={candidate.projectId} value={index}>
                {candidate.title}
              </option>
            ))}
          </select>
        </label>
        <div className={`evd-status is-${status}`}>
          <span />
          <strong>{report ? report.status : `${loadedCount}/6 loaded`}</strong>
        </div>
      </header>

      <div className="evd-workspace">
        <aside className="evd-rail">
          <span className="evd-eyebrow">PROOF CONTRACT</span>
          <h1>{design.title}</h1>
          <p>
            Authored intent becomes verified only when the exact compiled assets, encoded
            pixels, bitmap fonts and native interface agree with the canonical project.
          </p>
          <ol>
            {requirements.map((requirement, index) => (
              <li key={requirement.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{requirement.label}</strong>
                  <code>{requirement.artifact}</code>
                  <p>{requirement.rationale}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>

        <section className="evd-canvas">
          <header className="evd-intro">
            <div>
              <span className="evd-eyebrow">EVIDENCE-BACKED VGA REVIEW</span>
              <h2>Prove the pixels, not only the prose</h2>
              <p>
                Files are parsed locally. The audit reuses the canonical art, asset, font
                and UI validators before applying scene, actor and native-output gates.
              </p>
            </div>
            <Button disabled={loadedCount === 0} onClick={clearAll}>
              Clear all
            </Button>
          </header>

          <section className="evd-file-grid" aria-label="Compiled evidence artifacts">
            {requirements.map((requirement) => {
              const kind = kindByRequirementId[requirement.id]!;
              return (
                <ArtifactPicker
                  key={requirement.id}
                  kind={kind}
                  label={requirement.label}
                  artifact={requirement.artifact}
                  name={meta[kind].name}
                  error={meta[kind].error}
                  onLoad={loadFile}
                  onClear={clearFile}
                />
              );
            })}
          </section>

          {report ? (
            <>
              <section className={`evd-report-hero is-${report.status}`}>
                <div className="evd-report-score">
                  <strong>{report.coveragePercent}</strong>
                  <span>% pixel coverage</span>
                </div>
                <div>
                  <span className="evd-eyebrow">COMPILED AUTHENTICITY</span>
                  <h2>{report.verified ? "Verified evidence set" : report.status}</h2>
                  <p>
                    {report.verified
                      ? "All required visual assets have compatible compiled and encoded evidence."
                      : "Correct the evidence findings before treating the VGA presentation as proven."}
                  </p>
                </div>
              </section>

              <section className="evd-metrics">
                {Object.entries(report.metrics).map(([label, value]) => (
                  <article key={label}>
                    <span>{label.replace(/([A-Z])/g, " $1")}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </section>

              <section className="evd-findings">
                <header>
                  <span className="evd-eyebrow">CORRECTIVE QUEUE</span>
                  <h2>
                    {report.findings.length === 0
                      ? "No compiled findings"
                      : `${report.findings.length} findings`}
                  </h2>
                </header>
                {report.findings.length > 0 ? (
                  <div>
                    {report.findings.map((finding) => (
                      <Finding
                        key={`${finding.id}:${finding.path}:${finding.message}`}
                        finding={finding}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="evd-empty">
                    <strong>Evidence contract satisfied.</strong>
                    <p>
                      Continue with human review at 1× native size and deterministic playtest
                      replays; this gate proves artifacts, not artistic excellence by itself.
                    </p>
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="evd-waiting">
              <span className="evd-eyebrow">AUDIT NOT STARTED</span>
              <h2>Load the four core artifacts</h2>
              <p>
                Project, art-direction, compiled-asset and encoded-pixel evidence are needed
                to run. Bitmap fonts and UI skins remain visible requirements and produce
                attention findings until supplied.
              </p>
            </section>
          )}
        </section>
      </div>
    </main>
  );
};
