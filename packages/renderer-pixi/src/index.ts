import type { BitmapFontResolver } from "@evavo/adventure-bitmap-font/render";
import { expandBitmapTextFrame } from "@evavo/adventure-bitmap-font/render";
import type { Id } from "@evavo/adventure-project-schema";
import {
  type NativeCanvas,
  type RendererAdapter,
  type RendererHost,
  type RenderFrameIssue,
  type RenderNode,
  type ResolvedFrame,
  type SolidRectangleRenderNode,
  type SpriteRenderNode,
  validateResolvedFrame,
} from "@evavo/adventure-render-contract";
import { createIntegerPresentationTransform } from "@evavo/adventure-scene";
import { Application, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import {
  defaultPixelPresentationPolicy,
  type PixelPresentationPolicy,
  presentPixelPoint,
  resolvePixelSampling,
} from "./pixel-presentation.js";

export * from "./pixel-presentation.js";

export interface PixiTextureResolver {
  getTexture(assetId: Id<"asset">, frameId?: Id<"sprite-frame"> | null): Texture | null;
  getBitmapFontResolver?(): BitmapFontResolver | null;
}

export interface PixiRendererOptions {
  readonly textures: PixiTextureResolver;
  readonly bitmapFonts?: BitmapFontResolver;
  readonly pixelPresentation?: PixelPresentationPolicy;
}

export type UnsupportedPixiNodeKind = Exclude<RenderNode["kind"], "sprite" | "solid-rectangle">;

export class PixiRendererCapabilityError extends Error {
  readonly nodeId: Id<"render-node">;
  readonly nodeKind: UnsupportedPixiNodeKind;

  constructor(node: Exclude<RenderNode, SpriteRenderNode | SolidRectangleRenderNode>) {
    super(`PixiJS renderer capability '${node.kind}' is not implemented for node '${node.id}'.`);
    this.name = "PixiRendererCapabilityError";
    this.nodeId = node.id;
    this.nodeKind = node.kind;
  }
}

export class PixiTextureResolutionError extends Error {
  readonly assetId: Id<"asset">;
  readonly frameId: Id<"sprite-frame"> | null;

  constructor(assetId: Id<"asset">, frameId: Id<"sprite-frame"> | null = null) {
    super(
      frameId
        ? `No loaded PixiJS texture is available for asset '${assetId}' frame '${frameId}'.`
        : `No loaded PixiJS texture is available for asset '${assetId}'.`,
    );
    this.name = "PixiTextureResolutionError";
    this.assetId = assetId;
    this.frameId = frameId;
  }
}

export class PixiFrameValidationError extends Error {
  readonly issues: readonly RenderFrameIssue[];

  constructor(issues: readonly RenderFrameIssue[]) {
    super(`Resolved frame contains ${issues.length} renderer contract issue(s).`);
    this.name = "PixiFrameValidationError";
    this.issues = issues;
  }
}

export class PixiMaskTopologyError extends Error {
  readonly nodeId: Id<"render-node">;
  readonly maskNodeId: Id<"render-node">;

  constructor(nodeId: Id<"render-node">, maskNodeId: Id<"render-node">) {
    super(
      `Mask '${maskNodeId}' cannot cross the world and screen render-group boundary for node '${nodeId}'.`,
    );
    this.name = "PixiMaskTopologyError";
    this.nodeId = nodeId;
    this.maskNodeId = maskNodeId;
  }
}

export interface PixiFill {
  readonly color: number;
  readonly alpha: number;
}

const assertByte = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(`${label} must be an integer from 0 to 255.`);
  }
  return value;
};

export const toPixiFill = (value: number | readonly [number, number, number, number]): PixiFill => {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffff) {
      throw new RangeError("Packed colours must be integers from 0x000000 to 0xFFFFFF.");
    }
    return { color: value, alpha: 1 };
  }

  const red = assertByte(value[0], "Red");
  const green = assertByte(value[1], "Green");
  const blue = assertByte(value[2], "Blue");
  const alpha = assertByte(value[3], "Alpha");

  return {
    color: (red << 16) | (green << 8) | blue,
    alpha: alpha / 255,
  };
};

export const pixiSupportsNode = (node: RenderNode): node is SpriteRenderNode | SolidRectangleRenderNode =>
  node.kind === "sprite" || node.kind === "solid-rectangle";

const isHtmlCanvasElement = (value: unknown): value is HTMLCanvasElement =>
  typeof HTMLCanvasElement !== "undefined" && value instanceof HTMLCanvasElement;

const isHtmlElement = (value: unknown): value is HTMLElement =>
  typeof HTMLElement !== "undefined" && value instanceof HTMLElement;

const textureViewKey = (node: SpriteRenderNode): string =>
  [
    node.assetId,
    node.frameId ?? "",
    node.sourceRect.x,
    node.sourceRect.y,
    node.sourceRect.width,
    node.sourceRect.height,
    node.originalSize.width,
    node.originalSize.height,
    node.trimOffset.x,
    node.trimOffset.y,
    node.sampling,
  ].join(":");

const isWorldNode = (node: RenderNode): boolean =>
  node.order.layer === "sky" ||
  node.order.layer === "background" ||
  node.order.layer === "rear-ambient" ||
  node.order.layer === "world" ||
  node.order.layer === "occlusion" ||
  node.order.layer === "front-ambient" ||
  node.order.layer === "effects";

export class PixiWebGLRenderer implements RendererAdapter {
  private readonly textures: PixiTextureResolver;
  private readonly bitmapFonts: BitmapFontResolver | null;
  private readonly pixelPresentation: PixelPresentationPolicy;
  private readonly textureViews = new Map<string, Texture>();
  private application: Application | null = null;
  private clearRoot: Container | null = null;
  private worldRoot: Container | null = null;
  private screenRoot: Container | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private hostElement: HTMLElement | null = null;
  private nativeCanvas: NativeCanvas | null = null;
  private hostWidth = 0;
  private hostHeight = 0;

  constructor(options: PixiRendererOptions) {
    this.textures = options.textures;
    this.bitmapFonts = options.bitmapFonts ?? options.textures.getBitmapFontResolver?.() ?? null;
    this.pixelPresentation = options.pixelPresentation ?? defaultPixelPresentationPolicy;
  }

  async initialize(host: RendererHost, canvas: NativeCanvas): Promise<void> {
    if (this.application) {
      throw new Error("PixiJS renderer is already initialized.");
    }

    const suppliedCanvas = isHtmlCanvasElement(host.target) ? host.target : null;
    const hostElement = !suppliedCanvas && isHtmlElement(host.target) ? host.target : null;
    if (!suppliedCanvas && !hostElement) {
      throw new TypeError("PixiJS renderer host target must be an HTMLCanvasElement or HTMLElement.");
    }

    const application = new Application();
    await application.init({
      preference: "webgl",
      width: canvas.width,
      height: canvas.height,
      resolution: 1,
      antialias: false,
      autoDensity: false,
      autoStart: false,
      roundPixels: this.pixelPresentation.roundPixels,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      ...(suppliedCanvas ? { canvas: suppliedCanvas } : {}),
    });
    application.ticker.stop();

    const renderedCanvas = application.canvas;
    if (!isHtmlCanvasElement(renderedCanvas)) {
      application.destroy({ removeView: true }, true);
      throw new TypeError("PixiJS WebGL renderer did not create an HTMLCanvasElement.");
    }

    const clearRoot = new Container();
    const worldRoot = new Container({ isRenderGroup: true });
    const screenRoot = new Container({ isRenderGroup: true });
    application.stage.addChild(clearRoot, worldRoot, screenRoot);

    if (hostElement && renderedCanvas.parentElement !== hostElement) {
      if (!hostElement.style.position) {
        hostElement.style.position = "relative";
      }
      hostElement.appendChild(renderedCanvas);
    }

    renderedCanvas.style.display = "block";
    renderedCanvas.style.imageRendering = "pixelated";

    this.application = application;
    this.clearRoot = clearRoot;
    this.worldRoot = worldRoot;
    this.screenRoot = screenRoot;
    this.canvasElement = renderedCanvas;
    this.hostElement = hostElement;
    this.nativeCanvas = canvas;
    this.hostWidth = canvas.width;
    this.hostHeight = canvas.height;
    this.applyHostPresentation();
  }

  render(frame: ResolvedFrame): void {
    const resolvedFrame = this.bitmapFonts ? expandBitmapTextFrame(frame, this.bitmapFonts) : frame;
    const issues = validateResolvedFrame(resolvedFrame);
    if (issues.length > 0) {
      throw new PixiFrameValidationError(issues);
    }

    const application = this.requireApplication();
    const clearRoot = this.requireRoot(this.clearRoot, "clear");
    const worldRoot = this.requireRoot(this.worldRoot, "world");
    const screenRoot = this.requireRoot(this.screenRoot, "screen");

    this.ensureNativeCanvas(resolvedFrame.canvas);
    this.destroyChildren(clearRoot);
    this.destroyChildren(worldRoot);
    this.destroyChildren(screenRoot);

    const clear = toPixiFill(resolvedFrame.canvas.clearColor);
    clearRoot.addChild(
      new Graphics()
        .rect(0, 0, resolvedFrame.canvas.width, resolvedFrame.canvas.height)
        .fill({ color: clear.color, alpha: clear.alpha }),
    );

    const objectsById = new Map<string, Container>();
    const nodesById = new Map<string, RenderNode>();
    for (const node of resolvedFrame.nodes) {
      const object = this.createNode(node);
      this.applyNodeTransform(object, node);
      (isWorldNode(node) ? worldRoot : screenRoot).addChild(object);
      objectsById.set(node.id, object);
      nodesById.set(node.id, node);
    }

    for (const node of resolvedFrame.nodes) {
      if (!node.maskNodeId) {
        continue;
      }
      const object = objectsById.get(node.id);
      const mask = objectsById.get(node.maskNodeId);
      const maskNode = nodesById.get(node.maskNodeId);
      if (!object || !mask || !maskNode) {
        throw new Error(
          `Resolved frame mask relationship '${node.id}' -> '${node.maskNodeId}' is incomplete.`,
        );
      }
      if (isWorldNode(node) !== isWorldNode(maskNode)) {
        throw new PixiMaskTopologyError(node.id, node.maskNodeId);
      }
      object.mask = mask;
    }

    const cameraPosition = presentPixelPoint(this.pixelPresentation, {
      x: -resolvedFrame.camera.position.x + resolvedFrame.camera.shakeOffset.x,
      y: -resolvedFrame.camera.position.y + resolvedFrame.camera.shakeOffset.y,
    });
    worldRoot.position.set(cameraPosition.x, cameraPosition.y);
    screenRoot.position.set(0, 0);
    application.renderer.render(application.stage);
  }

  resize(hostWidth: number, hostHeight: number): void {
    if (!Number.isFinite(hostWidth) || !Number.isFinite(hostHeight) || hostWidth <= 0 || hostHeight <= 0) {
      throw new RangeError("Renderer host dimensions must be positive finite numbers.");
    }

    this.hostWidth = Math.floor(hostWidth);
    this.hostHeight = Math.floor(hostHeight);
    this.applyHostPresentation();
  }

  async destroy(): Promise<void> {
    for (const texture of this.textureViews.values()) {
      texture.destroy(false);
    }
    this.textureViews.clear();

    if (this.application) {
      this.application.destroy({ removeView: this.hostElement !== null }, true);
    }

    this.application = null;
    this.clearRoot = null;
    this.worldRoot = null;
    this.screenRoot = null;
    this.canvasElement = null;
    this.hostElement = null;
    this.nativeCanvas = null;
    this.hostWidth = 0;
    this.hostHeight = 0;
  }

  private requireApplication(): Application {
    if (!this.application) {
      throw new Error("PixiJS renderer is not initialized.");
    }
    return this.application;
  }

  private requireRoot(root: Container | null, label: string): Container {
    if (!root) {
      throw new Error(`PixiJS ${label} root is not initialized.`);
    }
    return root;
  }

  private ensureNativeCanvas(canvas: NativeCanvas): void {
    const application = this.requireApplication();
    if (this.nativeCanvas?.width !== canvas.width || this.nativeCanvas?.height !== canvas.height) {
      application.renderer.resize(canvas.width, canvas.height);
    }
    this.nativeCanvas = canvas;
    this.applyHostPresentation();
  }

  private applyHostPresentation(): void {
    const canvas = this.canvasElement;
    const native = this.nativeCanvas;
    if (!canvas || !native || this.hostWidth <= 0 || this.hostHeight <= 0) {
      return;
    }

    const transform = createIntegerPresentationTransform(
      native.width,
      native.height,
      this.hostWidth,
      this.hostHeight,
    );
    canvas.style.width = `${native.width * transform.scale}px`;
    canvas.style.height = `${native.height * transform.scale}px`;

    if (this.hostElement) {
      canvas.style.position = "absolute";
      canvas.style.left = `${transform.offsetX}px`;
      canvas.style.top = `${transform.offsetY}px`;
      canvas.style.marginLeft = "0";
      canvas.style.marginTop = "0";
    } else {
      canvas.style.position = "relative";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.marginLeft = `${transform.offsetX}px`;
      canvas.style.marginTop = `${transform.offsetY}px`;
    }
  }

  private destroyChildren(root: Container): void {
    for (const child of root.removeChildren()) {
      child.destroy();
    }
  }

  private createNode(node: RenderNode): Container {
    if (!pixiSupportsNode(node)) {
      throw new PixiRendererCapabilityError(node);
    }

    if (node.kind === "solid-rectangle") {
      const fill = toPixiFill(node.color);
      return new Graphics()
        .rect(0, 0, node.size.width, node.size.height)
        .fill({ color: fill.color, alpha: fill.alpha });
    }

    const sprite = new Sprite(this.textureView(node));
    if (node.tintRgba) {
      sprite.tint = toPixiFill(node.tintRgba).color;
    }
    return sprite;
  }

  private textureView(node: SpriteRenderNode): Texture {
    const key = textureViewKey(node);
    const existing = this.textureViews.get(key);
    if (existing) {
      return existing;
    }

    const base = this.textures.getTexture(node.assetId, node.frameId ?? null);
    if (!base) {
      throw new PixiTextureResolutionError(node.assetId, node.frameId ?? null);
    }
    base.source.scaleMode = resolvePixelSampling(this.pixelPresentation, node.sampling);
    if (this.pixelPresentation.disableMipmaps) {
      base.source.autoGenerateMipmaps = false;
    }

    const texture = new Texture({
      source: base.source,
      frame: new Rectangle(
        node.sourceRect.x,
        node.sourceRect.y,
        node.sourceRect.width,
        node.sourceRect.height,
      ),
      orig: new Rectangle(0, 0, node.originalSize.width, node.originalSize.height),
      trim: new Rectangle(
        node.trimOffset.x,
        node.trimOffset.y,
        node.sourceRect.width,
        node.sourceRect.height,
      ),
      label: `evavo:${key}`,
    });
    this.textureViews.set(key, texture);
    return texture;
  }

  private applyNodeTransform(object: Container, node: RenderNode): void {
    const position = presentPixelPoint(this.pixelPresentation, node.transform.position);
    object.position.set(position.x, position.y);
    object.pivot.set(node.transform.pivot.x, node.transform.pivot.y);
    object.scale.set(node.transform.scale.x, node.transform.scale.y);
    object.rotation = node.transform.rotationRadians;
    const tintAlpha = node.kind === "sprite" && node.tintRgba ? toPixiFill(node.tintRgba).alpha : 1;
    object.alpha = node.opacity * tintAlpha;
    object.visible = node.visible;
  }
}
