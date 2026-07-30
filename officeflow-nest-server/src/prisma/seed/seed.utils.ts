export function shiftHours(value: Date, hours: number) {
  return new Date(value.getTime() + hours * 60 * 60 * 1000);
}

export function shiftDays(value: Date, days: number) {
  return shiftHours(value, days * 24);
}

export function createRecordMap<T extends { id: number }>(
  entries: Array<[string, T]>,
) {
  return Object.fromEntries(entries) as Record<string, T>;
}
