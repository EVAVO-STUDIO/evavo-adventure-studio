import { evaluateNightShiftDemoReadiness } from "./night-shift-demo-readiness.js";
import {
  nightShiftIndexedProductionAssetIds,
  nightShiftPeriodVgaProductionAssetIds,
  nightShiftProductionAssets,
} from "./night-shift-production-assets.js";
import {
  nightShiftProductionManifestFileName,
  nightShiftProductionManifestJson,
} from "./night-shift-production-manifest.js";
import { evaluateNightShiftProductionProgress } from "./night-shift-production-progress.js";
import { downloadNightShiftRuntimeSource } from "./night-shift-runtime-source-export.js";
import "./night-shift-readiness-panel.css";

const roleCounts = (): readonly { readonly role: string; readonly count: number }[] => {
  const counts = new Map<string, number>();
  for (const asset of nightShiftProductionAssets) {
    counts.set(asset.role, (counts.get(asset.role) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((left, right) => left.role.localeCompare(right.role));
};

const downloadProductionManifest = (): void => {
  const blob = new Blob([nightShiftProductionManifestJson()], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nightShiftProductionManifestFileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const NightShiftReadinessPanel = () => {
  const report = evaluateNightShiftDemoReadiness();
  const authored = report.gates.filter((gate) => gate.phase === "authored");
  const evidence = report.gates.filter((gate) => gate.phase === "evidence");
  const roles = roleCounts();
  const productionProgress = evaluateNightShiftProductionProgress(new Set());
  const nextWave = productionProgress.nextWave;
  const nextWaveProgress = nextWave
    ? productionProgress.waves.find((wave) => wave.id === nextWave.id) ?? null
    : null;

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
      <div className="stg-production-plan-summary">
        <header>
          <strong>Production master set</strong>
          <span>{nightShiftProductionAssets.length} runtime assets</span>
        </header>
        <div className="stg-production-plan-metrics">
          <span><strong>{nightShiftIndexedProductionAssetIds.length}</strong> indexed masters</span>
          <span><strong>{nightShiftPeriodVgaProductionAssetIds.length}</strong> Period VGA reviews</span>
          <span><strong>3</strong> native room backgrounds</span>
          <span><strong>8</strong> officer walk frames</span>
        </div>
        <div className="stg-production-plan-roles">
          {roles.map(({ role, count }) => (
            <span key={role}><strong>{count}</strong> {role}</span>
          ))}
        </div>
        {nextWave && nextWaveProgress ? (
          <div className="stg-production-next-wave">
            <span className="stg-eyebrow">NEXT PRODUCTION WAVE</span>
            <h3>{nextWave.label}</h3>
            <p>{nextWave.goal}</p>
            <strong>
              {nextWaveProgress.completedAssets}/{nextWaveProgress.totalAssets} masters accepted
            </strong>
            <ul>
              {nextWaveProgress.missingAssetIds.slice(0, 8).map((assetId) => (
                <li key={assetId}>{assetId}</li>
              ))}
            </ul>
            {nextWaveProgress.missingAssetIds.length > 8 ? (
              <small>+ {nextWaveProgress.missingAssetIds.length - 8} more in the production manifest</small>
            ) : null}
          </div>
        ) : null}
        <div className="stg-production-plan-actions">
          <button type="button" className="stg-production-plan-export" onClick={downloadProductionManifest}>
            Export production manifest
          </button>
          <button type="button" className="stg-production-plan-export" onClick={downloadNightShiftRuntimeSource}>
            Export runtime source ZIP
          </button>
        </div>
      </div>
    </section>
  );
};
