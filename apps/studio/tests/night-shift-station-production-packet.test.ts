import { describe, expect, it } from "vitest";
import {
  nightShiftStationProductionPacket,
  nightShiftStationProductionPacketFileName,
  nightShiftStationProductionPacketJson,
} from "../src/night-shift-station-production-packet.js";

describe("Night Shift Station production packet", () => {
  it("contains canonical room, composition and staging data for the 320x200 slice", () => {
    expect(nightShiftStationProductionPacket).toMatchObject({
      packetVersion: 1,
      sceneId: "scene.night-shift.station",
      nativeCanvas: { width: 320, height: 200 },
      evidence: { expectedScoreAtExit: 14 },
    });
    expect(nightShiftStationProductionPacket.scene.id).toBe("scene.night-shift.station");
    expect(nightShiftStationProductionPacket.composition.sceneId).toBe("scene.night-shift.station");
    expect(nightShiftStationProductionPacket.staging.sceneId).toBe("scene.night-shift.station");
  });

  it("carries the real station palette/remap, occlusion, approach and audio contracts", () => {
    expect(nightShiftStationProductionPacket.staging.occlusionPlanes.length).toBeGreaterThanOrEqual(2);
    expect(nightShiftStationProductionPacket.staging.paletteLightZones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paletteMapId: "palette-map.night-shift.station-fluorescent",
        }),
      ]),
    );
    expect(
      Object.values(nightShiftStationProductionPacket.staging.approachSlotsByObject).flat(),
    ).not.toHaveLength(0);
    expect(nightShiftStationProductionPacket.audio.cues.length).toBeGreaterThanOrEqual(5);
    expect(nightShiftStationProductionPacket.audio.soundscape?.sceneId).toBe(
      "scene.night-shift.station",
    );
  });

  it("separates runtime index-map obligations from native UI/font master assets", () => {
    expect(nightShiftStationProductionPacket.runtimeIndexedAssetIds).toEqual(
      expect.arrayContaining([
        "asset.night-shift.actor.officer",
        "asset.night-shift.actor.sergeant",
        "asset.night-shift.background.station",
        "asset.night-shift.object.briefing",
        "asset.night-shift.object.radio",
        "asset.night-shift.object.keys",
        "asset.night-shift.object.door",
      ]),
    );
    expect(nightShiftStationProductionPacket.runtimeIndexedAssetIds).not.toContain(
      "asset.night-shift.font.system",
    );
    expect(nightShiftStationProductionPacket.runtimeIndexedAssetIds).not.toContain(
      "asset.night-shift.ui.walk",
    );
  });

  it("serialises deterministically with a stable filename", () => {
    expect(nightShiftStationProductionPacketJson()).toBe(nightShiftStationProductionPacketJson());
    expect(nightShiftStationProductionPacketJson().endsWith("\n")).toBe(true);
    expect(nightShiftStationProductionPacketFileName).toBe(
      "night-shift.station-production-packet.json",
    );
  });
});
