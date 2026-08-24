import {
  adjustAdventureRpgResource,
  practiceAdventureRpgSkill,
  type AdventureRpgManifest,
  type AdventureRpgState,
} from "./rpg.js";
import {
  advanceAdventureRpgCombat,
  createAdventureRpgCombatState,
  issueAdventureRpgCombatAction,
  type AdventureRpgCombatAction,
  type AdventureRpgCombatDefinition,
  type AdventureRpgCombatEvent,
  type AdventureRpgCombatState,
  type AdventureRpgCombatTransition,
  type AdventureRpgEnemyProfile,
} from "./rpg-combat.js";

export interface AdventureRpgCombatBinding {
  readonly id: string;
  readonly healthResourceId: string;
  readonly staminaResourceId: string;
  readonly attackSkillId: string;
  readonly defenseSkillId: string;
  readonly dodgeSkillId?: string;
  readonly agilityStatId: string;
  readonly attackBase?: number;
  readonly defenseBase?: number;
  readonly agilityBase?: number;
  readonly skillWeight?: number;
  readonly governingStatWeight?: number;
  readonly dodgeSkillWeight?: number;
  readonly enemy: AdventureRpgEnemyProfile;
  readonly attackStaminaCost: number;
  readonly dodgeStaminaCost: number;
  readonly guardStaminaCost: number;
  readonly staminaRecoveryPerTick: number;
  readonly fleeDifficulty: number;
  readonly attackPractice?: number;
  readonly defensePractice?: number;
  readonly dodgePractice?: number;
}

export interface AdventureRpgBoundCombatState {
  readonly rpg: AdventureRpgState;
  readonly combat: AdventureRpgCombatState;
}

export interface AdventureRpgBoundCombatTransition extends AdventureRpgBoundCombatState {
  readonly events: readonly AdventureRpgCombatEvent[];
}

const definitionForSkill = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  skillId: string,
): { readonly skill: number; readonly stat: number } => {
  const definition = manifest.skills.find((candidate) => candidate.id === skillId);
  if (!definition) throw new Error(`Combat binding references missing RPG skill '${skillId}'.`);
  return {
    skill: state.skills[skillId] ?? definition.startingValue,
    stat: state.stats[definition.governingStatId] ?? 0,
  };
};

const resourceDefinition = (
  manifest: AdventureRpgManifest,
  resourceId: string,
) => {
  const definition = manifest.resources.find((candidate) => candidate.id === resourceId);
  if (!definition) throw new Error(`Combat binding references missing RPG resource '${resourceId}'.`);
  return definition;
};

export const validateAdventureRpgCombatBinding = (
  manifest: AdventureRpgManifest,
  binding: AdventureRpgCombatBinding,
): readonly string[] => {
  const issues: string[] = [];
  const resourceIds = new Set(manifest.resources.map((resource) => resource.id));
  const skillIds = new Set(manifest.skills.map((skill) => skill.id));
  const statIds = new Set(manifest.stats.map((stat) => stat.id));
  if (!resourceIds.has(binding.healthResourceId)) {
    issues.push(`Combat binding '${binding.id}' references missing health resource '${binding.healthResourceId}'.`);
  }
  if (!resourceIds.has(binding.staminaResourceId)) {
    issues.push(`Combat binding '${binding.id}' references missing stamina resource '${binding.staminaResourceId}'.`);
  }
  if (!skillIds.has(binding.attackSkillId)) {
    issues.push(`Combat binding '${binding.id}' references missing attack skill '${binding.attackSkillId}'.`);
  }
  if (!skillIds.has(binding.defenseSkillId)) {
    issues.push(`Combat binding '${binding.id}' references missing defense skill '${binding.defenseSkillId}'.`);
  }
  if (binding.dodgeSkillId && !skillIds.has(binding.dodgeSkillId)) {
    issues.push(`Combat binding '${binding.id}' references missing dodge skill '${binding.dodgeSkillId}'.`);
  }
  if (!statIds.has(binding.agilityStatId)) {
    issues.push(`Combat binding '${binding.id}' references missing agility stat '${binding.agilityStatId}'.`);
  }
  for (const [label, value] of [
    ["skillWeight", binding.skillWeight ?? 0.7],
    ["governingStatWeight", binding.governingStatWeight ?? 0.3],
    ["dodgeSkillWeight", binding.dodgeSkillWeight ?? 0.5],
    ["attackPractice", binding.attackPractice ?? 1],
    ["defensePractice", binding.defensePractice ?? 1],
    ["dodgePractice", binding.dodgePractice ?? 1],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) issues.push(`Combat binding '${binding.id}' ${label} must be non-negative.`);
  }
  return issues.sort((left, right) => left.localeCompare(right));
};

export const deriveAdventureRpgCombatDefinition = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  binding: AdventureRpgCombatBinding,
): AdventureRpgCombatDefinition => {
  const issues = validateAdventureRpgCombatBinding(manifest, binding);
  if (issues.length > 0) throw new Error(issues.join("\n"));
  const attack = definitionForSkill(manifest, state, binding.attackSkillId);
  const defense = definitionForSkill(manifest, state, binding.defenseSkillId);
  const dodgeSkill = binding.dodgeSkillId ? definitionForSkill(manifest, state, binding.dodgeSkillId).skill : 0;
  const skillWeight = binding.skillWeight ?? 0.7;
  const statWeight = binding.governingStatWeight ?? 0.3;
  const health = resourceDefinition(manifest, binding.healthResourceId);
  const stamina = resourceDefinition(manifest, binding.staminaResourceId);
  return {
    id: binding.id,
    player: {
      maximumHealth: health.maximum,
      maximumStamina: stamina.maximum,
      attackPower: (binding.attackBase ?? 0) + attack.skill * skillWeight + attack.stat * statWeight,
      defensePower: (binding.defenseBase ?? 0) + defense.skill * skillWeight + defense.stat * statWeight,
      agility:
        (binding.agilityBase ?? 0) +
        (state.stats[binding.agilityStatId] ?? 0) +
        dodgeSkill * (binding.dodgeSkillWeight ?? 0.5),
    },
    enemy: binding.enemy,
    attackStaminaCost: binding.attackStaminaCost,
    dodgeStaminaCost: binding.dodgeStaminaCost,
    guardStaminaCost: binding.guardStaminaCost,
    staminaRecoveryPerTick: binding.staminaRecoveryPerTick,
    fleeDifficulty: binding.fleeDifficulty,
  };
};

const replaceResource = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  resourceId: string,
  value: number,
): AdventureRpgState => {
  const current = state.resources[resourceId] ?? 0;
  return adjustAdventureRpgResource(manifest, state, resourceId, value - current);
};

const syncCombatResources = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  combat: AdventureRpgCombatState,
  binding: AdventureRpgCombatBinding,
): AdventureRpgState =>
  replaceResource(
    manifest,
    replaceResource(manifest, state, binding.healthResourceId, combat.playerHealth),
    binding.staminaResourceId,
    combat.playerStamina,
  );

const applyCombatPractice = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgState,
  events: readonly AdventureRpgCombatEvent[],
  binding: AdventureRpgCombatBinding,
): AdventureRpgState => {
  let next = state;
  for (const event of events) {
    if (event.kind === "player-attacked") {
      next = practiceAdventureRpgSkill(
        manifest,
        next,
        binding.attackSkillId,
        binding.attackPractice ?? 1,
      ).state;
    } else if (event.kind === "player-guarded" || (event.kind === "enemy-attacked" && event.guarded)) {
      next = practiceAdventureRpgSkill(
        manifest,
        next,
        binding.defenseSkillId,
        binding.defensePractice ?? 1,
      ).state;
    } else if (
      binding.dodgeSkillId &&
      (event.kind === "player-dodged" || (event.kind === "enemy-attacked" && event.dodged))
    ) {
      next = practiceAdventureRpgSkill(
        manifest,
        next,
        binding.dodgeSkillId,
        binding.dodgePractice ?? 1,
      ).state;
    }
  }
  return next;
};

const bindTransition = (
  manifest: AdventureRpgManifest,
  rpg: AdventureRpgState,
  transition: AdventureRpgCombatTransition,
  binding: AdventureRpgCombatBinding,
): AdventureRpgBoundCombatTransition => {
  const synchronized = syncCombatResources(manifest, rpg, transition.state, binding);
  return {
    combat: transition.state,
    rpg: applyCombatPractice(manifest, synchronized, transition.events, binding),
    events: transition.events,
  };
};

export const createAdventureRpgBoundCombatState = (
  manifest: AdventureRpgManifest,
  rpg: AdventureRpgState,
  binding: AdventureRpgCombatBinding,
): AdventureRpgBoundCombatState => {
  const definition = deriveAdventureRpgCombatDefinition(manifest, rpg, binding);
  const initial = createAdventureRpgCombatState(definition);
  const health = rpg.resources[binding.healthResourceId] ?? initial.playerHealth;
  const stamina = rpg.resources[binding.staminaResourceId] ?? initial.playerStamina;
  return {
    rpg,
    combat: {
      ...initial,
      playerHealth: health,
      playerStamina: stamina,
      phase: health <= 0 ? "defeat" : initial.phase,
    },
  };
};

export const issueAdventureRpgBoundCombatAction = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgBoundCombatState,
  binding: AdventureRpgCombatBinding,
  action: AdventureRpgCombatAction,
): AdventureRpgBoundCombatTransition => {
  const definition = deriveAdventureRpgCombatDefinition(manifest, state.rpg, binding);
  return bindTransition(
    manifest,
    state.rpg,
    issueAdventureRpgCombatAction(definition, state.combat, action),
    binding,
  );
};

export const advanceAdventureRpgBoundCombat = (
  manifest: AdventureRpgManifest,
  state: AdventureRpgBoundCombatState,
  binding: AdventureRpgCombatBinding,
  ticks: number,
): AdventureRpgBoundCombatTransition => {
  const definition = deriveAdventureRpgCombatDefinition(manifest, state.rpg, binding);
  return bindTransition(
    manifest,
    state.rpg,
    advanceAdventureRpgCombat(definition, state.combat, ticks),
    binding,
  );
};
