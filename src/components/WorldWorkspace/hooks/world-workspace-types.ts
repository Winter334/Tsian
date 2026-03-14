export type WorldWorkspaceMobilePage = "list" | "editor";

export type WorldRulesEditorScope =
  | "full"
  | "attributes"
  | "derivedStats"
  | "checkRules"
  | "conditions"
  | "dimensions"
  | "talents"
  | "level-system"
  | "inventoryRules"
  | "itemTemplates"
  | "skillTemplates";

export type WorldScopedRulesEditorScope = Exclude<
  WorldRulesEditorScope,
  "full"
>;
