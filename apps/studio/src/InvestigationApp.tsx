import {
  advanceInvestigationChapter,
  awardInvestigationObjectives,
  createInvestigationState,
  evaluateInvestigationChapter,
  investigationPresenceForChapter,
  redLedgerInvestigationProof,
  useInvestigationResearchSource,
  useInvestigationTopic,
  type InvestigationRuntimeState,
} from "@evavo/adventure-design/investigation";
import { useMemo, useState } from "react";
import "./investigation.css";

const sourceSteps = [
  "source.red-ledger.freight-book",
  "source.red-ledger.lease-index",
  "source.red-ledger.photo-box",
] as const;

export const InvestigationApp = () => {
  const [state, setState] = useState<InvestigationRuntimeState>(() =>
    createInvestigationState(redLedgerInvestigationProof),
  );
  const readiness = useMemo(
    () => evaluateInvestigationChapter(redLedgerInvestigationProof, state),
    [state],
  );
  const presence = useMemo(
    () => investigationPresenceForChapter(redLedgerInvestigationProof, state.chapterId),
    [state.chapterId],
  );

  const useSource = (sourceId: (typeof sourceSteps)[number]) =>
    setState((current) =>
      awardInvestigationObjectives(
        redLedgerInvestigationProof,
        useInvestigationResearchSource(redLedgerInvestigationProof, current, sourceId),
      ),
    );
  const useTopic = (topicId: "topic.red-ledger.shipping-mark" | "topic.red-ledger.r-vale") =>
    setState((current) =>
      awardInvestigationObjectives(
        redLedgerInvestigationProof,
        useInvestigationTopic(redLedgerInvestigationProof, current, topicId, "npc.red-ledger.clerk"),
      ),
    );

  return (
    <main className="ivg-app">
      <header className="ivg-topbar">
        <div><span>EVAVO ADVENTURE STUDIO</span><strong>Investigation / Knowledge Lab</strong></div>
        <div className={readiness.ready ? "is-ready" : "is-blocked"}>
          <strong>{state.chapterId.replace("chapter.red-ledger.", "").toUpperCase()}</strong>
          <span>{readiness.ready ? "DAY READY" : "REQUIRED LEADS OPEN"}</span>
        </div>
      </header>

      <section className="ivg-hero">
        <span>ORIGINAL GOTHIC INVESTIGATION PROOF</span>
        <h1>The Red Ledger</h1>
        <p>Facts carry provenance. Topics stay hidden until discovered. Required and optional work are separate. A day cannot advance until its authored required investigation chain is complete.</p>
        <div><strong>{state.score}</strong><span>investigation score</span></div>
      </section>

      <div className="ivg-grid">
        <section className="ivg-panel">
          <header><span>RESEARCH SOURCES</span><h2>Trace the paper trail</h2></header>
          {redLedgerInvestigationProof.researchSources.map((source) => (
            <button key={source.id} type="button" onClick={() => useSource(source.id as (typeof sourceSteps)[number])} disabled={!source.availableChapterIds.includes(state.chapterId)}>
              <strong>{source.label}</strong>
              <small>{state.usedSourceIds.includes(source.id) ? "used" : "available"}</small>
            </button>
          ))}
        </section>

        <section className="ivg-panel">
          <header><span>DISCOVERED FACTS</span><h2>{state.discoveredFactIds.length} known</h2></header>
          {redLedgerInvestigationProof.facts.map((fact) => {
            const known = state.discoveredFactIds.includes(fact.id);
            const provenance = state.discovery[fact.id] ?? [];
            return <article key={fact.id} className={known ? "is-known" : "is-hidden"}>
              <strong>{known ? fact.label : "Undiscovered fact"}</strong>
              <p>{known ? fact.description : "This fact has not entered the investigation state."}</p>
              {provenance.map((entry) => <small key={`${entry.kind}:${entry.sourceId}`}>{entry.kind} · {entry.sourceId}</small>)}
            </article>;
          })}
        </section>

        <section className="ivg-panel">
          <header><span>TOPICS</span><h2>Knowledge drives conversation</h2></header>
          {redLedgerInvestigationProof.topics.map((topic) => {
            const available = state.availableTopicIds.includes(topic.id);
            const used = state.usedTopicIds.includes(topic.id);
            return <button key={topic.id} type="button" disabled={!available || used} onClick={() => useTopic(topic.id as "topic.red-ledger.shipping-mark" | "topic.red-ledger.r-vale")}>
              <strong>{available ? topic.label : "Hidden subject"}</strong><small>{used ? "asked" : available ? "available" : "undiscovered"}</small>
            </button>;
          })}
        </section>

        <section className="ivg-panel">
          <header><span>DAY OBJECTIVES</span><h2>{readiness.ready ? "Required chain complete" : "Investigation still open"}</h2></header>
          {redLedgerInvestigationProof.chapters.find((chapter) => chapter.id === state.chapterId)?.objectives.map((objective) => {
            const complete = state.awardedObjectiveIds.includes(objective.id);
            return <article key={objective.id} className={complete ? "is-known" : ""}>
              <strong>{objective.label}</strong><p>{objective.required ? "required" : "optional"} · {objective.score ?? 0} points</p>
            </article>;
          })}
          <button type="button" disabled={!readiness.ready} onClick={() => setState((current) => advanceInvestigationChapter(redLedgerInvestigationProof, current))}>Advance chapter/day</button>
        </section>

        <section className="ivg-panel ivg-wide">
          <header><span>CHAPTER PRESENCE / MIGRATION</span><h2>Locations and people change with authored chapter state</h2></header>
          <div className="ivg-presence">
            {presence.map((variant) => <article key={variant.id}><strong>{variant.locationId}</strong><span>{variant.present ? "present" : "absent"}</span><small>{variant.state ?? "default"}</small></article>)}
          </div>
        </section>
      </div>
    </main>
  );
};
