import type { Id } from "@evavo/adventure-project-schema";
import type {
  ResolvedFrame,
  SpriteRenderNode,
} from "@evavo/adventure-render-contract";
import {
  parseRuntimeBundle,
  type RuntimeBundle,
} from "@evavo/adventure-runtime-bundle";

export class RuntimeBundleFetchError extends Error {
  readonly bundleUrl: string;
  readonly status: number | null;

  constructor(bundleUrl: string, message: string, status: number | null = null) {
    super(`Runtime bundle '${bundleUrl}' could not be loaded: ${message}`);
    this.name = "RuntimeBundleFetchError";
    this.bundleUrl = bundleUrl;
    this.status = status;
  }
}

export interface RuntimeBundleFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  json(): Promise<unknown>;
}

export type RuntimeBundleFetch = (
  input: string,
) => Promise<RuntimeBundleFetchResponse>;

export const loadRuntimeBundle = async (
  bundleUrl: string,
  fetchBundle: RuntimeBundleFetch = async (input) => fetch(input),
): Promise<RuntimeBundle> => {
  let response: RuntimeBundleFetchResponse;
  try {
    response = await fetchBundle(bundleUrl);
  } catch (error) {
    throw new RuntimeBundleFetchError(
      bundleUrl,
      error instanceof Error ? error.message : String(error),
    );
  }

  if (!response.ok) {
    throw new RuntimeBundleFetchError(
      bundleUrl,
      `${response.status} ${response.statusText}`.trim(),
      response.status,
    );
  }

  let input: unknown;
  try {
    input = await response.json();
  } catch (error) {
    throw new RuntimeBundleFetchError(
      bundleUrl,
      `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      response.status,
    );
  }

  return parseRuntimeBundle(input);
};

const renderNodeId = (value: string): Id<"render-node"> =>
  value as Id<"render-node">;

const backgroundNode = (bundle: RuntimeBundle): SpriteRenderNode => {
  const scene = bundle.scenes.find(
    (candidate) => candidate.id === bundle.startSceneId,
  );
  if (!scene) {
    throw new Error(`Start scene '${bundle.startSceneId}' is unavailable.`);
  }

  const asset = bundle.assets.find(
    (candidate) => candidate.assetId === scene.backgroundAssetId,
  );
  if (!asset) {
    throw new Error(
      `Start scene '${scene.id}' background '${scene.backgroundAssetId}' is unavailable.`,
    );
  }
  if (asset.kind !== "image") {
    throw new Error(
      `Start scene '${scene.id}' background must be an image runtime asset, not '${asset.kind}'.`,
    );
  }

  return {
    kind: "sprite",
    id: renderNodeId(`render.scene.${scene.id}.background`),
    order: {
      layer: "background",
      elevation: 0,
      baselineY: scene.height,
      zOffset: 0,
      stableId: `scene.${scene.id}.background`,
    },
    transform: {
      position: { x: 0, y: 0 },
      pivot: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotationRadians: 0,
    },
    opacity: 1,
    visible: true,
    assetId: asset.assetId,
    sourceRect: {
      x: 0,
      y: 0,
      width: asset.metadata.width,
      height: asset.metadata.height,
    },
    originalSize: {
      width: asset.metadata.width,
      height: asset.metadata.height,
    },
    trimOffset: { x: 0, y: 0 },
    sampling: bundle.presentation.textureSampling,
  };
};

export const createRuntimeStartFrame = (
  bundle: RuntimeBundle,
  tick: number,
): ResolvedFrame => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError("Runtime preview tick must be a non-negative safe integer.");
  }
  const scene = bundle.scenes.find(
    (candidate) => candidate.id === bundle.startSceneId,
  );
  if (!scene) {
    throw new Error(`Start scene '${bundle.startSceneId}' is unavailable.`);
  }

  return {
    frameVersion: 1,
    tick,
    canvas: {
      width: bundle.presentation.nativeWidth,
      height: bundle.presentation.nativeHeight,
      clearColor: [0, 0, 0, 255],
    },
    camera: {
      position: { x: 0, y: 0 },
      viewport: {
        width: bundle.presentation.nativeWidth,
        height: bundle.presentation.nativeHeight,
      },
      shakeOffset: { x: 0, y: 0 },
    },
    nodes: [backgroundNode(bundle)],
  };
};
