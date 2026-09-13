import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract";
import type { Id } from "@evavo/adventure-project-schema";

export interface RuntimeAudioAssetRequest {
  readonly assetId: Id<"asset">;
  readonly runtimePath: string;
  readonly url: string;
  readonly mediaType: string;
}

export class RuntimeAudioAssetOutputError extends Error {
  readonly assetId: Id<"asset">;

  constructor(assetId: Id<"asset">, message: string) {
    super(`Runtime audio asset '${assetId}' is invalid: ${message}`);
    this.name = "RuntimeAudioAssetOutputError";
    this.assetId = assetId;
  }
}

const resolvedRuntimeUrl = (
  bundleUrl: string,
  runtimePath: string,
): string => {
  try {
    return new URL(runtimePath, bundleUrl).href;
  } catch (error) {
    throw new TypeError(
      `Runtime audio path '${runtimePath}' cannot be resolved against '${bundleUrl}'.`,
      { cause: error },
    );
  }
};

export const planRuntimeAudioAssets = (
  assets: readonly RuntimeAssetRecord[],
  bundleUrl: string,
): readonly RuntimeAudioAssetRequest[] =>
  assets
    .filter(
      (
        asset,
      ): asset is Extract<
        RuntimeAssetRecord,
        { readonly kind: "audio" }
      > => asset.kind === "audio",
    )
    .map((asset) => {
      const output = asset.outputFiles.find(
        (candidate) => candidate.role === "primary",
      );
      if (!output) {
        throw new RuntimeAudioAssetOutputError(
          asset.assetId,
          "the primary output is missing",
        );
      }
      if (!output.mediaType.startsWith("audio/")) {
        throw new RuntimeAudioAssetOutputError(
          asset.assetId,
          `primary output '${output.runtimePath}' has media type '${output.mediaType}'`,
        );
      }
      return {
        assetId: asset.assetId,
        runtimePath: output.runtimePath,
        url: resolvedRuntimeUrl(bundleUrl, output.runtimePath),
        mediaType: output.mediaType,
      } satisfies RuntimeAudioAssetRequest;
    })
    .sort((left, right) => left.assetId.localeCompare(right.assetId));
