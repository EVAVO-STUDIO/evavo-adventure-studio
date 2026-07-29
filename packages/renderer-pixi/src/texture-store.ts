import type { Asset, Id } from "@evavo/adventure-project-schema";
import { Assets, Texture } from "pixi.js";

export interface PixiTextureStoreOptions {
  readonly aliasNamespace?: string;
}

export class PixiAssetKindError extends Error {
  readonly assetId: Id<"asset">;
  readonly assetKind: Asset["kind"];

  constructor(asset: Asset) {
    super(
      `Asset '${asset.id}' has kind '${asset.kind}', but the PixiJS texture store only loads image assets.`,
    );
    this.name = "PixiAssetKindError";
    this.assetId = asset.id;
    this.assetKind = asset.kind;
  }
}

export class PixiAssetLoadError extends Error {
  readonly assetId: Id<"asset">;
  readonly path: string;

  constructor(asset: Asset, cause: unknown) {
    super(
      `PixiJS could not load image asset '${asset.id}' from '${asset.path}'.`,
      { cause },
    );
    this.name = "PixiAssetLoadError";
    this.assetId = asset.id;
    this.path = asset.path;
  }
}

export class PixiAssetTypeError extends Error {
  readonly assetId: Id<"asset">;

  constructor(asset: Asset) {
    super(`Asset '${asset.id}' did not resolve to a PixiJS Texture.`);
    this.name = "PixiAssetTypeError";
    this.assetId = asset.id;
  }
}

const normalizeNamespace = (value: string): string => {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (!normalized) {
    throw new RangeError("PixiJS texture alias namespace cannot be empty.");
  }
  return normalized;
};

export class PixiAssetTextureStore {
  private readonly aliasNamespace: string;
  private readonly textures = new Map<string, Texture>();
  private readonly ownedAliases = new Map<string, string>();

  constructor(options: PixiTextureStoreOptions = {}) {
    this.aliasNamespace = normalizeNamespace(
      options.aliasNamespace ?? "evavo-adventure",
    );
  }

  getTexture(assetId: Id<"asset">): Texture | null {
    return this.textures.get(assetId) ?? null;
  }

  hasTexture(assetId: Id<"asset">): boolean {
    return this.textures.has(assetId);
  }

  registerTexture(assetId: Id<"asset">, texture: Texture): void {
    if (this.ownedAliases.has(assetId)) {
      throw new Error(
        `Asset '${assetId}' is owned by the PixiJS Assets loader and must be unloaded before replacement.`,
      );
    }
    this.textures.set(assetId, texture);
  }

  async loadImageAsset(asset: Asset): Promise<Texture> {
    if (asset.kind !== "image") {
      throw new PixiAssetKindError(asset);
    }

    const existing = this.textures.get(asset.id);
    if (existing) {
      return existing;
    }

    const alias = this.aliasFor(asset.id);
    let loaded: unknown;
    try {
      loaded = await Assets.load<Texture>({
        alias,
        src: asset.path,
      });
    } catch (error) {
      throw new PixiAssetLoadError(asset, error);
    }

    if (!(loaded instanceof Texture)) {
      await Assets.unload(alias);
      throw new PixiAssetTypeError(asset);
    }

    this.textures.set(asset.id, loaded);
    this.ownedAliases.set(asset.id, alias);
    return loaded;
  }

  async loadImageAssets(
    assets: readonly Asset[],
  ): Promise<ReadonlyMap<string, Texture>> {
    const images = assets
      .filter((asset) => asset.kind === "image")
      .sort((left, right) => left.id.localeCompare(right.id));

    for (const asset of images) {
      await this.loadImageAsset(asset);
    }

    return new Map(this.textures);
  }

  async unloadAsset(assetId: Id<"asset">): Promise<void> {
    const alias = this.ownedAliases.get(assetId);
    if (alias) {
      await Assets.unload(alias);
      this.ownedAliases.delete(assetId);
    }
    this.textures.delete(assetId);
  }

  async dispose(): Promise<void> {
    const owned = [...this.ownedAliases.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );

    for (const [assetId, alias] of owned) {
      await Assets.unload(alias);
      this.ownedAliases.delete(assetId);
      this.textures.delete(assetId);
    }

    this.textures.clear();
  }

  private aliasFor(assetId: Id<"asset">): string {
    return `${this.aliasNamespace}:${assetId}`;
  }
}
