/**
 * The household-unit table lives in `@/lib/units` so the pure rubric can use
 * it (lint rule 2 forbids lib → services). This module is the food-data
 * entry point the tech spec names; everything is re-exported unchanged.
 */
export * from '@/lib/units';
