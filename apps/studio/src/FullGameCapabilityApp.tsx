import {
  adventureCapabilityCatalog,
  adventureReferenceGameCapabilities,
  currentAdventureCapabilityCoverage,
  evaluateAdventureReferenceGameReadiness,
  type AdventureCapabilityStatus,
} from "@evavo/adventure-design/full-game-capabilities";
import { adventureFullGameUpgradePlan } from "@evavo/adventure-design/full-game-upgrade-plan";
import { adventureSceneArchetypes } from "@evavo/adventure-design/scene-archetypes";
import { type ChangeEvent, useMemo, useState } from "react";
import "./full-game-capability.css";

const statusOrder: readonly AdventureCapabilityStatus[] = ["missing", "partial", "implemented", "proofed"];

const labelForCapability = new Map(
  adventureCapabilityCatalog.map((capability) => [capability.id, capability.label] as const),
);

export const FullGameCapabilityApp = () => {
  const [referenceIndex, setReferenceIndex] = useState(0);
  const reference = adventureReferenceGameCapabilities[referenceIndex] ?? adventureReferenceGameCapabilities[0]!;
  const readiness = useMemo(
    () => evaluateAdventureReferenceGameReadiness(reference.id),
    [reference],
  );
  const required = new Set(reference.required);
  const coverage = currentAdventureCapabilityCoverage
    .filter((entry) => required.has(entry.id))
    .sort((left, right) => {
      const status = statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status);
      if (status !== 0) return status;
      return (labelForCapability.get(left.id) ?? left.id).localeCompare(labelForCapability.get(right.id) ?? right.id);
    });
  const archetypes = adventureSceneArchetypes.filter((entry) => entry.referenceGames.includes(reference.id));
  const epics = adventureFullGameUpgradePlan
    .filter((epic) => epic.unlocksReferenceGames.includes(reference.id))
    .sort((left, right) => left.priority - right.priority);

  return (
    <main className="fgc-app">
      <header className="fgc-topbar">
        <div>
          <span>EVAVO ADVENTURE STUDIO</span>
          <strong>Full Game Capability Lab</strong>
        </div>
        <label>
          <span>Reference pressure</span>
          <select
            value={referenceIndex}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setReferenceIndex(Number(event.currentTarget.value))
            }
          >
            {adventureReferenceGameCapabilities.map((candidate, index) => (
              <option key={candidate.id} value={index}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <div className={`fgc-ready is-${readiness.ready ? "ready" : "blocked"}`}>
          <strong>{readiness.ready ? "FULL-GAME READY" : "GAPS REMAIN"}</strong>
          <span>{readiness.proofedCount}/{readiness.requiredCount} proofed</span>
        </div>
      </header>

      <section className="fgc-hero">
        <span className="fgc-eyebrow">{reference.family.replaceAll("-", " ")}</span>
        <h1>{reference.label}</h1>
        <p>
          A polished room is not enough. This view measures the persistent engine grammar and scene forms needed
          to produce a complete game in this reference family.
        </p>
        <div className="fgc-score-strip">
          <span><strong>{readiness.proofedCount}</strong> proofed</span>
          <span><strong>{readiness.implementedCount}</strong> implemented / unproofed</span>
          <span><strong>{readiness.partialCount}</strong> partial</span>
          <span><strong>{readiness.missingCount}</strong> missing</span>
        </div>
      </section>

      <div className="fgc-grid">
        <section className="fgc-panel fgc-capabilities">
          <header>
            <span className="fgc-eyebrow">REQUIRED ENGINE GRAMMAR</span>
            <h2>{readiness.requiredCount} capabilities</h2>
          </header>
          <div className="fgc-capability-list">
            {coverage.map((entry) => (
              <article key={entry.id} className={`is-${entry.status}`}>
                <span>{entry.status}</span>
                <div>
                  <strong>{labelForCapability.get(entry.id) ?? entry.id}</strong>
                  <p>{entry.evidence}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="fgc-panel">
          <header>
            <span className="fgc-eyebrow">SCENE ARCHETYPES UNDER PRESSURE</span>
            <h2>{archetypes.length} scene forms</h2>
          </header>
          <div className="fgc-archetypes">
            {archetypes.map((entry) => (
              <article key={entry.id}>
                <strong>{entry.label}</strong>
                <p>{entry.description}</p>
                <div>{entry.authoringSurfaces.slice(0, 5).map((surface) => <span key={surface}>{surface}</span>)}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="fgc-panel">
          <header>
            <span className="fgc-eyebrow">REQUIRED STRESS PROOFS</span>
            <h2>Whole-game evidence</h2>
          </header>
          <ol className="fgc-stress-scenes">
            {reference.stressScenes.map((scene) => <li key={scene}>{scene}</li>)}
          </ol>
          <div className="fgc-signature">
            <span className="fgc-eyebrow">SIGNATURE SYSTEMS</span>
            {reference.signature.map((capabilityId) => (
              <span key={capabilityId}>{labelForCapability.get(capabilityId) ?? capabilityId}</span>
            ))}
          </div>
        </section>

        <section className="fgc-panel fgc-roadmap">
          <header>
            <span className="fgc-eyebrow">CROSS-FAMILY UPGRADE PATH</span>
            <h2>{epics.length} relevant epics</h2>
          </header>
          {epics.map((epic) => (
            <article key={epic.id}>
              <span>{String(epic.priority).padStart(2, "0")}</span>
              <div>
                <strong>{epic.label}</strong>
                <p>{epic.outcome}</p>
                <small>{epic.proofScenes[0]}</small>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
};
