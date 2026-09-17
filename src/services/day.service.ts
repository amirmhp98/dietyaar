/**
 * STUB — replaced by the meal agent (task 6.2, write half of the day module):
 * lazy DayRecord creation, skipped slots, completeness.
 */
export async function ensureDayRecord(
  _ownerId: string,
  _localDate: string,
  _zone: string,
): Promise<{ id: string }> {
  throw new Error('not implemented');
}

export async function markSlotSkipped(
  _ownerId: string,
  _localDate: string,
  _planSlotId: string,
  _skipped: boolean,
): Promise<void> {
  throw new Error('not implemented');
}

export async function setDayCompleteness(
  _ownerId: string,
  _localDate: string,
  _complete: boolean,
): Promise<void> {
  throw new Error('not implemented');
}
