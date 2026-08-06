# Distance-locked movement animation

## Purpose

Profile-driven actor movement already advances on deterministic logical ticks and
measures route progress in fixed native-pixel units. The visible walk cycle must
follow that same travelled distance. Advancing walk frames only by elapsed time
would allow acceleration, corner braking and low-speed arrival to produce sliding
feet even though canonical movement itself is deterministic.

The scene runtime now synchronizes an active profiled mover's playback after each
logical tick.

## Frame selection

The selected play-feel profile provides `pixelsPerWalkCycle`. The actor's current
walk clip provides authored frame durations. The runtime converts travelled
fixed-unit distance into an absolute animation-cycle position:

```text
absolute animation tick =
  travelled micropixels * authored cycle ticks / cycle micropixels
```

The calculation uses integer arithmetic before converting back to a safe JavaScript
number. Authored frame durations remain meaningful as relative pose holds, while
monitor refresh rate and browser frame pacing cannot alter the selected frame.

## Runtime rules

Distance locking applies only while all of the following are true:

- the movement has a valid profiled movement state;
- the actor is still using the movement's walk animation state;
- the current animation clip is a looping clip;
- the actor has not completed or cancelled movement.

Traversal animations, arrival performances, idle loops and all legacy movement
continue through the established tick-driven animation path.

Tick-driven animation events for an actively distance-locked walk are suppressed.
Canonical left and right footfalls already come from the profiled movement solver,
so audio and gameplay feedback should consume movement footfall events rather than
frame-duration-dependent walk markers.

## Save and replay behavior

The synchronized playback state is part of the normal actor runtime state. New
save games therefore retain the exact visible walk frame alongside the profiled
movement distance. Restoring and replaying the same save recomputes the same frame
on the next logical tick without depending on display refresh cadence.

Legacy saves contain no profiled movement field and preserve their original
animation behavior.
