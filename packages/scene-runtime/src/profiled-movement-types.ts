import type {
  AdventureFootfall,
  AdventureMotionPhase,
  AdventureMotionRuntimeExtension,
  AdventureMotionRuntimeTuning,
  AdventureNativePoint,
  AdventurePlayFeelProfileId,
} from "@evavo/adventure-play-feel";
import type { Id } from "@evavo/adventure-project-schema";
import type { NavigationRoute } from "@evavo/adventure-scene/navigation";

export interface ProfiledNavigationMovementState {
  readonly stateVersion: 1;
  readonly actorInstanceId: Id<"actor-instance">;
  readonly profileId: AdventurePlayFeelProfileId;
  readonly routeFingerprint: string;
  readonly routePointCount: number;
  readonly extension: AdventureMotionRuntimeExtension;
  readonly lastPhase: AdventureMotionPhase;
  readonly completedSegmentCount: number;
}

export type ProfiledNavigationFallbackReason =
  | "route-too-short"
  | "route-point-segment-mismatch"
  | "zero-length-segment"
  | "non-geometric-portal";

export type ProfiledNavigationRejectionReason = "logical-tick-rate-mismatch" | "invalid-profile";

export type BeginProfiledNavigationMovementResult =
  | {
      readonly kind: "profiled";
      readonly state: ProfiledNavigationMovementState;
    }
  | {
      readonly kind: "legacy-fallback";
      readonly profileId: AdventurePlayFeelProfileId;
      readonly reason: ProfiledNavigationFallbackReason;
      readonly speedPixelsPerSecond: number;
    }
  | {
      readonly kind: "rejected";
      readonly profileId: AdventurePlayFeelProfileId;
      readonly reason: ProfiledNavigationRejectionReason;
      readonly message: string;
    };

export type ProfiledNavigationMovementEvent =
  | {
      readonly kind: "movement-phase-changed";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly previousPhase: AdventureMotionPhase;
      readonly phase: AdventureMotionPhase;
      readonly tick: number;
    }
  | {
      readonly kind: "movement-footfall";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly footfall: Exclude<AdventureFootfall, null>;
      readonly tick: number;
      readonly position: AdventureNativePoint;
    }
  | {
      readonly kind: "movement-segment-completed";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly segmentIndex: number;
      readonly tick: number;
    }
  | {
      readonly kind: "movement-completed";
      readonly actorInstanceId: Id<"actor-instance">;
      readonly tick: number;
      readonly position: AdventureNativePoint;
    };

export interface ProfiledNavigationMovementAdvance {
  readonly state: ProfiledNavigationMovementState;
  readonly events: readonly ProfiledNavigationMovementEvent[];
  readonly position: AdventureNativePoint;
  readonly unquantizedPosition: AdventureNativePoint;
  readonly distanceAdvancedPixels: number;
  readonly arrived: boolean;
}

export interface BeginProfiledNavigationMovementInput {
  readonly actorInstanceId: Id<"actor-instance">;
  readonly route: NavigationRoute;
  readonly profileId: AdventurePlayFeelProfileId;
  readonly logicalTicksPerSecond: number;
}

export interface AdvanceProfiledNavigationMovementOptions {
  readonly ticks?: number;
  readonly tuning?: AdventureMotionRuntimeTuning;
}

export type ProfiledNavigationCompatibilityIssueCode =
  | "invalid-route"
  | "route-fingerprint-mismatch"
  | "route-point-count-mismatch"
  | "profile-mismatch"
  | "logical-tick-rate-mismatch"
  | "invalid-motion-distance"
  | "invalid-motion-segment"
  | "invalid-motion-position"
  | "invalid-motion-display-position"
  | "invalid-motion-phase"
  | "invalid-walk-cycle-phase"
  | "invalid-completed-segment-count"
  | "invalid-arrival-state";

export interface ProfiledNavigationCompatibilityIssue {
  readonly severity: "error";
  readonly code: ProfiledNavigationCompatibilityIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface ProfiledNavigationCompatibilityInput {
  readonly state: ProfiledNavigationMovementState;
  readonly route: NavigationRoute;
  readonly logicalTicksPerSecond: number;
}
