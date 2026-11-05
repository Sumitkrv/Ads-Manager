import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AnalyticsPage } from "./AnalyticsPage";

const mocks=vi.hoisted(()=>({getAnalyticsOverview:vi.fn(),getAnalyticsCampaigns:vi.fn(),getAnalyticsCreatives:vi.fn(),getAnalyticsSavedViews:vi.fn(),saveAnalyticsView:vi.fn(),exportCampaignAnalytics:vi.fn(),downloadExport:vi.fn(),trackingRequest:vi.fn()}));
vi.mock("../auth/AuthProvider",()=>({useAuth:()=>({session:{access_token:"test-token"}})}));
vi.mock("../workspace/WorkspaceContext",()=>({useWorkspace:()=>({activeWorkspaceId:"21000000-0000-4000-8000-000000000001",activeWorkspace:{id:"21000000-0000-4000-8000-000000000001",name:"Northstar Studio",role:"owner",industryKey:"professional_services"}})}));
vi.mock("../components/WorkspaceAppLayout",()=>({WorkspaceAppLayout:({children}:{children:React.ReactNode})=><div>{children}</div>}));
vi.mock("../api/analytics",()=>mocks);
vi.mock("../api/tracking",()=>({trackingRequest:mocks.trackingRequest}));

const overview={source:"DEMO_SIMULATION",label:"Simulated Data — Not Actual Ad Performance",workspace:{id:"21000000-0000-4000-8000-000000000001",name:"Northstar Studio"},dateRange:{from:"2026-10-01",to:"2026-10-28",timezone:"UTC"},summary:{impressions:2000,clicks:90,conversions:8,ctr:4.5,conversionRate:8.89,spendByCurrency:[{currency:"USD",spend:35,cpc:0.39,cpm:17.5,cpa:4.38,roas:null}]},comparison:null,trend:{metric:"spend",series:[{currency:"USD",points:[{date:"2026-10-27",value:20},{date:"2026-10-28",value:15}]}]},platforms:[],campaigns:[],campaignCounts:{},operationalCampaignCount:1,demoPublishedCampaignCount:1,currencies:["USD"],insights:{label:"Rule-Based Insights",observations:[]},availableFilters:{objectives:["website_traffic"],statuses:["demo_published"],industries:["professional_services"],campaigns:[{id:"83000000-0000-4000-8000-000000000001",name:"Northstar traffic"}]}};

function renderPage(path="/app/analytics"){return render(<MemoryRouter initialEntries={[path]}><AnalyticsPage/></MemoryRouter>);}
beforeEach(()=>{mocks.getAnalyticsOverview.mockReset().mockResolvedValue(overview);mocks.getAnalyticsCampaigns.mockReset().mockResolvedValue({source:"DEMO_SIMULATION",label:overview.label,rows:[],total:0,page:1,pageSize:20});mocks.getAnalyticsCreatives.mockReset().mockResolvedValue({source:"DEMO_SIMULATION",label:overview.label,creatives:[],message:"No creative-level attribution."});mocks.getAnalyticsSavedViews.mockReset().mockResolvedValue({views:[]});mocks.saveAnalyticsView.mockReset().mockResolvedValue({view:{id:"view-id"}});mocks.exportCampaignAnalytics.mockReset();mocks.downloadExport.mockReset();mocks.trackingRequest.mockReset().mockResolvedValue({goals:[{},{}],mappings:[{}],campaignLinks:[{}],testRuns:[{},{}]});});
afterEach(()=>cleanup());

describe("AnalyticsPage",()=>{
  it("shows persisted campaign counts and explicitly labeled simulated metrics",async()=>{renderPage();expect(await screen.findByText("4.5%",{exact:false})).toBeTruthy();expect(screen.getAllByText("Simulated Data — Not Actual Ad Performance").length).toBeGreaterThan(0);expect(screen.getByText("Northstar Studio",{selector:"p"})).toBeTruthy();});
  it("shows measurement planning counts separately from campaign performance",async()=>{renderPage();expect(await screen.findByText("Tracking setup coverage")).toBeTruthy();expect(screen.getByText("Planned goals")).toBeTruthy();expect(screen.getByText("Synthetic checks")).toBeTruthy();expect(screen.getByRole("link",{name:"Open Integrations & Measurement"})).toBeTruthy();});
  it("applies platform selection to the workspace analytics requests",async()=>{const user=userEvent.setup();renderPage();await screen.findByText("Campaign performance");await user.selectOptions(screen.getByRole("combobox",{name:"Platform filter"}),"google_ads");await waitFor(()=>expect(mocks.getAnalyticsOverview).toHaveBeenLastCalledWith("test-token","21000000-0000-4000-8000-000000000001",expect.objectContaining({platform:"google_ads"}),expect.any(AbortSignal)));});
  it("keeps creative analytics in an honest insufficient-attribution state",async()=>{renderPage("/app/analytics/creatives");expect(await screen.findByText("No saved creative projects")).toBeTruthy();expect(screen.getByText("No creative attribution data")).toBeTruthy();});
});
