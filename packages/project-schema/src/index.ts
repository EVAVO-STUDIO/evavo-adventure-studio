import { z } from "zod";

export type Id<T extends string> = string & { readonly __id: T };

export const idSchema = <T extends string>(_kind: T) =>
  z.string().min(1).transform((value) => value as Id<T>);

export const scalarSchema = z.union([z.string(), z.number().finite(), z.boolean()]);
export type Scalar = z.infer<typeof scalarSchema>;

export const pointSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .strict();
export type Point = z.infer<typeof pointSchema>;

export const sizeSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();
export type Size = z.infer<typeof sizeSchema>;

export const rectangleSchema = z
  .object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();
export type Rectangle = z.infer<typeof rectangleSchema>;

export const polygonSchema = z
  .object({
    points: z.array(pointSchema).min(3),
  })
  .strict();
export type Polygon = z.infer<typeof polygonSchema>;

export type Condition =
  | { readonly kind: "always" }
  | { readonly kind: "flag"; readonly flag: string; readonly equals: boolean }
  | {
      readonly kind: "variable";
      readonly variable: string;
      readonly operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
      readonly value: Scalar;
    }
  | { readonly kind: "has-item"; readonly itemId: Id<"item"> }
  | { readonly kind: "interaction-used"; readonly interactionId: Id<"interaction"> }
  | { readonly kind: "all"; readonly conditions: readonly Condition[] }
  | { readonly kind: "any"; readonly conditions: readonly Condition[] }
  | { readonly kind: "not"; readonly condition: Condition };

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("always") }).strict(),
    z
      .object({
        kind: z.literal("flag"),
        flag: z.string().min(1),
        equals: z.boolean(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("variable"),
        variable: z.string().min(1),
        operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
        value: scalarSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("has-item"),
        itemId: idSchema("item"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("interaction-used"),
        interactionId: idSchema("interaction"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("all"),
        conditions: z.array(conditionSchema),
      })
      .strict(),
    z
      .object({
        kind: z.literal("any"),
        conditions: z.array(conditionSchema),
      })
      .strict(),
    z
      .object({
        kind: z.literal("not"),
        condition: conditionSchema,
      })
      .strict(),
  ]),
);

export const actionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("say"),
      speakerId: idSchema("actor").optional(),
      text: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("set-flag"),
      flag: z.string().min(1),
      value: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("set-variable"),
      variable: z.string().min(1),
      value: scalarSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("give-item"),
      itemId: idSchema("item"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("remove-item"),
      itemId: idSchema("item"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("award-score"),
      awardId: idSchema("score-award"),
      points: z.number().int(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("change-scene"),
      sceneId: idSchema("scene"),
      entranceId: idSchema("entrance"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("play-sequence"),
      sequenceId: idSchema("sequence"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("set-object-state"),
      objectId: idSchema("object"),
      state: z.string().min(1),
    })
    .strict(),
]);
export type Action = z.infer<typeof actionSchema>;

export const interactionSchema = z
  .object({
    id: idSchema("interaction"),
    verb: z.string().min(1),
    itemId: idSchema("item").optional(),
    when: conditionSchema.optional(),
    actions: z.array(actionSchema).min(1),
    once: z.boolean().optional(),
  })
  .strict();
export type Interaction = z.infer<typeof interactionSchema>;

export const hotspotSchema = z
  .object({
    id: idSchema("hotspot"),
    name: z.string().min(1),
    shape: polygonSchema,
    walkTo: pointSchema.optional(),
    faceDirection: z
      .enum([
        "north",
        "north-east",
        "east",
        "south-east",
        "south",
        "south-west",
        "west",
        "north-west",
      ])
      .optional(),
    cursor: z.string().min(1).optional(),
    interactions: z.array(interactionSchema),
    fallbackText: z.string().min(1).optional(),
  })
  .strict();
export type Hotspot = z.infer<typeof hotspotSchema>;

export const navigationAreaSchema = z
  .object({
    id: idSchema("navigation-area"),
    shape: polygonSchema,
    elevation: z.number().finite(),
    enabledWhen: conditionSchema.optional(),
  })
  .strict();
export type NavigationArea = z.infer<typeof navigationAreaSchema>;

export const depthBandSchema = z
  .object({
    id: idSchema("depth-band"),
    farY: z.number().finite(),
    nearY: z.number().finite(),
    farScale: z.number().positive(),
    nearScale: z.number().positive(),
    zOffset: z.number().finite().optional(),
  })
  .strict();
export type DepthBand = z.infer<typeof depthBandSchema>;

export const occluderSchema = z
  .object({
    id: idSchema("occluder"),
    assetId: idSchema("asset"),
    position: pointSchema,
    baselineY: z.number().finite(),
    mask: polygonSchema.optional(),
  })
  .strict();
export type Occluder = z.infer<typeof occluderSchema>;

export const entranceSchema = z
  .object({
    id: idSchema("entrance"),
    position: pointSchema,
    facing: z.enum([
      "north",
      "north-east",
      "east",
      "south-east",
      "south",
      "south-west",
      "west",
      "north-west",
    ]),
  })
  .strict();
export type Entrance = z.infer<typeof entranceSchema>;

export const spriteFrameSchema = z
  .object({
    id: idSchema("sprite-frame"),
    assetId: idSchema("asset"),
    sourceRect: rectangleSchema,
    sourceSize: sizeSchema,
    trimOffset: pointSchema,
    pivot: pointSchema,
    footPoint: pointSchema,
    shadowAnchor: pointSchema.optional(),
    attachmentPoints: z.record(z.string().min(1), pointSchema).optional(),
    durationTicks: z.number().int().positive(),
    events: z.array(z.string().min(1)).optional(),
    mirrorEligible: z.boolean().default(false),
  })
  .strict();
export type SpriteFrame = z.infer<typeof spriteFrameSchema>;

export const animationClipSchema = z
  .object({
    id: idSchema("animation-clip"),
    state: z.string().min(1),
    facing: z.string().min(1),
    frameIds: z.array(idSchema("sprite-frame")).min(1),
    loop: z.boolean(),
    interruptible: z.boolean(),
  })
  .strict();
export type AnimationClip = z.infer<typeof animationClipSchema>;

export const actorSchema = z
  .object({
    id: idSchema("actor"),
    name: z.string().min(1),
    frames: z.array(spriteFrameSchema),
    animations: z.array(animationClipSchema),
  })
  .strict();
export type Actor = z.infer<typeof actorSchema>;

export const sceneSchema = z
  .object({
    id: idSchema("scene"),
    name: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    backgroundAssetId: idSchema("asset"),
    navigationAreas: z.array(navigationAreaSchema),
    depthBands: z.array(depthBandSchema),
    occluders: z.array(occluderSchema),
    hotspots: z.array(hotspotSchema),
    entrances: z.array(entranceSchema).min(1),
    fallbackText: z.string().min(1),
  })
  .strict();
export type Scene = z.infer<typeof sceneSchema>;

export const presentationProfileSchema = z
  .object({
    nativeWidth: z.number().int().positive(),
    nativeHeight: z.number().int().positive(),
    interactionMode: z.enum([
      "icon-bar",
      "verb-list",
      "verb-coin",
      "two-button",
      "context",
      "parser-assisted",
    ]),
    integerScale: z.boolean(),
    textureSampling: z.enum(["nearest", "linear"]),
    logicalTicksPerSecond: z.number().int().positive(),
    pixelMotionPolicy: z.enum(["strict", "camera-strict", "free"]),
    showScore: z.boolean(),
    allowHotspotAssist: z.boolean(),
  })
  .strict();
export type PresentationProfile = z.infer<typeof presentationProfileSchema>;

export const assetSchema = z
  .object({
    id: idSchema("asset"),
    path: z.string().min(1),
    kind: z.enum(["image", "spritesheet", "audio", "font", "video", "palette"]),
  })
  .strict();
export type Asset = z.infer<typeof assetSchema>;

export const inventoryItemSchema = z
  .object({
    id: idSchema("item"),
    name: z.string().min(1),
    description: z.string(),
    iconAssetId: idSchema("asset"),
  })
  .strict();
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const adventureProjectSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema("project"),
    title: z.string().min(1),
    presentation: presentationProfileSchema,
    startSceneId: idSchema("scene"),
    startEntranceId: idSchema("entrance"),
    scenes: z.array(sceneSchema).min(1),
    actors: z.array(actorSchema),
    assets: z.array(assetSchema),
    inventoryItems: z.array(inventoryItemSchema),
  })
  .strict();
export type AdventureProject = z.infer<typeof adventureProjectSchema>;

export const parseAdventureProject = (input: unknown): AdventureProject =>
  adventureProjectSchema.parse(input);
