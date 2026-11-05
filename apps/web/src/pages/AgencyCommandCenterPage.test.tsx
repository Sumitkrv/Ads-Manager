import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const api = vi.hoisted(() => ({
  getAgencyOverview: vi.fn(), saveAgencyProfile: vi.fn(), getAgencyTeam: vi.fn(), getAgencyActivity: vi.fn(),
  getClientOverview: vi.fn(), getClientTasks: vi.fn(), getClientComments: vi.fn(), listCampaigns: vi.fn(),
  selectWorkspace: vi.fn(), navigate: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ session: { access_token: "opaque-test-token" } }) }));
vi.mock("../workspace/WorkspaceContext", () => ({ useWorkspace: () => ({
  activeWorkspace: { id: "95000000-0000-4000-8000-000000000001", name: "Northstar Agency", role: "owner" },
  status: "ready", selectWorkspace: api.selectWorkspace, refresh: vi.fn(),
}) }));
vi.mock("../components/WorkspaceAppLayout", () => ({ WorkspaceAppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../api/agency", () => ({
  AgencyApiError: class AgencyApiError extends Error { constructor(readonly status: number, message: string) { super(message); } },
  getAgencyOverview: api.getAgencyOverview, saveAgencyProfile: api.saveAgencyProfile,
  getAgencyTeam: api.getAgencyTeam, getAgencyActivity: api.getAgencyActivity,
  getClientOverview: api.getClientOverview, getClientTasks: api.getClientTasks, getClientComments: api.getClientComments,
}));
vi.mock("../api/campaigns", () => ({ listCampaigns: api.listCampaigns }));

import { AgencyCommandCenterPage } from "./AgencyCommandCenterPage";

const renderAt = (path: string, portal = false) => render(<MemoryRouter initialEntries={[path]}><AgencyCommandCenterPage portal={portal} /></MemoryRouter>);

describe("Agency Command Center and Client Portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAgencyOverview.mockResolvedValue({ designated: false, profile: null, clients: [], counts: {} });
    api.saveAgencyProfile.mockResolvedValue({ profile: { agency_workspace_id: "95000000-0000-4000-8000-000000000001" } });
    api.getClientOverview.mockResolvedValue({ overview: { campaign_count: 0, pending_campaign_reviews: 0, creative_review_count: 0, open_task_count: 0 }, relationships: [] });
    api.getClientTasks.mockResolvedValue({ tasks: [] });
    api.getClientComments.mockResolvedValue({ comments: [] });
    api.listCampaigns.mockResolvedValue({ campaigns: [] });
  });
  afterEach(() => cleanup());

  it("lets an authorized agency owner designate and persist the current workspace", async () => {
    renderAt("/app/agency");
    expect(await screen.findByText(/Set up Northstar Agency for agency work/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Agency description"), { target: { value: "Cross-industry performance team" } });
    fireEvent.click(screen.getByRole("button", { name: "Save agency profile" }));
    await waitFor(() => expect(api.saveAgencyProfile).toHaveBeenCalledWith("opaque-test-token", "95000000-0000-4000-8000-000000000001", {
      description: "Cross-industry performance team", websiteUrl: null, specializations: [],
    }));
  });

  it("renders client workspace activity without exposing internal agency notes", async () => {
    api.getClientOverview.mockResolvedValue({
      overview: { campaign_count: 2, pending_campaign_reviews: 1, creative_review_count: 0, open_task_count: 1 },
      relationships: [],
    });
    api.getClientTasks.mockResolvedValue({ tasks: [
      { id: "task-visible", title: "Review the campaign brief", status: "in_review", priority: "normal", visibility: "client_visible" },
      { id: "task-secret", title: "Internal capacity planning", status: "todo", priority: "normal", visibility: "agency_internal" },
    ] });
    api.getClientComments.mockResolvedValue({ comments: [
      { id: "comment-visible", body: "Please update the opening line.", visibility: "client_visible" },
      { id: "comment-secret", body: "Do not show this internal agency note.", visibility: "agency_internal" },
    ] });
    renderAt("/app/client/overview", true);
    expect(await screen.findByText("Northstar Agency")).toBeTruthy();
    expect(await screen.findAllByText("Review the campaign brief")).toHaveLength(2);
    expect(screen.getByText("Please update the opening line.")).toBeTruthy();
    expect(screen.queryByText("Internal capacity planning")).toBeNull();
    expect(screen.queryByText("Do not show this internal agency note.")).toBeNull();
  });
});
