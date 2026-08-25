import type { SaveGame } from "@evavo/adventure-save-game";

export const featureSaveCompanionOptions = (save: SaveGame) => ({
  ...(save.interface.profiledCamera ? { profiledCamera: save.interface.profiledCamera } : {}),
  ...(save.interface.sentence ? { sentence: save.interface.sentence } : {}),
  ...(save.audio ? { audio: save.audio } : {}),
  ...(save.investigation ? { investigation: save.investigation } : {}),
  ...(save.itemCombinations ? { itemCombinations: save.itemCombinations } : {}),
  ...(save.multiProtagonist ? { multiProtagonist: save.multiProtagonist } : {}),
  ...(save.roomScripts ? { roomScripts: save.roomScripts } : {}),
  ...(save.routeTopology ? { routeTopology: save.routeTopology } : {}),
  ...(save.rpg ? { rpg: save.rpg } : {}),
  ...(save.rpgEconomy ? { rpgEconomy: save.rpgEconomy } : {}),
  ...(save.specializedModes ? { specializedModes: save.specializedModes } : {}),
});
