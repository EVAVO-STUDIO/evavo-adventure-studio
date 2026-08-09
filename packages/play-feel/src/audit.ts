import type {
  AdventureMotionTrace,
  AdventurePlayFeelAuditInput,
  AdventurePlayFeelAuditReport,
  AdventurePlayFeelIssue,
  AdventurePlayFeelProfile,
} from "./types.js";
import { validateAdventurePlayFeelProfile } from "./validate.js";

const severityOrder = { error: 0, warning: 1, note: 2 } as const;

const sorted = (issues: readonly AdventurePlayFeelIssue[]): readonly AdventurePlayFeelIssue[] =>
  [...issues].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code),
  );

const issue = (
  severity: AdventurePlayFeelIssue["severity"],
  code: string,
  path: string,
  message: string,
): AdventurePlayFeelIssue => ({ severity, code, path, message });

export const auditAdventurePlayFeelProfile = (
  profile: AdventurePlayFeelProfile,
  input: AdventurePlayFeelAuditInput = {},
): AdventurePlayFeelAuditReport => {
  const issues: AdventurePlayFeelIssue[] = [...validateAdventurePlayFeelProfile(profile)];
  if (
    input.logicalTicksPerSecond !== undefined &&
    input.logicalTicksPerSecond !== profile.logicalTicksPerSecond
  ) {
    issues.push(
      issue(
        "error",
        "logical-tick-rate-mismatch",
        "logicalTicksPerSecond",
        `Project uses ${input.logicalTicksPerSecond} logical ticks per second; ` +
          `profile requires ${profile.logicalTicksPerSecond}.`,
      ),
    );
  }
  if (input.pixelMotionPolicy !== undefined) {
    const requiresNative =
      profile.movement.quantization === "native-pixel" || profile.camera.quantization === "native-pixel";
    if (requiresNative && input.pixelMotionPolicy === "free") {
      issues.push(
        issue(
          "warning",
          "free-pixel-motion",
          "pixelMotionPolicy",
          "The selected profile requires native-pixel actor or camera " +
            "quantization, but the project allows free motion.",
        ),
      );
    }
  }
  if (
    input.renderInterpolation !== undefined &&
    input.renderInterpolation !== profile.presentation.renderInterpolation
  ) {
    issues.push(
      issue(
        "warning",
        "render-interpolation-mismatch",
        "renderInterpolation",
        `Renderer uses '${input.renderInterpolation}' interpolation; ` +
          `profile requires '${profile.presentation.renderInterpolation}'.`,
      ),
    );
  }
  const result = sorted(issues);
  const score = Math.max(
    0,
    100 -
      result.reduce(
        (total, entry) => total + (entry.severity === "error" ? 20 : entry.severity === "warning" ? 7 : 2),
        0,
      ),
  );
  return {
    reportVersion: 1,
    profileId: profile.id,
    status: result.some((entry) => entry.severity === "error")
      ? "blocked"
      : result.some((entry) => entry.severity === "warning")
        ? "attention"
        : "ready",
    score,
    issues: result,
  };
};

export const auditAdventureMotionTrace = (
  trace: AdventureMotionTrace,
  profile: AdventurePlayFeelProfile,
): readonly AdventurePlayFeelIssue[] => {
  const issues: AdventurePlayFeelIssue[] = [];
  if (trace.profileId !== profile.id) {
    issues.push(
      issue(
        "error",
        "trace-profile-mismatch",
        "trace.profileId",
        `Motion trace belongs to '${trace.profileId}', not '${profile.id}'.`,
      ),
    );
  }
  let previousTick = -1;
  let previousDistance = -1;
  for (const [index, sample] of trace.samples.entries()) {
    if (sample.tick <= previousTick) {
      issues.push(
        issue(
          "error",
          "non-monotonic-trace-tick",
          `trace.samples[${index}].tick`,
          "Motion trace ticks must increase strictly.",
        ),
      );
    }
    if (sample.distancePixels + 1e-7 < previousDistance) {
      issues.push(
        issue(
          "error",
          "motion-moved-backwards",
          `trace.samples[${index}].distancePixels`,
          "Canonical route distance moved backwards.",
        ),
      );
    }
    if (
      profile.movement.quantization === "native-pixel" &&
      (!Number.isInteger(sample.position.x) || !Number.isInteger(sample.position.y))
    ) {
      issues.push(
        issue(
          "error",
          "fractional-native-position",
          `trace.samples[${index}].position`,
          "Native-pixel motion emitted a fractional display position.",
        ),
      );
    }
    if (sample.velocityPixelsPerSecond > profile.movement.topSpeedPixelsPerSecond + 0.001) {
      issues.push(
        issue(
          "error",
          "motion-speed-exceeded",
          `trace.samples[${index}].velocityPixelsPerSecond`,
          "Motion trace exceeded the selected profile top speed.",
        ),
      );
    }
    previousTick = sample.tick;
    previousDistance = sample.distancePixels;
  }
  const final = trace.samples.at(-1);
  const destination = trace.route.points.at(-1);
  if (
    !final ||
    !destination ||
    final.phase !== "arrived" ||
    Math.hypot(final.unquantizedPosition.x - destination.x, final.unquantizedPosition.y - destination.y) >
      1e-6
  ) {
    issues.push(
      issue(
        "error",
        "motion-did-not-arrive",
        "trace.samples",
        "Motion trace did not finish exactly on the authored route destination.",
      ),
    );
  }
  return sorted(issues);
};
