import type { Character } from "@/domain/entities/character";
import type { CharacterSnapshot } from "@/domain/entities/checkpoint";
import {
  toUnknownCodec,
  type FieldCodec,
  type SnapshotFieldConfig,
} from "@/modules/checkpoint/snapshot-api";

import {
  characterToYMap,
  isCharacterStatus,
  isControlType,
  yMapToCharacter,
} from "./repository/entity-codec";

const characterCodec: FieldCodec<CharacterSnapshot> = {
  decode: (map) => toCharacterSnapshot(yMapToCharacter(map)),
  encode: (snapshot) => characterToYMap(snapshotToCharacter(snapshot)),
};

export const gameSnapshotFields: SnapshotFieldConfig[] = [
  {
    key: "characters",
    strategy: "nestedYMap",
    codec: toUnknownCodec(characterCodec, asCharacterSnapshot),
  },
  {
    key: "gameState",
    strategy: "plainValue",
  },
];

function asCharacterSnapshot(value: unknown): CharacterSnapshot {
  return value as CharacterSnapshot;
}

function toCharacterSnapshot(character: Character): CharacterSnapshot {
  const snapshot: CharacterSnapshot = {
    id: character.id,
    name: character.name,
    creatorUniqueTag: character.creatorUniqueTag,
    operatorUserId: character.operatorUserId,
    operatorUniqueTag: character.operatorUniqueTag,
    status: character.status,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    controlType: character.controlType,
  };

  if (typeof character.description === "string") {
    snapshot.description = character.description;
  }
  if (typeof character.personality === "string") {
    snapshot.personality = character.personality;
  }
  if (typeof character.appearance === "string") {
    snapshot.appearance = character.appearance;
  }
  if (isRecord(character.attributes)) {
    snapshot.attributes = character.attributes;
  }
  if (isRecord(character.tags)) {
    snapshot.tags = character.tags;
  }
  if (isRecord(character.dimensionSelections)) {
    snapshot.dimensionSelections = character.dimensionSelections as Record<
      string,
      string
    >;
  }
  if (Array.isArray(character.talentIds)) {
    snapshot.talentIds = character.talentIds.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }

  return snapshot;
}

function snapshotToCharacter(snapshot: CharacterSnapshot): Character {
  const now = Date.now();

  const character: Character = {
    id: typeof snapshot.id === "string" ? snapshot.id : crypto.randomUUID(),
    name: typeof snapshot.name === "string" ? snapshot.name : "未命名",
    controlType: isControlType(snapshot.controlType)
      ? snapshot.controlType
      : "player",
    creatorUniqueTag:
      typeof snapshot.creatorUniqueTag === "string"
        ? snapshot.creatorUniqueTag
        : "",
    operatorUserId:
      typeof snapshot.operatorUserId === "string"
        ? snapshot.operatorUserId
        : "",
    operatorUniqueTag:
      typeof snapshot.operatorUniqueTag === "string"
        ? snapshot.operatorUniqueTag
        : "",
    status: isCharacterStatus(snapshot.status) ? snapshot.status : "active",
    createdAt:
      typeof snapshot.createdAt === "number" ? snapshot.createdAt : now,
    updatedAt:
      typeof snapshot.updatedAt === "number" ? snapshot.updatedAt : now,
  };

  if (typeof snapshot.description === "string") {
    character.description = snapshot.description;
  }
  if (typeof snapshot.personality === "string") {
    character.personality = snapshot.personality;
  }
  if (typeof snapshot.appearance === "string") {
    character.appearance = snapshot.appearance;
  }
  if (isRecord(snapshot.attributes)) {
    character.attributes = snapshot.attributes;
  }
  if (isRecord(snapshot.tags)) {
    character.tags = snapshot.tags;
  }
  if (isRecord(snapshot.dimensionSelections)) {
    character.dimensionSelections = snapshot.dimensionSelections as Record<
      string,
      string
    >;
  }
  if (Array.isArray(snapshot.talentIds)) {
    character.talentIds = snapshot.talentIds.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }

  return character;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
