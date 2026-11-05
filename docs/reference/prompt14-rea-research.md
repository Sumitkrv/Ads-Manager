# Prompt 14 — REA research notes

## Scope and method

REA `capture_browser_scenario` was used in controlled replay against the two public URLs requested. The captures requested the browser URL, DOM, accessibility tree and screenshot, with empty storage and no interaction actions. No private account or customer content was accessed.

| Evidence ID | Target | What was captured |
| --- | --- | --- |
| `ev_199426d57b6ca759e2324534de89d2e862bfedcb568315719e214d5c3c144e5b` | `https://www.kainet.tech/` | Public home page, navigation, page structure and rendered view |
| `ev_449cb0aefe530f8d0c2a311dcfac987a73b9092bc21a64b81c953f9d5aa3aca3` | `https://www.kainet.tech/features` | Public feature descriptions and rendered view |

The browser provider identified the captures as controlled replay. These records describe only the public pages observed at capture time; they do not establish private application behavior.

## Evidence classification

### OBSERVED

- The public home page exposes Features, Pricing, Compare and Login navigation.
- The public site uses an agency and multi-channel positioning in its rendered product copy.
- The public feature page is organized around campaign architecture, creative work, human review and post-launch visibility.
- The pages use product-oriented sections and a staged workflow narrative.

### ADVERTISED

- kAInet describes support for advertising workflows across channels and for agencies.
- The feature page advertises campaign planning, creative development, human review and post-launch performance visibility.

These are public marketing claims, not independently verified provider behavior.

### INFERRED

- A preparation-first integration catalogue and measurement workspace fit the observed staged workflow and agency audience. This is a Tandem Ads product decision, not evidence that kAInet exposes the same settings.
- Separating saved configuration from provider verification reduces ambiguity when connections are unavailable.

### UNAVAILABLE

- Private account settings, provider connection screens, internal workspace roles and customer records were not available from the public pages and were not accessed.
- The inspected pages do not establish details of kAInet conversion tracking, event schemas, account-readiness scoring, consent handling or offline event tests.
- Provider-specific Meta event mapping details were not established by the collected official-source research for this task.

## Public provider documentation consulted

- [GA4 recommended events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events): the public event reference includes `generate_lead` for lead acquisition and `purchase` with transaction, value, currency and item concepts.
- [GA4 event setup](https://developers.google.com/analytics/devguides/collection/ga4/events?hl=en): event configuration concepts used to distinguish event definitions from provider delivery.
- [Google Analytics URL builders](https://support.google.com/analytics/answer/10917952?hl=en-4): UTM concepts include source, medium and campaign, with content and term as optional fields.
- [Google Ads conversion tracking](https://support.google.com/google-ads/answer/1722054?hl=en): conversion actions and offline import are distinct measurement workflows.
- [Google Tag Manager tags](https://support.google.com/tagmanager/answer/6103657?hl=en-GE): tags, triggers and variables informed the structured future implementation plan.

Official documentation was consulted for public terminology only. No account OAuth, provider API call, tag request, conversion upload, event transmission or account discovery was performed.

## Resulting design decisions

- Keep provider cards visibly disconnected and disable OAuth/API routes server-side.
- Describe saved provider identifiers as user-entered planning metadata.
- Derive readiness progress from persisted checklist responses and label it preparation progress.
- Keep goals, event mappings and synthetic results separate from campaign performance metrics.
- Build UTM URLs locally and never fetch destination URLs from the backend.
- Mark all test events “SIMULATED EVENT — NOT SENT TO PROVIDER.”
- Use original Tandem Ads navigation and visual styling; no private reference UI was copied.
