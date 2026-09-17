import type { PlanBaselineOutput, PlanImportOutput } from '@/services/ai/schemas';
import type { AiResult, EstimateBaselineInput, InterpretPlanInput } from '@/services/ai/types';

/**
 * STUB — replaced by the AI agent (implementation plan task 5.2). Signatures
 * are the contract other modules compile against.
 */
export async function interpretPlan(
  _input: InterpretPlanInput,
): Promise<AiResult<PlanImportOutput>> {
  return {
    ok: false,
    reason: 'UNAVAILABLE',
    attempts: [],
    usage: { promptTokens: 0, completionTokens: 0 },
    durationMs: 0,
  };
}

export async function estimatePlanBaseline(
  _input: EstimateBaselineInput,
): Promise<AiResult<PlanBaselineOutput>> {
  return {
    ok: false,
    reason: 'UNAVAILABLE',
    attempts: [],
    usage: { promptTokens: 0, completionTokens: 0 },
    durationMs: 0,
  };
}
