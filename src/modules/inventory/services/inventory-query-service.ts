import type { InventoryQueryServiceContract } from "@/core/services/tokens";
import { useInventoryStore } from "../store";

export function createInventoryQueryService(): InventoryQueryServiceContract {
  return {
    getItems(characterId) {
      return useInventoryStore.getState().items[characterId] ?? [];
    },
    getSkills(characterId) {
      return useInventoryStore.getState().skills[characterId] ?? [];
    },
    getEquippedItems(characterId) {
      const items = useInventoryStore.getState().items[characterId] ?? [];
      return items.filter((item) => item.equipped);
    },
  };
}
