import { INDUSTRIES, type IndustryKey, type Workspace } from "@ai-ads/shared";

export function getIndustryName(industryKey: IndustryKey, customLabel: string | null = null): string {
  if (industryKey === "other" && customLabel) return customLabel;
  return INDUSTRIES.find((industry) => industry.key === industryKey)?.name ?? "Business";
}

export function getWorkspaceIndustryName(workspace: Workspace): string {
  return getIndustryName(workspace.industryKey, workspace.industryCustomLabel);
}
