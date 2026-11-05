import { AutomationRuleDefinitionSchema, type AutomationRuleDefinition, type OptimizationMetric } from "@ai-ads/shared";

export type RuleEvaluation = { matched: boolean; results: Array<{ metric: string; operator: string; threshold: number; observed: number | null; matched: boolean }> };
const comparisons: Record<string, (actual: number, expected: number) => boolean> = {
  lt: (a, b) => a < b, lte: (a, b) => a <= b, eq: (a, b) => a === b,
  gte: (a, b) => a >= b, gt: (a, b) => a > b,
};

export function validateRule(input: unknown): AutomationRuleDefinition {
  return AutomationRuleDefinitionSchema.parse(input);
}

export function evaluateRule(definition: AutomationRuleDefinition, metrics: OptimizationMetric): RuleEvaluation {
  const results = definition.conditions.map((condition) => {
    const field = condition.metric === "budget_utilization" ? "budgetUtilization" : condition.metric;
    const observed = metrics[field] as number | null;
    const matched = observed !== null && comparisons[condition.operator]!(observed, condition.threshold);
    return { metric: condition.metric, operator: condition.operator, threshold: condition.threshold, observed, matched };
  });
  return { matched: definition.conditionLogic === "all" ? results.every((result) => result.matched) : results.some((result) => result.matched), results };
}
