# DJ DOCHI Vinyl Inertia Design

## Goal

Replace the fixed two-turn completion rule with a heavy, inertia-driven LP interaction. Users must create meaningful angular velocity, release the LP, and let friction-driven motion charge mix energy.

## Interaction

- Mouse, trackpad-driven pointer drags, and touch use one Pointer Events path.
- Pointer movement is interpreted around the LP center using angular deltas, not horizontal distance.
- Releasing the pointer preserves the latest angular velocity.
- `requestAnimationFrame` advances angle and applies frame-rate-independent friction.
- Slow movement does not charge energy. Near rest, stored energy decays very slowly.
- Medium throws complete in roughly two or three attempts; strong throws complete in one or two attempts.
- Overdrive never fails. It produces an alarmed Dochi line and a brief room shake.

## Physics Boundary

`src/lib/vinylPhysics.ts` owns all tuning constants and pure calculations:

- `MIN_ENERGY_SPEED`
- `MAX_ENERGY_SPEED`
- `ENERGY_GAIN_RATE`
- `FRICTION`
- `COMPLETION_ENERGY`
- `MAX_ANGULAR_VELOCITY`
- stop, decay, overdrive, and feedback thresholds

The module exposes frame stepping, drag velocity calculation, energy stepping, and speed-band classification. The React component owns browser events and animation-frame scheduling only.

## Runtime State

`VinylInteraction` maintains refs for:

- `currentAngle`
- `angularVelocity`
- `mixEnergy`
- `isDragging`

It publishes throttled energy and intensity values to the room, plus discrete reaction-band changes. Visual rotation remains pointer/physics-driven through the CSS individual `rotate` property.

## Feedback

- LP sketch lines lengthen with speed.
- Dochi groove duration shortens with intensity.
- Workshop lights, equalizer, and speakers scale with intensity.
- A hand-drawn gauge shows qualitative states: `힘이 더 필요해`, `감 잡았어`, `거의 다 됐어`.
- Cassette reels twitch as energy rises.
- The REC lamp blinks near completion.
- Dochi reactions alternate within slow, medium, fast, and overdrive bands.

## Completion Sequence

1. Energy reaches the threshold and input locks while inertia continues.
2. After a short coast, Dochi says `됐다!`.
3. The needle lowers automatically.
4. REC turns on and cassette reels spin.
5. The existing result return and mixtape overlay continue unchanged.

## Testing

- Pure physics tests cover friction, speed-gated charging, idle decay, clamping, and feedback bands.
- Component tests cover pointer-angle velocity, inertia after release, completion delay, needle/REC phases, and pointer type parity.
- Flow tests cover automatic celebration, needle, recording, and result transitions.
- Browser verification covers desktop mouse, trackpad-equivalent pointer input, and a mobile viewport with touch-style pointer events.

## Scope

Upload, playlist confirmation, dummy result data, and external API behavior remain unchanged.
