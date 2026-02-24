/**
 * 跨模块服务 Token
 *
 * 用于模块间通过 ServiceRegistry 解耦调用。
 */

import type {
  DirectAction,
  DirectActionResult,
  IrnrPipelineServiceContract,
} from "@/domain/types";
import { createServiceToken } from "./index";

export type { IrnrPipelineServiceContract };

/**
 * Direct Action 轻量管线服务契约
 */
export interface DirectActionServiceContract {
  execute(action: DirectAction): Promise<DirectActionResult>;
}

/**
 * Game 模块注册的 IRNR Pipeline Service token
 */
export const IRNR_PIPELINE_SERVICE_TOKEN =
  createServiceToken<IrnrPipelineServiceContract>(
    "lyra.game.irnr-pipeline-service",
  );

/**
 * Game 模块注册的 Direct Action Service token
 */
export const DIRECT_ACTION_SERVICE_TOKEN =
  createServiceToken<DirectActionServiceContract>(
    "lyra.game.direct-action-service",
  );
