import { evaluateNightShiftDemoReadiness } from "./night-shift-demo-readiness.js";
import "./night-shift-readiness-panel.css";

export const NightShiftReadinessPanel = () => {
  const report = evaluateNightShiftDemoReadiness();
  const authored = report.gates.filter((gate) => gate.phase === "authored");
  const evidence = report.gates.filter((gate) => gate.phase === "evidence");

  return (
    <section className="stg-night-shift-readiness">
      <span className="stg-eyebrow">PLAYABLE PROOF READINESS</span>
      <h2>
        {report.authoredReady ? "AUTHORED READY" : "AUTHORING BLOCKED"}
        {" · "}
        {report.shippableReady ? "SHIPPABLE" : "EVIDENCE BLOCKED"}
      </h2>
      <p>
        Logic, staging and runtime contracts are scored separately from final compiled pixels and retained playtest
        evidence. A coherent proof is not advertised as a built-in demo until both phases are green.
      </p>
      <div className="stg-readiness-gates">
        <div>
          <strong>Authored</strong>
          {authored.map((gate) => (
            <span key={gate.id} className={`is-${gate.status}`} title={gate.message}>
              {gate.status === "ready" ? "✓" : "×"} {gate.id}
            </span>
          ))}
        </div>
        <div>
          <strong>Release evidence</strong>
          {evidence.map((gate) => (
            <span key={gate.id} className={`is-${gate.status}`} title={gate.message}>
              {gate.status === "ready" ? "✓" : "×"} {gate.id}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
