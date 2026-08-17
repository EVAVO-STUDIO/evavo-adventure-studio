import {
  adventureReferenceEngineDialectById,
  adventureReferenceTitlePacks,
  validateAdventureReferenceTitlePack,
  type AdventureReferenceCapabilityCategory,
  type AdventureReferenceTitleId,
  type AdventureReferenceTitlePack,
} from "@evavo/adventure-design/reference-fidelity";
import { type ChangeEvent, type CSSProperties, useMemo, useState } from "react";
import "./compatibility-lab.css";

const categoryOrder: readonly AdventureReferenceCapabilityCategory[] = [
  "presentation",
  "input",
  "world",
  "narrative",
  "system",
  "audio",
  "rpg",
  "investigation",
  "procedure",
  "routing",
];

const titleThemes: Readonly<Record<AdventureReferenceTitleId, readonly string[]>> = {
  "kings-quest-v": ["#11141a", "#263950", "#66845f", "#be965d", "#ead9a8"],
  "quest-for-glory-iv": ["#090a12", "#25243b", "#51405b", "#8d655d", "#d1bd9b"],
  "gabriel-knight-sins-of-the-fathers": ["#0c0d12", "#282736", "#65443f", "#a66f4c", "#e1cba4"],
  "police-quest-iv": ["#0b1015", "#253342", "#546877", "#9a7150", "#dbd0b6"],
  "indiana-jones-fate-of-atlantis": ["#0d1115", "#283946", "#6e6048", "#aa6745", "#dbc9a0"],
};

const compatibilityStyle = (pack: AdventureReferenceTitlePack): CSSProperties => {
  const colours = titleThemes[pack.titleId];
  return {
    "--cfl-ink": colours[0],
    "--cfl-deep": colours[1],
    "--cfl-mid": colours[2],
    "--cfl-accent": colours[3],
    "--cfl-paper": colours[4],
  } as CSSProperties;
};

const titleCode = (titleId: AdventureReferenceTitleId): string => {
  switch (titleId) {
    case "kings-quest-v":
      return "KQ5";
    case "quest-for-glory-iv":
      return "QFG4";
    case "gabriel-knight-sins-of-the-fathers":
      return "GK1";
    case "police-quest-iv":
      return "PQ4";
    case "indiana-jones-fate-of-atlantis":
      return "FOA";
  }
};

const CapabilityGroup = ({
  category,
  pack,
}: {
  readonly category: AdventureReferenceCapabilityCategory;
  readonly pack: AdventureReferenceTitlePack;
}) => {
  const capabilities = pack.capabilities.filter((entry) => entry.category === category);
  if (capabilities.length === 0) return null;
  return (
    <section className="cfl-capability-group">
      <header>
        <span>{category.replaceAll("-", " ")}</span>
        <strong>{capabilities.length}</strong>
      </header>
      <div>
        {capabilities.map((capability) => (
          <article key={capability.id} className={capability.critical ? "is-critical" : ""}>
            <div>
              <h3>{capability.label}</h3>
              {capability.critical ? <em>critical</em> : <em>supporting</em>}
            </div>
            <p>{capability.description}</p>
            <footer>
              <code>{capability.id}</code>
              <span>
                {capability.evidence.minimumItems} evidence · {capability.evidence.acceptedKinds.join(" / ")}
              </span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
};

export const CompatibilityLabApp = () => {
  const [packIndex, setPackIndex] = useState(0);
  const [variantIndex, setVariantIndex] = useState(0);
  const pack = adventureReferenceTitlePacks[packIndex] ?? adventureReferenceTitlePacks[0]!;
  const variant = pack.variants[variantIndex] ?? pack.variants[0]!;
  const dialect = adventureReferenceEngineDialectById(pack.engineDialectId);
  const issues = useMemo(() => validateAdventureReferenceTitlePack(pack), [pack]);
  const criticalCount = pack.capabilities.filter((entry) => entry.critical).length;
  const evidenceMinimum = pack.capabilities.reduce(
    (total, entry) => total + entry.evidence.minimumItems,
    0,
  );

  const selectPack = (index: number): void => {
    setPackIndex(index);
    setVariantIndex(0);
  };

  return (
    <main className="cfl-app" style={compatibilityStyle(pack)}>
      <header className="cfl-topbar">
        <div className="cfl-brand">
          <span className="cfl-mark">F</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Reference Fidelity Lab</strong>
          </div>
        </div>
        <div className="cfl-selected-title">
          <span>{titleCode(pack.titleId)} TECHNICAL GRAMMAR</span>
          <strong>{pack.referenceTitle}</strong>
        </div>
        <div className={`cfl-contract-state ${issues.length === 0 ? "is-ready" : "is-blocked"}`}>
          <span />
          <strong>{issues.length === 0 ? "contract ready" : "contract blocked"}</strong>
          <em>evidence not attached</em>
        </div>
      </header>

      <div className="cfl-workspace">
        <aside className="cfl-title-rail">
          <header>
            <span className="cfl-eyebrow">TITLE-SPECIFIC REFERENCE PACKS</span>
            <h1>Measure the engine. Prove it with original games.</h1>
            <p>
              Commercial titles define behavioural reference targets. Distributed proofs keep original
              characters, rooms, dialogue, music, interface artwork and puzzle content.
            </p>
          </header>
          <div className="cfl-title-list">
            {adventureReferenceTitlePacks.map((candidate, index) => (
              <button
                type="button"
                key={candidate.id}
                className={index === packIndex ? "is-selected" : ""}
                style={compatibilityStyle(candidate)}
                onClick={() => selectPack(index)}
              >
                <span>{titleCode(candidate.titleId)}</span>
                <strong>{candidate.referenceTitle}</strong>
                <small>
                  {candidate.engineDialectId} · {candidate.capabilities.length} capabilities
                </small>
              </button>
            ))}
          </div>
          <footer>
            <span>{adventureReferenceTitlePacks.length} title packs</span>
            <span>contract v{pack.packVersion}</span>
          </footer>
        </aside>

        <section className="cfl-canvas">
          <header className="cfl-heading">
            <div>
              <span className="cfl-eyebrow">SELECTED COMPATIBILITY TARGET</span>
              <h1>{pack.label}</h1>
              <p>{pack.summary}</p>
            </div>
            <label>
              <span>Reference variant</span>
              <select
                value={variantIndex}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setVariantIndex(Number(event.currentTarget.value))
                }
              >
                {pack.variants.map((candidate, index) => (
                  <option key={candidate.id} value={index}>
                    {candidate.label}
                  </option>
                ))}
              </select>
              <code>{variant.id}</code>
            </label>
          </header>

          <section className="cfl-identity-grid">
            <article>
              <span>Engine dialect</span>
              <strong>{dialect.label}</strong>
              <p>{dialect.summary}</p>
              <code>{dialect.id}</code>
            </article>
            <article>
              <span>Visual baseline</span>
              <strong>{pack.profileId}</strong>
              <p>
                The profile governs palette, composition and interface art. The title pack separately
                governs runtime and subsystem fidelity.
              </p>
              <code>320 × 200 · indexed 8-bit · 60 ticks</code>
            </article>
            <article>
              <span>Evidence burden</span>
              <strong>{criticalCount} critical capabilities</strong>
              <p>{evidenceMinimum} minimum retained evidence items before a pack can report ready.</p>
              <code>{pack.scenarios.length} executable scenarios</code>
            </article>
          </section>

          <section className="cfl-variant-notes">
            <header>
              <span className="cfl-eyebrow">RELEASE VARIANT BOUNDARY</span>
              <strong>
                {variant.media.toUpperCase()} / {variant.platform.toUpperCase()} /{" "}
                {variant.language.toUpperCase()}
              </strong>
            </header>
            {variant.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </section>

          <section className="cfl-capability-matrix">
            <header>
              <div>
                <span className="cfl-eyebrow">MACHINE-TESTABLE CAPABILITY MATRIX</span>
                <h2>{pack.capabilities.length} explicit requirements</h2>
              </div>
              <p>
                No percentage appears until implementation and retained evidence are both admitted for
                this exact release variant.
              </p>
            </header>
            {categoryOrder.map((category) => (
              <CapabilityGroup key={category} category={category} pack={pack} />
            ))}
          </section>

          <section className="cfl-scenarios">
            <header>
              <span className="cfl-eyebrow">EXECUTABLE FIDELITY SCENARIOS</span>
              <h2>State, action and evidence—not screenshot resemblance alone.</h2>
            </header>
            <div>
              {pack.scenarios.map((scenario, index) => (
                <article key={scenario.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{scenario.label}</h3>
                    <p>{scenario.description}</p>
                    <ol>
                      {scenario.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <footer>{scenario.expectedOutcome}</footer>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside className="cfl-inspector">
          <section className="cfl-proof">
            <span className="cfl-eyebrow">ORIGINAL PLAYABLE PROOF</span>
            <h2>{pack.originalProof.title}</h2>
            <strong className={`is-${pack.originalProof.status}`}>{pack.originalProof.status}</strong>
            <p>{pack.originalProof.note}</p>
            <code>{pack.originalProof.showcaseId}</code>
            <div>
              {pack.originalProof.featuredSystems.map((system) => (
                <span key={system}>{system}</span>
              ))}
            </div>
          </section>

          <section>
            <span className="cfl-eyebrow">PERMITTED REFERENCE USE</span>
            <ul>
              {pack.redistributionBoundary.permitted.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="cfl-prohibited">
            <span className="cfl-eyebrow">NEVER BUNDLE</span>
            <ul>
              {pack.redistributionBoundary.prohibited.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <span className="cfl-eyebrow">DIALECT NOTES</span>
            <ul>
              {dialect.notes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <footer>
            <span>
              {issues.length === 0
                ? "Schema and binding checks pass."
                : `${issues.length} contract issue(s).`}
            </span>
            <code>{pack.id}</code>
          </footer>
        </aside>
      </div>
    </main>
  );
};
