import { encodeNativeRgbaPng } from "./native-png.js";
import { nightShiftStationProductionPacket } from "./night-shift-station-production-packet.js";

const WIDTH = 320;
const HEIGHT = 200;
type Rgba = readonly [number, number, number, number];
const C = {
  background: [12, 15, 18, 255] as Rgba,
  uiSafe: [35, 38, 42, 255] as Rgba,
  navigation: [70, 122, 93, 255] as Rgba,
  lane: [116, 145, 102, 255] as Rgba,
  actor: [218, 208, 175, 255] as Rgba,
  object: [180, 154, 108, 255] as Rgba,
  approach: [220, 134, 93, 255] as Rgba,
  occlusion: [150, 105, 161, 255] as Rgba,
  light: [103, 160, 176, 255] as Rgba,
  entrance: [183, 202, 115, 255] as Rgba,
} as const;

const setPixel = (rgba: Uint8Array, x: number, y: number, color: Rgba): void => {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const offset = (Math.floor(y) * WIDTH + Math.floor(x)) * 4;
  rgba[offset] = color[0];
  rgba[offset + 1] = color[1];
  rgba[offset + 2] = color[2];
  rgba[offset + 3] = color[3];
};

const line = (
  rgba: Uint8Array,
  x0Value: number,
  y0Value: number,
  x1Value: number,
  y1Value: number,
  color: Rgba,
): void => {
  let x0 = Math.round(x0Value);
  let y0 = Math.round(y0Value);
  const x1 = Math.round(x1Value);
  const y1 = Math.round(y1Value);
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    setPixel(rgba, x0, y0, color);
    if (x0 === x1 && y0 === y1) break;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x0 += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y0 += sy;
    }
  }
};

const polygon = (
  rgba: Uint8Array,
  points: readonly { readonly x: number; readonly y: number }[],
  color: Rgba,
): void => {
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    if (start && end) line(rgba, start.x, start.y, end.x, end.y, color);
  }
};

const cross = (rgba: Uint8Array, x: number, y: number, color: Rgba, radius = 3): void => {
  line(rgba, x - radius, y, x + radius, y, color);
  line(rgba, x, y - radius, x, y + radius, color);
};

const rectangle = (
  rgba: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Rgba,
): void => {
  line(rgba, x, y, x + width - 1, y, color);
  line(rgba, x + width - 1, y, x + width - 1, y + height - 1, color);
  line(rgba, x + width - 1, y + height - 1, x, y + height - 1, color);
  line(rgba, x, y + height - 1, x, y, color);
};

export const nightShiftStationCompositionGuidePngBytes = (): Uint8Array => {
  const rgba = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
    const offset = pixel * 4;
    rgba[offset] = C.background[0];
    rgba[offset + 1] = C.background[1];
    rgba[offset + 2] = C.background[2];
    rgba[offset + 3] = 255;
  }

  rectangle(rgba, 0, 0, WIDTH, 38, C.uiSafe);
  for (const area of nightShiftStationProductionPacket.scene.navigationAreas) {
    polygon(rgba, area.shape.points, C.navigation);
  }
  for (const lane of nightShiftStationProductionPacket.staging.preferredWalkLanes) {
    for (let index = 0; index + 1 < lane.points.length; index += 1) {
      const start = lane.points[index];
      const end = lane.points[index + 1];
      if (start && end) line(rgba, start.x, start.y, end.x, end.y, C.lane);
    }
  }
  for (const actor of nightShiftStationProductionPacket.composition.actorInstances) {
    cross(rgba, actor.position.x, actor.position.y, C.actor, 4);
  }
  for (const object of nightShiftStationProductionPacket.composition.objectInstances) {
    cross(rgba, object.position.x, object.position.y, C.object, 3);
  }
  for (const slots of Object.values(nightShiftStationProductionPacket.staging.approachSlotsByObject)) {
    for (const slot of slots) cross(rgba, slot.position.x, slot.position.y, C.approach, 2);
  }
  for (const plane of nightShiftStationProductionPacket.staging.occlusionPlanes) {
    line(rgba, 0, plane.baselineY, WIDTH - 1, plane.baselineY, C.occlusion);
  }
  for (const zone of nightShiftStationProductionPacket.staging.paletteLightZones) {
    polygon(rgba, zone.shape.points, C.light);
  }
  for (const entrance of nightShiftStationProductionPacket.scene.entrances) {
    cross(rgba, entrance.position.x, entrance.position.y, C.entrance, 4);
  }

  return encodeNativeRgbaPng(WIDTH, HEIGHT, rgba);
};

export const nightShiftStationCompositionGuide = {
  fileName: "night-shift.station-composition-guide.png",
  width: WIDTH,
  height: HEIGHT,
  runtimeAsset: false,
  purpose:
    "Non-runtime native guide showing UI-safe band, walk geometry, anchors, approaches, occlusion baselines and fluorescent light geometry for Station art production.",
  legend: C,
} as const;
