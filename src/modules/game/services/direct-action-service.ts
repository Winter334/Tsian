/**
 * DirectActionService（轻量管线）
 *
 * 处理确定性操作（装备、卸下、使用、丢弃），
 * 跳过 Parser AI / Rules Engine，直接走 CommandBus。
 */

import { commandBus, services } from "@/core";
import { INVENTORY_QUERY_SERVICE_TOKEN } from "@/core/services/tokens";
import {
  InventoryCommands,
  type EquipItemPayload,
  type RemoveItemPayload,
  type UnequipItemPayload,
  type UseItemPayload,
} from "@/domain/commands/inventory";
import type {
  DirectAction,
  DirectActionHandler,
  DirectActionResult,
  DirectActionType,
  ValidationResult,
} from "@/domain/types/direct-action";
import { getRuntimeWorldConfig } from "@/lib/world";

/** 轻量管线服务契约 */
export interface DirectActionServiceContract {
  execute(action: DirectAction): Promise<DirectActionResult>;
}

interface EquipPayloadInput {
  instanceId?: string;
  targetSlot?: string;
  reason?: string;
}

interface UnequipPayloadInput {
  instanceId?: string;
  reason?: string;
}

interface UsePayloadInput {
  instanceId?: string;
  quantity?: number;
  targetId?: string;
  reason?: string;
}

interface DropPayloadInput {
  instanceId?: string;
  quantity?: number;
  reason?: string;
}

function readInventoryItem(actorId: string, instanceId: string) {
  const inventoryQuery = services.getRequired(INVENTORY_QUERY_SERVICE_TOKEN);
  const items = inventoryQuery.getItems(actorId);
  return items.find((item) => item.instanceId === instanceId);
}

function toDirectResult(result: {
  success: boolean;
  error?: string;
}): DirectActionResult {
  if (!result.success) {
    return {
      success: false,
      error: result.error ?? "Direct action execution failed",
    };
  }

  return { success: true };
}

function ensureInstanceId(
  payload: Record<string, unknown>,
): ValidationResult & { instanceId?: string } {
  const instanceId = payload.instanceId;
  if (typeof instanceId !== "string" || instanceId.trim().length === 0) {
    return { valid: false, error: "instanceId is required" };
  }

  return { valid: true, instanceId };
}

const equipItemHandler: DirectActionHandler = {
  validate(action: DirectAction): ValidationResult {
    const parsed = ensureInstanceId(action.payload);
    if (!parsed.valid || !parsed.instanceId) {
      return parsed;
    }

    const item = readInventoryItem(action.actorId, parsed.instanceId);
    if (!item) {
      return { valid: false, error: "Item not found" };
    }

    const payload = action.payload as EquipPayloadInput;
    const targetSlot = payload.targetSlot ?? item.equipSlot;

    if (!targetSlot) {
      return { valid: false, error: "Item has no equip slot" };
    }

    if (item.equipped === true && item.equipSlot === targetSlot) {
      return { valid: true };
    }

    const worldConfig = getRuntimeWorldConfig();
    const slotDefinitions = worldConfig.inventoryRules?.equipSlotDefinitions;

    if (slotDefinitions && slotDefinitions.length > 0) {
      const slotDefinition = slotDefinitions.find(
        (slot) => slot.id === targetSlot,
      );
      if (!slotDefinition) {
        return { valid: false, error: `Invalid equip slot: ${targetSlot}` };
      }

      if (
        slotDefinition.allowedCategories &&
        !slotDefinition.allowedCategories.includes(item.category)
      ) {
        return {
          valid: false,
          error: `${slotDefinition.label} does not allow category: ${item.category}`,
        };
      }
    }

    return { valid: true };
  },

  async execute(action: DirectAction): Promise<DirectActionResult> {
    const payload = action.payload as EquipPayloadInput;

    if (typeof payload.instanceId !== "string") {
      return { success: false, error: "instanceId is required" };
    }

    const currentItem = readInventoryItem(action.actorId, payload.instanceId);
    const currentTargetSlot =
      typeof payload.targetSlot === "string"
        ? payload.targetSlot
        : currentItem?.equipSlot;

    if (
      currentItem?.equipped === true &&
      currentTargetSlot !== undefined &&
      currentItem.equipSlot === currentTargetSlot
    ) {
      return { success: true };
    }

    const commandPayload: EquipItemPayload = {
      characterId: action.actorId,
      instanceId: payload.instanceId,
      targetSlot:
        typeof payload.targetSlot === "string" ? payload.targetSlot : undefined,
      reason: typeof payload.reason === "string" ? payload.reason : undefined,
    };

    const result = await commandBus.dispatch(
      commandBus.createCommand(InventoryCommands.EQUIP_ITEM, commandPayload),
    );

    return toDirectResult(result);
  },
};

const unequipItemHandler: DirectActionHandler = {
  validate(action: DirectAction): ValidationResult {
    const parsed = ensureInstanceId(action.payload);
    if (!parsed.valid || !parsed.instanceId) {
      return parsed;
    }

    const item = readInventoryItem(action.actorId, parsed.instanceId);
    if (!item) {
      return { valid: false, error: "Item not found" };
    }

    if (item.equipped !== true) {
      return { valid: false, error: "Item is not equipped" };
    }

    return { valid: true };
  },

  async execute(action: DirectAction): Promise<DirectActionResult> {
    const payload = action.payload as UnequipPayloadInput;

    if (typeof payload.instanceId !== "string") {
      return { success: false, error: "instanceId is required" };
    }

    const commandPayload: UnequipItemPayload = {
      characterId: action.actorId,
      instanceId: payload.instanceId,
      reason: typeof payload.reason === "string" ? payload.reason : undefined,
    };

    const result = await commandBus.dispatch(
      commandBus.createCommand(InventoryCommands.UNEQUIP_ITEM, commandPayload),
    );

    return toDirectResult(result);
  },
};

const useItemHandler: DirectActionHandler = {
  validate(action: DirectAction): ValidationResult {
    const parsed = ensureInstanceId(action.payload);
    if (!parsed.valid || !parsed.instanceId) {
      return parsed;
    }

    const item = readInventoryItem(action.actorId, parsed.instanceId);
    if (!item) {
      return { valid: false, error: "Item not found" };
    }

    if (item.category !== "consumable") {
      return { valid: false, error: "Only consumable items can be used" };
    }

    const payload = action.payload as UsePayloadInput;
    const quantity = payload.quantity ?? 1;

    if (!Number.isInteger(quantity) || quantity < 1) {
      return { valid: false, error: "Use quantity must be a positive integer" };
    }

    if (quantity > item.quantity) {
      return { valid: false, error: "Insufficient item quantity" };
    }

    return { valid: true };
  },

  async execute(action: DirectAction): Promise<DirectActionResult> {
    const payload = action.payload as UsePayloadInput;

    if (typeof payload.instanceId !== "string") {
      return { success: false, error: "instanceId is required" };
    }

    const quantity = payload.quantity ?? 1;
    const commandPayload: UseItemPayload = {
      characterId: action.actorId,
      instanceId: payload.instanceId,
      quantity,
      targetId:
        typeof payload.targetId === "string" ? payload.targetId : undefined,
      reason: typeof payload.reason === "string" ? payload.reason : undefined,
    };

    const result = await commandBus.dispatch(
      commandBus.createCommand(InventoryCommands.USE_ITEM, commandPayload),
    );

    return toDirectResult(result);
  },
};

const dropItemHandler: DirectActionHandler = {
  validate(action: DirectAction): ValidationResult {
    const parsed = ensureInstanceId(action.payload);
    if (!parsed.valid || !parsed.instanceId) {
      return parsed;
    }

    const item = readInventoryItem(action.actorId, parsed.instanceId);
    if (!item) {
      return { valid: false, error: "Item not found" };
    }

    if (item.equipped === true) {
      return {
        valid: false,
        error: "Equipped item cannot be dropped directly, unequip it first",
      };
    }

    const payload = action.payload as DropPayloadInput;
    const quantity = payload.quantity;

    if (
      quantity !== undefined &&
      (!Number.isInteger(quantity) || quantity < 1)
    ) {
      return {
        valid: false,
        error: "Drop quantity must be a positive integer",
      };
    }

    return { valid: true };
  },

  async execute(action: DirectAction): Promise<DirectActionResult> {
    const payload = action.payload as DropPayloadInput;

    if (typeof payload.instanceId !== "string") {
      return { success: false, error: "instanceId is required" };
    }

    const commandPayload: RemoveItemPayload = {
      characterId: action.actorId,
      instanceId: payload.instanceId,
      quantity:
        typeof payload.quantity === "number" ? payload.quantity : undefined,
      reason: typeof payload.reason === "string" ? payload.reason : undefined,
    };

    const result = await commandBus.dispatch(
      commandBus.createCommand(InventoryCommands.REMOVE_ITEM, commandPayload),
    );

    return toDirectResult(result);
  },
};

/**
 * 创建 DirectActionService 实例
 */
export function createDirectActionService(): DirectActionServiceContract {
  const handlers: Record<DirectActionType, DirectActionHandler> = {
    equip_item: equipItemHandler,
    unequip_item: unequipItemHandler,
    use_item: useItemHandler,
    drop_item: dropItemHandler,
  };

  return {
    async execute(action: DirectAction): Promise<DirectActionResult> {
      const handler = handlers[action.type];
      if (!handler) {
        return {
          success: false,
          error: `Unsupported direct action type: ${action.type}`,
        };
      }

      const validation = handler.validate(action);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error ?? "Direct action validation failed",
        };
      }

      return handler.execute(action);
    },
  };
}

/** 轻量管线服务单例 */
export const directActionService: DirectActionServiceContract =
  createDirectActionService();
