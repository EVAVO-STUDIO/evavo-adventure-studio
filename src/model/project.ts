export type Id<T extends string> = string & { readonly __kind: T };

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Polygon {
  readonly points: readonly Point[];
}

export type InteractionMode =
  | "icon-bar"
  | "verb-list"
  | "verb-coin"
  | "two-button"
  | "context"
  | "parser-assisted";

export type Condition =
  | { readonly kind: "always" }
  | { readonly kind: "flag"; readonly flag: string; readonly equals: boolean }
  | { readonly kind: "variable"; readonly variable: string; readonly operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; readonly value: number | string | boolean }
  | { readonly kind: "has-item"; readonly itemId: Id<"item"> }
  | { readonly kind: "all"; readonly conditions: readonly Condition[] }
  | { readonly kind: "any"; readonly conditions: readonly Condition[] }
  | { readonly kind: "not"; readonly condition: Condition };

export type Action =
  | { readonly kind: "say"; readonly speakerId?: Id<"actor">; readonly text: string }
  | { readonly kind: "set-flag"; readonly flag: string; readonly value: boolean }
  | { readonly kind: "set-variable"; readonly variable: string; readonly value: number | string | boolean }
  | { readonly kind: "give-item"; readonly itemId: Id<"item"> }
  | { readonly kind: "remove-item"; readonly itemId: Id<"item"> }
  | { readonly kind: "award-score"; readonly awardId: Id<"score-award">; readonly points: number }
  | { readonly kind: "change-scene"; readonly sceneId: Id<"scene">; readonly entranceId: Id<"entrance"> }
  | { readonly kind: "play-sequence"; readonly sequenceId: Id<"sequence"> }
  | { readonly kind: "set-object-state"; readonly objectId: Id<"object">; readonly state: string };

export interface Interaction {
  readonly id: Id<"interaction">;
  readonly verb: string;
  readonly itemId?: Id<"item">;
  readonly when?: Condition;
  readonly actions: readonly Action[];
  readonly once?: boolean;
}

export interface Hotspot {
  readonly id: Id<"hotspot">;
  readonly name: string;
  readonly shape: Polygon;
  readonly walkTo?: Point;
  readonly faceDirection?: "north" | "north-east" | "east" | "south-east" | "south" | "south-west" | "west" | "north-west";
  readonly cursor?: string;
  readonly interactions: readonly Interaction[];
  readonly fallbackText?: string;
}

export interface NavigationArea {
  readonly id: Id<"navigation-area">;
  readonly shape: Polygon;
  readonly elevation: number;
  readonly enabledWhen?: Condition;
}

export interface DepthBand {
  readonly id: Id<"depth-band">;
  readonly nearY: number;
  readonly farY: number;
  readonly nearScale: number;
  readonly farScale: number;
  readonly zOffset?: number;
}

export interface Occluder {
  readonly id: Id<"occluder">;
  readonly assetId: Id<"asset">;
  readonly position: Point;
  readonly baselineY: number;
  readonly mask?: Polygon;
}

export interface Scene {
  readonly id: Id<"scene">;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly backgroundAssetId: Id<"asset">;
  readonly navigationAreas: readonly NavigationArea[];
  readonly depthBands: readonly DepthBand[];
  readonly occluders: readonly Occluder[];
  readonly hotspots: readonly Hotspot[];
  readonly entranceIds: readonly Id<"entrance">[];
  readonly fallbackText: string;
}

export interface PresentationProfile {
  readonly nativeWidth: number;
  readonly nativeHeight: number;
  readonly interactionMode: InteractionMode;
  readonly integerScale: boolean;
  readonly textureSampling: "nearest" | "linear";
  readonly logicalFramesPerSecond: number;
  readonly showScore: boolean;
  readonly allowHotspotAssist: boolean;
}

export interface AdventureProject {
  readonly schemaVersion: 1;
  readonly id: Id<"project">;
  readonly title: string;
  readonly presentation: PresentationProfile;
  readonly startSceneId: Id<"scene">;
  readonly scenes: readonly Scene[];
  readonly assets: readonly { readonly id: Id<"asset">; readonly path: string; readonly kind: "image" | "spritesheet" | "audio" | "font" | "video" }[];
  readonly inventoryItems: readonly { readonly id: Id<"item">; readonly name: string; readonly description: string; readonly iconAssetId: Id<"asset"> }[];
}
