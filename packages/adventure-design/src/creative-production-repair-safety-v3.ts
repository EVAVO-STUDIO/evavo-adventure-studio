import {
  validateAdventureCreativeWorkOrderV3,
  type AdventureCreativeHandoffIssueV3,
  type AdventureCreativeWorkOrderV3,
} from "./creative-production-handoff-v3.js";

const issue = (code: string, message: string): AdventureCreativeHandoffIssueV3 => ({ code, message });

export const validateAdventureCreativeRepairSafetyV3 = (
  order: AdventureCreativeWorkOrderV3,
): readonly AdventureCreativeHandoffIssueV3[] => {
  const issues: AdventureCreativeHandoffIssueV3[] = [...validateAdventureCreativeWorkOrderV3(order)];
  const frameIds = new Set((order.framePlan ?? []).map((frame) => frame.frameId));
  const repairIssueIds = new Set<string>();

  for (const repair of order.requestedRepairs) {
    if (repairIssueIds.has(repair.issueId)) {
      issues.push(issue("duplicate-repair-issue", `Repair issue '${repair.issueId}' is duplicated in revision ${order.revision}.`));
    }
    repairIssueIds.add(repair.issueId);

    if (!repair.allowRegenerateWholeAsset && repair.targetFrameIds.length === 0 && !repair.targetRegion) {
      issues.push(issue("repair-target-missing", `Targeted repair '${repair.issueId}' has no frame IDs or target region.`));
    }

    const targets = new Set(repair.targetFrameIds);
    for (const frameId of repair.targetFrameIds) {
      if (frameIds.size > 0 && !frameIds.has(frameId)) {
        issues.push(issue("repair-target-frame-missing", `Repair '${repair.issueId}' targets unknown frame '${frameId}'.`));
      }
    }
    for (const frameId of repair.preserveFrameIds) {
      if (frameIds.size > 0 && !frameIds.has(frameId)) {
        issues.push(issue("repair-preserve-frame-missing", `Repair '${repair.issueId}' preserves unknown frame '${frameId}'.`));
      }
      if (targets.has(frameId)) {
        issues.push(issue("repair-target-preserve-overlap", `Repair '${repair.issueId}' cannot both target and preserve frame '${frameId}'.`));
      }
    }
  }

  return issues.sort((left, right) => left.code.localeCompare(right.code) || left.message.localeCompare(right.message));
};

export const assertAdventureCreativeRepairSafetyV3 = (
  order: AdventureCreativeWorkOrderV3,
): AdventureCreativeWorkOrderV3 => {
  const issues = validateAdventureCreativeRepairSafetyV3(order);
  if (issues.length > 0) throw new Error(issues.map((entry) => entry.message).join(" "));
  return order;
};
