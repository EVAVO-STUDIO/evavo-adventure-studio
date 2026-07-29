import type {
  RuntimeAssetRecord,
} from "@evavo/adventure-asset-contract";
import type { BitmapFontResolver } from "@evavo/adventure-bitmap-font/render";
import { bitmapFontResolverForAssetCollection } from "@evavo/adventure-bitmap-font/runtime-registry";
import type { Id } from "@evavo/adventure-project-schema";
import { Assets, Texture } from "pixi.js";

export interface PixiTextureStoreOptions {
  readonly aliasNamespace?: string;
}

export interface RuntimeTextureRequest {
  readonly assetId: Id<"asset">;
  readonly role: string;
  readonly runtimePath: string;
}

export interface RuntimeTexturePlan {
  readonly requests: readonly RuntimeTextureRequest[];
  readonly frameRoleById: ReadonlyMap<string, string>;
}

export class PixiRuntimeAssetKindError extends Error {
  readonly assetId: Id<"asset">;
  readonly assetKind: RuntimeAssetRecord["kind"];

  constructor(asset: RuntimeAssetRecord) {
    super(
      `Runtime asset '${asset.assetId}' has non-renderable kind '${asset.kind}'.`,
    );
    this.name = "PixiRuntimeAssetKindError";
    this.assetId = asset.assetId;
    this.assetKind = asset.kind;
  }
}

export class PixiRuntimeAssetOutputError extends Error {
  readonly assetId: Id<"asset">;
  readonly role: string;

  constructor(assetId: Id<"asset">, role: string, message: string) {
    super(`Runtime asset '${assetId}' output '${role}' is invalid: ${message}`);
    this.name = "PixiRuntimeAssetOutputError";
    this.assetId = assetId;
    this.role = role;
  }
}

export class PixiAssetLoadError extends Error {
  readonly assetId: Id<"asset">;
  readonly runtimePath: string;

  constructor(
    assetId: Id<"asset">,
    runtimePath: string,
    cause: unknown,
  ) {
    super(
      `PixiJS could not load runtime asset '${assetId}' from '${runtimePath}'.`,
      { cause },
    );
    this.name = "PixiAssetLoadError";
    this.assetId = assetId;
    this.runtimePath = runtimePath;
  }
}

export class PixiAssetTypeError extends Error {
  readonly assetId: Id<"asset">;
  readonly runtimePath: string;

  constructor(assetId: Id<"asset">, runtimePath: string) {
    super(
      `Runtime asset '${assetId}' output '${runtimePath}' did not resolve to a PixiJS Texture.`,
    );
    this.name = "PixiAssetTypeError";
    this.assetId = assetId;
    this.runtimePath = runtimePath;
  }
}

const normalizeNamespace = (value: string): string => {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (!normalized) {
    throw new RangeError("PixiJS texture alias namespace cannot be empty.");
  }
  return normalized;
};

const outputByRole = (
  asset: RuntimeAssetRecord,
): ReadonlyMap<string, RuntimeAssetRecord["outputFiles"][number]> =>
  new Map(asset.outputFiles.map((output) => [output.role, output] as const));

export const planRuntimeTextureLoads = (
  asset: RuntimeAssetRecord,
): RuntimeTexturePlan => {
  const outputs = outputByRole(asset);

  if (asset.kind === "image") {
    const primary = outputs.get("primary");
    if (!primary) {
      throw new PixiRuntimeAssetOutputError(
        asset.assetId,
        "primary",
        "the required primary image output is missing",
      );
    }
    return {
      requests: [
        {
          assetId: asset.assetId,
          role: primary.role,
          runtimePath: primary.runtimePath,
        },
      ],
      frameRoleById: new Map(),
    };
  }

  if (asset.kind !== "spritesheet") {
    throw new PixiRuntimeAssetKindError(asset);
  }

  const requests = asset.metadata.pages
    .map((page) => {
      const output = outputs.get(page.outputRole);
      if (!output) {
        throw new PixiRuntimeAssetOutputError(
          asset.assetId,
          page.outputRole,
          "the compiled atlas page output is missing",
        );
      }
      return {
        assetId: asset.assetId,
        role: output.role,
        runtimePath: output.runtimePath,
      } satisfies RuntimeTextureRequest;
    })
    .sort((left, right) => left.role.localeCompare(right.role));
  const frameRoleById = new Map(
    asset.metadata.frames.map((frame) => [
      frame.frameId as string,
      frame.pageOutputRole,
    ] as const),
  );

  return { requests, frameRoleById };
};

const runtimeUrl = (bundleUrl: string, runtimePath: string): string => {
  try {
    return new URL(runtimePath, bundleUrl).href;
  } catch (error) {
    throw new TypeError(
      `Runtime asset path '${runtimePath}' cannot be resolved against bundle URL '${bundleUrl}'.`,
      { cause: error },
    );
  }
};

const frameTextureKey = (
  assetId: Id<"asset">,
  frameId: Id<"sprite-frame">,
): string => `${assetId}\u0000${frameId}`;

export class PixiAssetTextureStore {
  private readonly aliasNamespace: string;
  private readonly primaryTextures = new Map<string, Texture>();
  private readonly frameTextures = new Map<string, Texture>();
  private readonly ownedAliases = new Map<string, string>();
  private readonly aliasesByAsset = new Map<string, Set<string>>();
  private readonly frameKeysByAsset = new Map<string, Set<string>>();
  private runtimeBitmapFonts: BitmapFontResolver | null = null;

  constructor(options: PixiTextureStoreOptions = {}) {
    this.aliasNamespace = normalizeNamespace(
      options.aliasNamespace ?? "evavo-adventure",
    );
  }

  getBitmapFontResolver(): BitmapFontResolver | null {
    return this.runtimeBitmapFonts;
  }

  getTexture(
    assetId: Id<"asset">,
    frameId: Id<"sprite-frame"> | null = null,
  ): Texture | null {
    if (frameId) {
      const frameTexture = this.frameTextures.get(
        frameTextureKey(assetId, frameId),
      );
      if (frameTexture) {
        return frameTexture;
      }
    }
    return this.primaryTextures.get(assetId) ?? null;
  }

  hasTexture(
    assetId: Id<"asset">,
    frameId: Id<"sprite-frame"> | null = null,
  ): boolean => this.getTexture(assetId, frameId) !== null;

  registerTexture(assetId: Id<"asset">, texture: Texture): void {
    if ((this.aliasesByAsset.get(assetId)?.size ?? 0) > 0) {
      throw new Error(
        `Asset '${assetId}' is owned by the PixiJS Assets loader and must be unloaded before replacement.`,
      );
    }
    this.primaryTextures.set(assetId, texture);
  }

  registerFrameTexture(
    assetId: Id<"asset">,
    frameId: Id<"sprite-frame">,
    texture: Texture,
  ): void {
    if ((this.aliasesByAsset.get(assetId)?.size ?? 0) > 0) {
      throw new Error(
        `Asset '${assetId}' is owned by the PixiJS Assets loader and must be unloaded before replacement.`,
      );
    }
    const key = frameTextureKey(assetId, frameId);
    this.frameTextures.set(key, texture);
    const keys = this.frameKeysByAsset.get(assetId) ?? new Set<string>();
    keys.add(key);
    this.frameKeysByAsset.set(assetId, keys);
  }

  async loadRuntimeAsset(
    asset: RuntimeAssetRecord,
    bundleUrl: string,
  ): Promise<void> {
    const plan = planRuntimeTextureLoads(asset);
    if (plan.requests.length === 0) {
      throw new PixiRuntimeAssetOutputError(
        asset.assetId,
        "pages",
        "no renderable texture outputs were planned",
      );
    }

    await this.unloadAsset(asset.assetId);
    const texturesByRole = new Map<string, Texture>();
    const loadedAliases: string[] = [];
    try {
      for (const request of plan.requests) {
        const alias = this.aliasFor(request.assetId, request.role);
        const sourceUrl = runtimeUrl(bundleUrl, request.runtimePath);
        let loaded: unknown;
        try {
          loaded = await Assets.load<Texture>({ alias, src: sourceUrl });
        } catch (error) {
          throw new PixiAssetLoadError(
            request.assetId,
            request.runtimePath,
            error,
          );
        }
        if (!(loaded instanceof Texture)) {
          await Assets.unload(alias);
          throw new PixiAssetTypeError(
            request.assetId,
            request.runtimePath,
          );
        }

        texturesByRole.set(request.role, loaded);
        this.ownedAliases.set(alias, request.assetId);
        const aliases =
          this.aliasesByAsset.get(request.assetId) ?? new Set<string>();
        aliases.add(alias);
        this.aliasesByAsset.set(request.assetId, aliases);
        loadedAliases.push(alias);
      }

      if (asset.kind === "image") {
        const primary = texturesByRole.get("primary");
        if (!primary) {
          throw new PixiRuntimeAssetOutputError(
            asset.assetId,
            "primary",
            "the primary texture did not load",
          );
        }
        this.primaryTextures.set(asset.assetId, primary);
        return;
      }

      if (asset.kind !== "spritesheet") {
        throw new PixiRuntimeAssetKindError(asset);
      }
      const frameKeys = new Set<string>();
      for (const [frameIdValue, pageRole] of plan.frameRoleById) {
        const texture = texturesByRole.get(pageRole);
        if (!texture) {
          throw new PixiRuntimeAssetOutputError(
            asset.assetId,
            pageRole,
            `frame '${frameIdValue}' refers to a page that did not load`,
          );
        }
        const frameId = frameIdValue as Id<"sprite-frame">;
        const key = frameTextureKey(asset.assetId, frameId);
        this.frameTextures.set(key, texture);
        frameKeys.add(key);
      }
      this.frameKeysByAsset.set(asset.assetId, frameKeys);
    } catch (error) {
      for (const alias of loadedAliases.reverse()) {
        await Assets.unload(alias).catch(() => undefined);
        this.ownedAliases.delete(alias);
      }
      this.aliasesByAsset.delete(asset.assetId);
      this.primaryTextures.delete(asset.assetId);
      for (const key of this.frameKeysByAsset.get(asset.assetId) ?? []) {
        this.frameTextures.delete(key);
      }
      this.frameKeysByAsset.delete(asset.assetId);
      throw error;
    }
  }

  async loadRuntimeAssets(
    assets: readonly RuntimeAssetRecord[],
    bundleUrl: string,
  ): Promise<void> {
    const renderable = assets
      .filter(
        (asset) => asset.kind === "image" || asset.kind === "spritesheet",
      )
      .sort((left, right) => left.assetId.localeCompare(right.assetId));

    for (const asset of renderable) {
      await this.loadRuntimeAsset(asset, bundleUrl);
    }
    this.runtimeBitmapFonts = bitmapFontResolverForAssetCollection(assets);
  }

  async unloadAsset(assetId: Id<"asset">): Promise<void> {
    const aliases = [...(this.aliasesByAsset.get(assetId) ?? [])].sort(
      (left, right) => left.localeCompare(right),
    );
    for (const alias of aliases) {
      await Assets.unload(alias);
      this.ownedAliases.delete(alias);
    }
    this.aliasesByAsset.delete(assetId);
    this.primaryTextures.delete(assetId);

    for (const key of this.frameKeysByAsset.get(assetId) ?? []) {
      this.frameTextures.delete(key);
    }
    this.frameKeysByAsset.delete(assetId);
  }

  async dispose(): Promise<void> {
    const assetIds = [...this.aliasesByAsset.keys()].sort((left, right) =>
      left.localeCompare(right),
    );
    for (const assetId of assetIds) {
      await this.unloadAsset(assetId as Id<"asset">);
    }

    this.primaryTextures.clear();
    this.frameTextures.clear();
    this.frameKeysByAsset.clear();
    this.ownedAliases.clear();
    this.runtimeBitmapFonts = null;
  }

  private aliasFor(assetId: Id<"asset">, role: string): string {
    return `${this.aliasNamespace}:${assetId}:${role}`;
  }
}
