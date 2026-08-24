export type AdventureRpgCombatPhase = "active" | "victory" | "defeat" | "fled";
export type AdventureRpgCombatAction = "attack" | "guard" | "dodge" | "flee";

export interface AdventureRpgCombatantProfile {
  readonly maximumHealth: number;
  readonly maximumStamina: number;
  readonly attackPower: number;
  readonly defensePower: number;
  readonly agility: number;
}

export interface AdventureRpgEnemyProfile extends AdventureRpgCombatantProfile {
  readonly attackIntervalTicks: number;
  readonly telegraphTicks: number;
  readonly recoveryTicks: number;
}

export interface AdventureRpgCombatDefinition {
  readonly id: string;
  readonly player: AdventureRpgCombatantProfile;
  readonly enemy: AdventureRpgEnemyProfile;
  readonly attackStaminaCost: number;
  readonly dodgeStaminaCost: number;
  readonly guardStaminaCost: number;
  readonly staminaRecoveryPerTick: number;
  readonly fleeDifficulty: number;
}

export interface AdventureRpgCombatState {
  readonly definitionId: string;
  readonly tick: number;
  readonly phase: AdventureRpgCombatPhase;
  readonly playerHealth: number;
  readonly playerStamina: number;
  readonly enemyHealth: number;
  readonly enemyStamina: number;
  readonly playerRecoveryUntilTick: number;
  readonly guardingUntilTick: number;
  readonly dodgingUntilTick: number;
  readonly enemyNextAttackTick: number;
  readonly enemyTelegraphStartedTick: number | null;
  readonly enemyRecoveryUntilTick: number;
}

export type AdventureRpgCombatEvent =
  | { readonly kind: "player-attacked"; readonly damage: number }
  | { readonly kind: "player-guarded" }
  | { readonly kind: "player-dodged" }
  | { readonly kind: "player-fled" }
  | { readonly kind: "flee-failed" }
  | { readonly kind: "enemy-telegraph" }
  | { readonly kind: "enemy-attacked"; readonly damage: number; readonly guarded: boolean; readonly dodged: boolean }
  | { readonly kind: "victory" }
  | { readonly kind: "defeat" };

export interface AdventureRpgCombatTransition {
  readonly state: AdventureRpgCombatState;
  readonly events: readonly AdventureRpgCombatEvent[];
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

const assertProfile = (profile: AdventureRpgCombatantProfile, label: string): void => {
  for (const [key, value] of Object.entries(profile)) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} ${key} must be a non-negative finite number.`);
  }
  if (profile.maximumHealth <= 0 || profile.maximumStamina <= 0) {
    throw new RangeError(`${label} maximum health/stamina must be positive.`);
  }
};

export const validateAdventureRpgCombatDefinition = (
  definition: AdventureRpgCombatDefinition,
): readonly string[] => {
  const issues: string[] = [];
  try {
    assertProfile(definition.player, "Player");
    assertProfile(definition.enemy, "Enemy");
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  for (const [key, value] of Object.entries({
    attackStaminaCost: definition.attackStaminaCost,
    dodgeStaminaCost: definition.dodgeStaminaCost,
    guardStaminaCost: definition.guardStaminaCost,
    staminaRecoveryPerTick: definition.staminaRecoveryPerTick,
    fleeDifficulty: definition.fleeDifficulty,
  })) {
    if (!Number.isFinite(value) || value < 0) issues.push(`${key} must be a non-negative finite number.`);
  }
  if (!Number.isSafeInteger(definition.enemy.attackIntervalTicks) || definition.enemy.attackIntervalTicks <= 0) {
    issues.push("Enemy attackIntervalTicks must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(definition.enemy.telegraphTicks) || definition.enemy.telegraphTicks < 0) {
    issues.push("Enemy telegraphTicks must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(definition.enemy.recoveryTicks) || definition.enemy.recoveryTicks < 0) {
    issues.push("Enemy recoveryTicks must be a non-negative safe integer.");
  }
  return issues.sort((a, b) => a.localeCompare(b));
};

export const createAdventureRpgCombatState = (
  definition: AdventureRpgCombatDefinition,
): AdventureRpgCombatState => {
  const issues = validateAdventureRpgCombatDefinition(definition);
  if (issues.length > 0) throw new Error(issues.join("\n"));
  return {
    definitionId: definition.id,
    tick: 0,
    phase: "active",
    playerHealth: definition.player.maximumHealth,
    playerStamina: definition.player.maximumStamina,
    enemyHealth: definition.enemy.maximumHealth,
    enemyStamina: definition.enemy.maximumStamina,
    playerRecoveryUntilTick: 0,
    guardingUntilTick: 0,
    dodgingUntilTick: 0,
    enemyNextAttackTick: definition.enemy.attackIntervalTicks,
    enemyTelegraphStartedTick: null,
    enemyRecoveryUntilTick: 0,
  };
};

const playerBusy = (state: AdventureRpgCombatState): boolean =>
  state.tick < state.playerRecoveryUntilTick;

const playerDamage = (definition: AdventureRpgCombatDefinition): number =>
  Math.max(1, Math.round(definition.player.attackPower - definition.enemy.defensePower * 0.45));

const enemyDamage = (definition: AdventureRpgCombatDefinition, guarded: boolean): number => {
  const raw = Math.max(1, Math.round(definition.enemy.attackPower - definition.player.defensePower * 0.35));
  return guarded ? Math.max(1, Math.floor(raw * 0.35)) : raw;
};

export const issueAdventureRpgCombatAction = (
  definition: AdventureRpgCombatDefinition,
  state: AdventureRpgCombatState,
  action: AdventureRpgCombatAction,
): AdventureRpgCombatTransition => {
  if (state.phase !== "active" || playerBusy(state)) return { state, events: [] };
  let next = state;
  const events: AdventureRpgCombatEvent[] = [];
  if (action === "attack") {
    if (state.playerStamina < definition.attackStaminaCost) return { state, events: [] };
    const damage = playerDamage(definition);
    const enemyHealth = Math.max(0, state.enemyHealth - damage);
    next = {
      ...state,
      playerStamina: state.playerStamina - definition.attackStaminaCost,
      enemyHealth,
      playerRecoveryUntilTick: state.tick + 6,
      phase: enemyHealth === 0 ? "victory" : "active",
    };
    events.push({ kind: "player-attacked", damage });
    if (enemyHealth === 0) events.push({ kind: "victory" });
    return { state: next, events };
  }
  if (action === "guard") {
    if (state.playerStamina < definition.guardStaminaCost) return { state, events: [] };
    next = {
      ...state,
      playerStamina: state.playerStamina - definition.guardStaminaCost,
      guardingUntilTick: state.tick + 8,
      playerRecoveryUntilTick: state.tick + 3,
    };
    events.push({ kind: "player-guarded" });
    return { state: next, events };
  }
  if (action === "dodge") {
    if (state.playerStamina < definition.dodgeStaminaCost) return { state, events: [] };
    next = {
      ...state,
      playerStamina: state.playerStamina - definition.dodgeStaminaCost,
      dodgingUntilTick: state.tick + 5,
      playerRecoveryUntilTick: state.tick + 5,
    };
    events.push({ kind: "player-dodged" });
    return { state: next, events };
  }
  const fleeScore = definition.player.agility + state.playerStamina * 0.25;
  if (fleeScore >= definition.fleeDifficulty) {
    next = { ...state, phase: "fled" };
    events.push({ kind: "player-fled" });
  } else {
    next = { ...state, playerRecoveryUntilTick: state.tick + 5 };
    events.push({ kind: "flee-failed" });
  }
  return { state: next, events };
};

const advanceOneCombatTick = (
  definition: AdventureRpgCombatDefinition,
  state: AdventureRpgCombatState,
): AdventureRpgCombatTransition => {
  if (state.phase !== "active") return { state, events: [] };
  const tick = state.tick + 1;
  let next: AdventureRpgCombatState = {
    ...state,
    tick,
    playerStamina: clamp(
      state.playerStamina + definition.staminaRecoveryPerTick,
      0,
      definition.player.maximumStamina,
    ),
  };
  const events: AdventureRpgCombatEvent[] = [];
  const telegraphTick = next.enemyNextAttackTick - definition.enemy.telegraphTicks;
  if (definition.enemy.telegraphTicks > 0 && tick === telegraphTick) {
    next = { ...next, enemyTelegraphStartedTick: tick };
    events.push({ kind: "enemy-telegraph" });
  }
  if (tick < next.enemyNextAttackTick || tick < next.enemyRecoveryUntilTick) {
    return { state: next, events };
  }
  const dodged = tick <= next.dodgingUntilTick;
  const guarded = !dodged && tick <= next.guardingUntilTick;
  const damage = dodged ? 0 : enemyDamage(definition, guarded);
  const playerHealth = Math.max(0, next.playerHealth - damage);
  next = {
    ...next,
    playerHealth,
    enemyNextAttackTick: tick + definition.enemy.attackIntervalTicks,
    enemyTelegraphStartedTick: null,
    enemyRecoveryUntilTick: tick + definition.enemy.recoveryTicks,
    phase: playerHealth === 0 ? "defeat" : "active",
  };
  events.push({ kind: "enemy-attacked", damage, guarded, dodged });
  if (playerHealth === 0) events.push({ kind: "defeat" });
  return { state: next, events };
};

export const advanceAdventureRpgCombat = (
  definition: AdventureRpgCombatDefinition,
  state: AdventureRpgCombatState,
  ticks: number,
): AdventureRpgCombatTransition => {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError("Combat advancement requires a non-negative safe integer tick count.");
  }
  let next = state;
  const events: AdventureRpgCombatEvent[] = [];
  for (let index = 0; index < ticks && next.phase === "active"; index += 1) {
    const transition = advanceOneCombatTick(definition, next);
    next = transition.state;
    events.push(...transition.events);
  }
  return { state: next, events };
};
