# Native Pixel Presentation

The Pixi renderer now derives a strict presentation policy from the canonical project profile. A project receives strict classic presentation only when all three authoring promises agree:

- integer scaling is enabled;
- texture sampling is nearest-neighbour;
- pixel motion policy is strict.

Under that contract the renderer rounds presentation coordinates, forces nearest texture sampling, disables automatic mipmap generation and rejects a render node that requests linear sampling. Canonical world positions, navigation geometry and hit targets are unchanged; quantisation occurs only at the final presentation boundary.

This prevents a project from claiming a native 1990s production language while quietly introducing filtered textures, fractional camera shimmer or browser-dependent sprite placement.

Modern or deliberately subpixel projects remain supported. When any part of the strict contract is disabled, the renderer uses the existing presentation behaviour rather than silently forcing a retro result.
