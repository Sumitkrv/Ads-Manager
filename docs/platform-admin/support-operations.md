# Platform support operations

## Case management

Support cases are persisted with a workspace association, requester, category, priority, state, assignee, resolution summary and timestamps. Internal operator notes are stored separately from the customer-facing case summary. Customer case reads and consent decisions run through caller-authenticated, workspace-membership-checked RPCs.

Supported case states: `OPEN`, `IN_PROGRESS`, `WAITING_ON_CUSTOMER`, `RESOLVED`, `CLOSED`.

## Consent requests

A support operator can record a limited, expiring access request for enumerated operational scopes. The workspace owner or authorized workspace administrator can approve or reject the request; the owner can revoke consent. Scope, decision, actor, timestamp and expiry are persisted and audited.

**Approval does not currently enable an operator to read customer campaigns, creatives, reports, comments or private assets.** It records consent intent only. Default support content access remains denied. Do not tell a customer that approval created data access.

## Privacy and logging

Support list/detail endpoints are capability-gated and bounded. Private notes are not returned from workspace-facing RPCs. Tokens, passwords, raw headers and invitation secrets are excluded from audit metadata. Support agents do not receive general tenant-directory access.
