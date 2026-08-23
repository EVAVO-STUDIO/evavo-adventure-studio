import type { Id } from "@evavo/adventure-project-schema";
import { createPixiIndexedBufferTextureFactory } from "@evavo/adventure-renderer-pixi/indexed-buffer-texture";
import { PixiIndexedTextureCache } from "@evavo/adventure-renderer-pixi/indexed-texture-cache";
import type { PixiAssetTextureStore } from "@evavo/adventure-renderer-pixi/texture-store";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";

const runtimeUrl = (bundleUrl: string, runtimePath: string): string =>
  new URL(runtimePath, bundleUrl).href;

const hex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");

const sha256 = async (bytes: Uint8Array): Promise<string> =>
  hex(await crypto.subtle.digest("SHA-256", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));

const fetchVerifiedBytes = async (
  url: string,
  expectedLength: number,
  expectedSha256: string,
  label: string,
): Promise<Uint8Array> => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${label} could not be loaded from '${url}' (${response.status}).`);
  }
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength !== expectedLength) {
    throw new Error(`${label} has ${data.byteLength} bytes; expected ${expectedLength}.`);
  }
  const digest = await sha256(data);
  if (digest !== expectedSha256) {
    throw new Error(`${label} SHA-256 '${digest}' does not match '${expectedSha256}'.`);
  }
  return data;
};

const paletteIdsForBundle = (bundle: RuntimeBundle): readonly Id<"asset">[] => {
  const ids = new Set<Id<"asset">>();
  for (const record of bundle.indexedAssets?.assets ?? []) {
    ids.add(record.defaultPalette.paletteAssetId);
  }
  for (const map of bundle.paletteMaps?.maps ?? []) {
    ids.add(map.paletteAssetId);
  }
  return [...ids].sort((left, right) => left.localeCompare(right));
};

const paletteOutput = (bundle: RuntimeBundle, paletteAssetId: Id<"asset">) => {
  const asset = bundle.assets.find((candidate) => candidate.assetId === paletteAssetId);
  if (asset?.kind !== "palette") {
    throw new Error(`Indexed runtime palette '${paletteAssetId}' is missing or is not a palette asset.`);
  }
  const output = asset.outputFiles.find((candidate) => candidate.role === "primary");
  if (!output) {
    throw new Error(`Indexed runtime palette '${paletteAssetId}' has no primary output.`);
  }
  if (output.byteLength !== asset.metadata.entries * 4) {
    throw new Error(
      `Indexed runtime palette '${paletteAssetId}' has ${output.byteLength} bytes; ` +
        `expected ${asset.metadata.entries * 4} RGBA bytes.`,
    );
  }
  return { asset, output };
};

export const populateIndexedRuntimeTextures = async (
  bundle: RuntimeBundle,
  bundleUrl: string,
  resolver: PixiIndexedTextureCache,
): Promise<void> => {
  for (const record of bundle.indexedAssets?.assets ?? []) {
    const data = await fetchVerifiedBytes(
      runtimeUrl(bundleUrl, record.indexRuntimePath),
      record.indexByteLength,
      record.indexSha256,
      `Index map '${record.assetId}'`,
    );
    resolver.registerIndexMap(record, data);
  }

  for (const paletteAssetId of paletteIdsForBundle(bundle)) {
    const { output } = paletteOutput(bundle, paletteAssetId);
    const data = await fetchVerifiedBytes(
      runtimeUrl(bundleUrl, output.runtimePath),
      output.byteLength,
      output.sha256,
      `Palette '${paletteAssetId}'`,
    );
    resolver.registerPalette(paletteAssetId, data);
  }
};

export interface LoadedIndexedRuntimeTextures {
  readonly resolver: PixiIndexedTextureCache;
  dispose(): void;
}

export const loadIndexedRuntimeTextures = async (
  bundle: RuntimeBundle,
  bundleUrl: string,
  fallbackTextures: PixiAssetTextureStore,
): Promise<LoadedIndexedRuntimeTextures | null> => {
  if (!bundle.indexedAssets || bundle.indexedAssets.assets.length === 0) return null;

  const resolver = new PixiIndexedTextureCache(
    createPixiIndexedBufferTextureFactory(),
    fallbackTextures,
  );
  await populateIndexedRuntimeTextures(bundle, bundleUrl, resolver);

  return {
    resolver,
    dispose: () => resolver.clearResolvedTextures((texture) => texture.destroy(true)),
  };
};
