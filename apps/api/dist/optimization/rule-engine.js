import { AutomationRuleDefinitionSchema } from "@ai-ads/shared";
const comparisons = {
    lt: (a, b) => a < b, lte: (a, b) => a <= b, eq: (a, b) => a === b,
    gte: (a, b) => a >= b, gt: (a, b) => a > b,
};
export function validateRule(input) {
    return AutomationRuleDefinitionSchema.parse(input);
}
export function evaluateRule(definition, metrics) {
    const results = definition.conditions.map((condition) => {
        const field = condition.metric === "budget_utilization" ? "budgetUtilization" : condition.metric;
        const observed = metrics[field];
        const matched = observed !== null && comparisons[condition.operator](observed, condition.threshold);
        return { metric: condition.metric, operator: condition.operator, threshold: condition.threshold, observed, matched };
    });
    return { matched: definition.conditionLogic === "all" ? results.every((result) => result.matched) : results.some((result) => result.matched), results };
}
