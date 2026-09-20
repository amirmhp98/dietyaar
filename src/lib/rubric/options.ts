/**
 * Option labels are positional (improvement plan C3, decision 6): every screen
 * says "Option 1 / Option 2 …" from the option's place among its slot's options
 * in plan order. The heading the plan pasted (`PlanOption.label`) is provenance
 * only and is never rendered.
 */

/** A slot's options in plan order, the order the user sees them in. */
export function sortedOptions<O extends { position: number }>(slot: {
  options: readonly O[];
}): O[] {
  return [...slot.options].sort((a, b) => a.position - b.position);
}

/** The 1-based number of an option among its slot's options, or null when it is not in the slot. */
export function optionNumber(
  slot: { options: readonly { id: string; position: number }[] },
  optionId: string | null | undefined,
): number | null {
  if (!optionId) return null;
  const index = sortedOptions(slot).findIndex((option) => option.id === optionId);
  return index === -1 ? null : index + 1;
}
