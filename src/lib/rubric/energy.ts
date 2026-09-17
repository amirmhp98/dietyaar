import { ENERGY_NOTICEABLE, ENERGY_SMALL } from '@/lib/rubric/constants';
import type { EnergyResult, RubricTarget } from '@/lib/rubric/types';
import type { Band } from '@/lib/time/bands';

/**
 * Energy against a range, minimum, maximum, desired or approximate figure
 * (product spec § 8 thresholds). Inside the range, or an approximate figure
 * within 10 %, is SMALL; beyond the nearer boundary by up to 10 % is
 * NOTICEABLE; beyond that LARGE. Boundaries are inclusive.
 */
export function energyResult(value: number, target: RubricTarget): EnergyResult {
  const { type, low, high } = target;
  let lower: number | null = null;
  let upper: number | null = null;
  let tolerance = 0;

  switch (type) {
    case 'RANGE':
      lower = low;
      upper = high;
      break;
    case 'MINIMUM':
      lower = low;
      break;
    case 'MAXIMUM':
      upper = high ?? low;
      break;
    case 'DESIRED':
    case 'APPROXIMATE':
      lower = low;
      upper = low;
      // An approximate figure within 10 % counts as inside.
      tolerance = (low ?? 0) * ENERGY_SMALL;
      break;
  }

  let status: EnergyResult['status'] = 'WITHIN';
  let difference = 0;
  let boundary = 0;
  if (lower !== null && value < lower - tolerance) {
    status = 'BELOW';
    difference = value - lower;
    boundary = lower;
  } else if (upper !== null && value > upper + tolerance) {
    status = 'ABOVE';
    difference = value - upper;
    boundary = upper;
  }

  let band: Band = 'SMALL';
  if (status !== 'WITHIN') {
    const rel = boundary > 0 ? Math.abs(difference) / boundary : 1;
    if (tolerance > 0) {
      // Approximate: 10–20 % noticeable, beyond that large.
      band = rel <= ENERGY_NOTICEABLE + 1e-9 ? 'NOTICEABLE' : 'LARGE';
    } else {
      band = rel <= ENERGY_SMALL + 1e-9 ? 'NOTICEABLE' : 'LARGE';
    }
  }

  return { status, band, difference: Math.round(difference), target };
}
