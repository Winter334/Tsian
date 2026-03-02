import type { ItemSnapshot, SkillSnapshot } from "@/domain/entities/checkpoint";
import {
  toUnknownCodec,
  type FieldCodec,
  type SnapshotFieldConfig,
} from "@/modules/checkpoint/snapshot-api";

import {
  itemInstanceToYMap,
  skillInstanceToYMap,
  yMapToItemInstance,
  yMapToSkillInstance,
} from "./repository/inventory-codec";

const inventoryCodec: FieldCodec<ItemSnapshot> = {
  decode: yMapToItemInstance,
  encode: itemInstanceToYMap,
};

const skillCodec: FieldCodec<SkillSnapshot> = {
  decode: yMapToSkillInstance,
  encode: skillInstanceToYMap,
};

export const inventorySnapshotFields: SnapshotFieldConfig[] = [
  {
    key: "inventories",
    strategy: "mapOfArrayOfYMap",
    codec: toUnknownCodec(inventoryCodec, asItemSnapshot),
  },
  {
    key: "skills",
    strategy: "mapOfArrayOfYMap",
    codec: toUnknownCodec(skillCodec, asSkillSnapshot),
  },
];

function asItemSnapshot(value: unknown): ItemSnapshot {
  return value as ItemSnapshot;
}

function asSkillSnapshot(value: unknown): SkillSnapshot {
  return value as SkillSnapshot;
}
