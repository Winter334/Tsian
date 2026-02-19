/**
 * Game 模块服务导出
 */

export {
  irnrPipelineService,
  type IrnrPipelineResult,
  type IrnrPipelineServiceContract,
  type MultiplayerIrnrInput,
  type SoloIrnrInput,
} from "./irnr-pipeline";

export {
  createDelayedCommitManager,
  type CommitStatus,
  type DelayedCommitManager,
} from "./delayed-commit";

export {
  applyTalentsToEntity,
  buildDefaultEntityFromWorldConfig,
  buildEntityFromCharacterData,
  MapEntityAccessor,
  type EntityData,
} from "./entity-accessor";

export {
  getResultFrame,
  updateResolveStatus,
  writeResultFrameToTurnDoc,
  type GameContext,
} from "./result-frame-accessor";

export { IRNR_PIPELINE_SERVICE_TOKEN } from "./tokens";
