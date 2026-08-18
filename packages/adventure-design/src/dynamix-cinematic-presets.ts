import type { DynamixCinematicContract } from "./dynamix-cinematic-types.js";
import { deadChannelDynamixContract } from "./dynamix-cinematic-dead-channel.js";
import { jadeHorizonDynamixContract } from "./dynamix-cinematic-jade-horizon.js";

export { deadChannelDynamixContract, jadeHorizonDynamixContract };

export const dynamixCinematicContracts: readonly DynamixCinematicContract[] = [
  jadeHorizonDynamixContract,
  deadChannelDynamixContract,
];

export const dynamixCinematicContractById = (
  id: DynamixCinematicContract["id"],
): DynamixCinematicContract => {
  const contract = dynamixCinematicContracts.find((candidate) => candidate.id === id);
  if (!contract) throw new Error(`Dynamix cinematic contract '${id}' is missing.`);
  return contract;
};
