# Runtime narrative request execution

## Purpose

Adventure actions express narrative work through typed runtime events. A `play-sequence`
action emits `sequence-requested`; a `start-dialogue` action emits
`dialogue-requested`. Those events are not cosmetic notifications. Packaged gameplay must
resolve them into active dialogue or sequence state in deterministic authored order.

`@evavo/adventure-scene-runtime/narrative` provides that shared boundary. It is used by
stateful-object commands, dialogue choices and packaged world advancement so editor previews,
replay execution and shipped players do not invent separate request semantics.

## Ordered request closure

`applyRuntimeNarrativeRequestEvents` preserves the order in which actions emitted requests.
For each request it:

1. resolves the canonical dialogue or sequence by stable ID;
2. starts it through `@evavo/adventure-dialogue` or `@evavo/adventure-sequence`;
3. applies tick-zero node-entry or story-action consequences;
4. appends the resulting runtime events;
5. processes nested dialogue and sequence requests in emitted order.

Missing targets and rejected starts throw `RuntimeNarrativeRequestError`. Invalid compiled
content therefore cannot silently discard a required cinematic or conversation.

Object-command execution already resolves dialogue requests internally. The updated dialogue
boundary now resolves the complete mixed request stream, including sequences, so an action
list such as sequence then dialogue remains sequence then dialogue rather than being regrouped
by request kind.

## Bounded recursion

Narrative requests can be authored recursively through node-entry actions, sequence
story-action cues or completion actions. Runtime closure is bounded to 64 requests by default.
Callers may provide another positive safe-integer limit for controlled validation or replay
execution.

Cross-dialogue recursion, self-requesting sequences and other request cycles fail with a typed
error instead of hanging the browser or consuming unbounded memory. Static validation should
still prevent these cycles before packaging; the runtime limit is a final safety boundary.

## Sequence advancement

`advanceRuntimeNarrativeSequences` advances every active sequence in stable sequence-ID order.
It delegates cue scheduling and completion to `@evavo/adventure-sequence`, then resolves any
new narrative requests emitted by story-action cues or completion actions.

The public `@evavo/adventure-scene-runtime/commands` entry now wraps interactive world
advancement one logical tick at a time. This preserves the timing boundary between:

- sequence cues reached during the tick;
- movement and animation advancement;
- object commands completed at the end of movement;
- narrative requests started by those commands.

A sequence requested by an interaction begins at the command boundary and first advances on
the next logical tick. Large player-frame deltas therefore preserve the same result as a
series of one-tick advances.

## Blocking sequences

When a sequence marked `blocking` is active at the start of a logical tick, actor movement is
held while story time, actor animation and sequence playback continue. Pending object commands
remain queued and resume only if the sequence completes without changing scene.

If a sequence or interaction changes scene, movement routes and pending object commands from
the previous room are cleared. Old-scene navigation cannot leak into the destination room.

The command transition also exposes narrative runtime events alongside animation, movement and
object-command events. Higher-level players may use those events for status text, audio,
cinematic presentation and deterministic trace evidence.

## Dialogue integration

`@evavo/adventure-scene-runtime/dialogue` keeps its existing dialogue-only call compatibility.
Callers that provide the complete runtime bundle additionally receive sequence request closure.
A dialogue choice that requests a cinematic now starts the canonical sequence immediately,
and subsequent world advancement reaches story-action cues and completion state.

## Verification

Focused regressions cover:

- requested sequence startup and tick-zero story actions;
- deterministic sequence completion and scene change;
- authored ordering across mixed sequence and dialogue requests;
- compatibility for dialogue-only callers;
- dialogue-choice-to-sequence execution;
- blocking movement hold and scene-change cleanup;
- bounded recursive dialogue requests;
- missing narrative targets failing visibly.

This contract proves runtime state closure. It does not yet render every cinematic camera,
actor, speech, sound or palette cue. Those cue events remain available for the renderer,
audio and cinematic presentation layers to consume without changing canonical story order.
