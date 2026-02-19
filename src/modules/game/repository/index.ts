/**
 * Game Repository 聚合导出
 *
 * @module game/repository
 */

export {
  characterToEntityData,
  characterToYMap,
  entityFieldsToAttributes,
  yMapToCharacter,
} from "./entity-codec";

export {
  createGameStateRepository,
  type CreatedNpcData,
  type EntityFinalState,
  type GameStateRepository,
} from "./game-state-repository";
