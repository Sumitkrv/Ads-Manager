import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductTour } from "./ProductTour";

const mocks = vi.hoisted(() => ({ saveProductTourProgress: vi.fn() }));
vi.mock("../api/onboarding", () => mocks);

const definition = {
  id: "owner-overview",
  title: "Workspace overview",
  audience: "owner" as const,
  steps: [
    { target: "tour-first", title: "First step", body: "Workspace context." },
    { target: "tour-second", title: "Second step", body: "Campaign context." },
  ],
};

beforeEach(() => {
  mocks.saveProductTourProgress.mockReset().mockResolvedValue({});
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1, item: () => null } as unknown as DOMRectList);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderTour(onClose = vi.fn()) {
  render(<><button data-tour-id="tour-first">First target</button><button data-tour-id="tour-second">Second target</button><ProductTour onClose={onClose} token="test-token" tour={definition} workspaceId="21000000-0000-4000-8000-000000000001" /></>);
  return onClose;
}

describe("ProductTour", () => {
  it("moves through steps and persists a user skip", async () => {
    const user = userEvent.setup();
    const onClose = renderTour();
    expect(await screen.findByRole("heading", { name: "First step" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("heading", { name: "Second step" })).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(mocks.saveProductTourProgress).toHaveBeenCalledWith("test-token", expect.objectContaining({ status: "skipped", stepIndex: 1 })));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("skips an unavailable target and continues without trapping the user", async () => {
    render(<><button data-tour-id="tour-second">Second target</button><ProductTour onClose={vi.fn()} token="test-token" tour={{ ...definition, steps: [{ target: "missing-target", title: "Unavailable", body: "This target is not mounted." }, definition.steps[1]!] }} workspaceId="21000000-0000-4000-8000-000000000001" /></>);
    expect(await screen.findByRole("heading", { name: "Unavailable" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Second step" }, { timeout: 4000 })).toBeTruthy();
  });

  it("supports a separate trusted persistence scope without inventing a workspace id", async () => {
    const user = userEvent.setup(); const persist = vi.fn().mockResolvedValue({}); const close = vi.fn();
    render(<><button data-tour-id="tour-first">First target</button><button data-tour-id="tour-second">Second target</button><ProductTour onClose={close} onSaveProgress={persist} token="test-token" tour={{ ...definition, id: "platform-operator", audience: "platform" }} /></>);
    await user.click(await screen.findByRole("button", { name: "Skip product tour" }));
    await waitFor(() => expect(persist).toHaveBeenCalledWith({ tourId: "platform-operator", stepIndex: 0, status: "skipped" }));
    expect(close).toHaveBeenCalledOnce();
  });
});
