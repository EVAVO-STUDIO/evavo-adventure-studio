# Browser playtest automation

## Purpose

Adventure Studio ships a TypeScript and PixiJS browser runtime. Godot Game Test Lab remains the correct executable evidence lane for repositories that contain a Godot project; it is not used to pretend that the Adventure Studio browser player is a Godot game.

The Player instead exposes an explicit, opt-in browser playtest bridge backed by the same packaged controller, fixed ticks, save state, lifecycle outcome and replay contracts used by normal play. This gives a browser worker a bounded way to drive native coordinates, wait for deterministic motion settlement, inspect state and capture screenshots without exposing a shell or enabling automation on ordinary player URLs.

## Opt in

Add `playtest=1` to a packaged player URL:

```text
/?demo=red-ledger&playtest=1
```

After the title screen starts the game, Player installs:

```js
window.__EVAVO_ADVENTURE_PLAYTEST__
```

No global bridge is installed when the query parameter is absent, `0`, or another unsupported value.

## Bridge contract

The bridge exposes:

- `bridgeVersion` and exact project identity;
- native canvas width and height;
- `snapshot()` for current canonical playtest state;
- `advanceTo(tick)` for monotonic fixed-tick advancement;
- `activate(position)` for one native-coordinate activation;
- `activateAndSettle(position, maxTicks)` for activation followed by bounded deterministic settlement.

Snapshots include scene, tick, score, ordered inventory, flags, persistent object states, active dialogue node, active sequences, controlled actor staging, lifecycle outcome, status text and whether movement and pending object commands have settled.

Coordinates outside the authored native canvas, backwards time and non-positive or unsafe tick limits fail closed.

## Red Ledger plan

The tracked browser-neutral plan is served at:

```text
/demos/the-red-ledger/playtest-plan.json
```

It declares:

- the exact Player route and opt-in parameter;
- the title and primary shell action;
- the controlled actor;
- eleven native activations;
- bounded settlement policy;
- semantic checkpoints;
- nine retained capture labels from title through `CASE PROVED`.

The Vitest integration consumes the same plan through the real Player controller and then converts the recorded activations into a deterministic replay. Replay closure must produce the exact same final save fingerprint and terminal lifecycle state.

## Browser worker flow

A browser runner should:

1. open the tracked route at the intended viewport;
2. capture the title label before starting the case;
3. choose the declared primary action;
4. wait until `window.__EVAVO_ADVENTURE_PLAYTEST__` exists;
5. execute each activation through `activateAndSettle`;
6. compare each semantic checkpoint with `snapshot()`;
7. capture the declared labels only after the checkpoint passes;
8. retain browser console, network, screenshot and viewport evidence with the exact target commit.

The bridge does not itself claim that screenshots were taken. Source tests prove the plan, runtime and replay contract. Visual evidence exists only after a real browser worker executes the plan and retains its artifacts.
