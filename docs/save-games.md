# Deterministic save games

## Purpose

Save games preserve a playable EVAVO Adventure Studio runtime without copying source-project files, browser state or rendering resources. A save is accepted only by the exact compiled game bundle that created it.

The canonical contract is `SaveGame` from `@evavo/adventure-save-game`.

## Persisted state

Version 1 saves contain:

- project ID;
- canonical runtime-bundle fingerprint;
- compiled asset-manifest fingerprint;
- story tick, current scene and entrance;
- flags and scalar variables;
- inventory, score awards and total score;
- consumed interactions and dialogue choices;
- active dialogue and dialogue node;
- active cinematic and ambient sequence cursors;
- deterministic random-stream state;
- persistent object states;
- every authored actor instance, including scene, position, facing, animation state and exact animation playback cursor;
- active navigation routes and progress within the current segment;
- deferred object commands waiting for actor arrival;
- controlled actor identity;
- selected interface verb and inventory item;
- current status or speech text;
- parser text and command history.

All records are serialized with sorted object keys and receive an FNV-1a 64-bit payload fingerprint. The serialized file contains no timestamp, absolute workstation path or random save identifier.

## Deliberately transient state

The following state is reset during restore:

- pointer position;
- pointer pressed state;
- hovered world object;
- hovered verb or dialogue choice;
- open verb-coin position;
- parser keyboard focus;
- host animation-frame timing.

These values describe the current input device rather than the game world. Persisting them would create stuck buttons, stale hover targets or surprising focus after restore.

## Compatibility validation

A load fails before mutation when any of these have changed or become invalid:

- project or runtime-bundle fingerprint;
- compiled asset-manifest fingerprint;
- current scene or entrance;
- inventory item IDs;
- active dialogue, node or sequence IDs;
- authored actor-instance set or identity;
- animation clip, frame or frame progress;
- movement route progress;
- persistent object definitions or state IDs;
- pending command actor, object or item references;
- selected verb or selected inventory item;
- parser history limit;
- controlled actor identity used by the mounted player.

The bundle fingerprint means a new compiled build receives a separate browser slot instead of silently interpreting an older save with changed scripts or geometry.

## Cinematic save policy

Every sequence declares one policy:

- `allowed` permits saving while the sequence is active;
- `boundary-only` permits saving only before progress has moved beyond a sequence boundary;
- `disabled` blocks saving while the sequence is active.

This prevents a save from resuming inside a cinematic position that was not authored to be recoverable.

## Browser quick slot

The packaged browser player currently provides one bundle-scoped quick slot:

- `Ctrl` or `Cmd` + `Shift` + `S`: save;
- `Ctrl` or `Cmd` + `Shift` + `L`: load.

The key contains the project ID and exact runtime-bundle fingerprint. Browser storage is only the persistence transport; stored JSON is parsed, fingerprinted and semantically validated through the canonical save package before it can replace runtime state.

Loading resets the fixed-step host clock to the restored story tick before the next frame. This avoids immediately fast-forwarding from the restored moment to the time at which the load shortcut was pressed.

## Future migration boundary

`saveVersion` is independent from the project schema and runtime bundle versions. A future migration service must explicitly transform an older save into the newest supported save schema before compatibility validation. Version 1 never performs best-effort field guessing.
