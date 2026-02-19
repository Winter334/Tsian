/**
 * 跨模块服务 Token
 *
 * 用于模块间通过 ServiceRegistry 解耦调用。
 */

import type { IrnrPipelineServiceContract } from "@/domain/types";
import { createServiceToken } from "./index";

export type { IrnrPipelineServiceContract };

/**
 * Game 模块注册的 IRNR Pipeline Service token
 */
export const IRNR_PIPELINE_SERVICE_TOKEN =
  createServiceToken<IrnrPipelineServiceContract>(
    "lyra.game.irnr-pipeline-service"
  );
