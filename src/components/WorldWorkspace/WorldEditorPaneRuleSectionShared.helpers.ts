export type NumericFieldEntry = {
  field: string;
  value: number | "";
};

export function buildNumericFieldEntries(
  record?: Record<string, number>,
): NumericFieldEntry[] {
  return Object.entries(record ?? {}).map(([field, value]) => ({
    field,
    value,
  }));
}

export function buildNumericFieldRecord(
  entries: NumericFieldEntry[],
): Record<string, number> | undefined {
  const result: Record<string, number> = {};

  for (const entry of entries) {
    const field = entry.field.trim();
    if (
      !field ||
      typeof entry.value !== "number" ||
      !Number.isFinite(entry.value)
    ) {
      continue;
    }

    result[field] = entry.value;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
