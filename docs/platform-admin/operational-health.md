# Operational health signals

The health page reports measured signals only:

- **API:** the current authenticated request was served successfully.
- **Database:** a restricted database probe returned a successful result.
- **Auth:** the current operator access token was verified for this request.
- **Storage:** `UNKNOWN`; no independent Storage health probe is configured.
- **Background workers:** `UNKNOWN`; no continuously running platform worker is configured.
- **Migration status:** `UNKNOWN`; the API does not claim a hosted/local migration reconciliation check.

No uptime percentage, CPU, memory, cost, or historical error rate is invented. A healthy request does not establish overall service uptime. Health responses are role-gated and exclude credentials, connection strings and secret configuration.
