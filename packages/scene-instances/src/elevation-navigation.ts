import type { Id, NavigationArea, Point } from "@evavo/adventure-project-schema";
import { pointInPolygon } from "@evavo/adventure-scene";
import type { SceneNavigationPortal } from "./index.js";

export type NavigationPortalElevationKind = "flat" | "ascent" | "descent";

export interface NavigationPortalElevationTransition {
  readonly portalId: Id<"navigation-portal">;
  readonly fromAreaId: Id<"navigation-area">;
  readonly toAreaId: Id<"navigation-area">;
  readonly fromElevation: number;
  readonly toElevation: number;
  readonly delta: number;
  readonly kind: NavigationPortalElevationKind;
  readonly traversalAnimationState: string | null;
}

export type NavigationPortalElevationIssueCode =
  | "missing-from-area"
  | "missing-to-area"
  | "from-point-outside-area"
  | "to-point-outside-area"
  | "non-flat-transition-without-animation";

export interface NavigationPortalElevationIssue {
  readonly severity: "error" | "warning";
  readonly code: NavigationPortalElevationIssueCode;
  readonly portalId: Id<"navigation-portal">;
  readonly message: string;
}

const transitionKind = (delta: number): NavigationPortalElevationKind =>
  Math.abs(delta) < 1e-7 ? "flat" : delta > 0 ? "ascent" : "descent";

const areaById = (
  areas: readonly NavigationArea[],
  areaId: Id<"navigation-area">,
): NavigationArea | null => areas.find((area) => area.id === areaId) ?? null;

const pointInsideArea = (point: Point, area: NavigationArea): boolean => pointInPolygon(point, area.shape);

export const navigationPortalElevationTransition = (
  areas: readonly NavigationArea[],
  portal: SceneNavigationPortal,
): NavigationPortalElevationTransition | null => {
  const fromArea = areaById(areas, portal.fromAreaId);
  const toArea = areaById(areas, portal.toAreaId);
  if (!fromArea || !toArea) return null;
  const delta = toArea.elevation - fromArea.elevation;
  return {
    portalId: portal.id,
    fromAreaId: portal.fromAreaId,
    toAreaId: portal.toAreaId,
    fromElevation: fromArea.elevation,
    toElevation: toArea.elevation,
    delta,
    kind: transitionKind(delta),
    traversalAnimationState: portal.traversalAnimationState ?? null,
  };
};

export const auditNavigationPortalElevations = (
  areas: readonly NavigationArea[],
  portals: readonly SceneNavigationPortal[],
): readonly NavigationPortalElevationIssue[] => {
  const issues: NavigationPortalElevationIssue[] = [];
  for (const portal of portals) {
    const fromArea = areaById(areas, portal.fromAreaId);
    const toArea = areaById(areas, portal.toAreaId);
    if (!fromArea) {
      issues.push({
        severity: "error",
        code: "missing-from-area",
        portalId: portal.id,
        message: `Portal '${portal.id}' references missing from-area '${portal.fromAreaId}'.`,
      });
    }
    if (!toArea) {
      issues.push({
        severity: "error",
        code: "missing-to-area",
        portalId: portal.id,
        message: `Portal '${portal.id}' references missing to-area '${portal.toAreaId}'.`,
      });
    }
    if (!fromArea || !toArea) continue;
    if (!pointInsideArea(portal.fromPoint, fromArea)) {
      issues.push({
        severity: "error",
        code: "from-point-outside-area",
        portalId: portal.id,
        message: `Portal '${portal.id}' fromPoint is outside '${fromArea.id}'.`,
      });
    }
    if (!pointInsideArea(portal.toPoint, toArea)) {
      issues.push({
        severity: "error",
        code: "to-point-outside-area",
        portalId: portal.id,
        message: `Portal '${portal.id}' toPoint is outside '${toArea.id}'.`,
      });
    }
    const transition = navigationPortalElevationTransition(areas, portal);
    if (transition && transition.kind !== "flat" && !transition.traversalAnimationState) {
      issues.push({
        severity: "warning",
        code: "non-flat-transition-without-animation",
        portalId: portal.id,
        message:
          `Portal '${portal.id}' changes elevation ${transition.fromElevation} → ${transition.toElevation} ` +
          "but has no traversalAnimationState for stairs/ladder/platform choreography.",
      });
    }
  }
  return issues.sort((left, right) =>
    left.portalId.localeCompare(right.portalId) || left.code.localeCompare(right.code),
  );
};
