# Platform administration testing

## Local environment

`scripts/qa/prompt11-local-auth-smoke.mjs` is a loopback-only authenticated smoke test. It checks that `apps/api/.env` is in development, the API and web Supabase URLs match and resolve to loopback, and local API/frontend health endpoints respond. It creates a random email-confirmed local Auth fixture, logs in through headless Chrome/CDP, checks the workspace API and platform-admin denial, reloads to verify session persistence, then deletes only that newly created fixture. Credentials stay in process memory and are never printed. The script does not grant a platform role.

Run with Node 24 from the project root:

```sh
npm run test:e2e:prompt11
```

The database test suite uses `npx supabase test db --local`; it must not reset an existing database. Migrations are additive and local-only for this milestone.

## Verification record

- `npm test`: **TESTED LOCALLY**, API 87/87 and frontend 58/58 (10 frontend test files).
- `npx supabase test db --local`: **TESTED LOCALLY**, 298 pgTAP assertions across 11 files. This run used the local database and did not reset it.
- `npm run typecheck`: **TESTED LOCALLY**, passed.
- `npm run lint`: **TESTED LOCALLY**, passed after the smoke harness cleanup.
- `npm run build`: **TESTED LOCALLY**, production build passed.
- `npm run test:e2e:prompt11`: **TESTED LOCALLY**, authenticated headless Chrome flow passed against the restarted local API and final migration: local login, `/api/workspaces` `200`, zero platform capabilities, protected overview `403`, session retained after refresh, UI denial rendered, logout cleared the session, no authenticated workspace-list `401`, and the temporary Auth fixture was removed.
- Local REA screenshot/accessibility capture of the sign-in screen: Evidence `ev_e2df25f53598425d67792f77d0b43fc63da11de5b2a3d4793af07651e19478e0`.
- Public REA captures: homepage `ev_73126385ef82a063e3f69f6f370e603ae5265fc02a188f6bdec3d9a116471f9a`; features `ev_f3cb16ea5536231848497af171ac81bf580b03efbb3296e28e372cabeae8b55c`.

## Limitations

The browser smoke verifies regular-user authorization and auth/session behavior. It does not verify an authorized platform operator's dashboard session because no local platform role fixture was provisioned for browser use; pgTAP covers the role matrix and API tests cover capability checks. No production operator was provisioned or promoted. Full support-consent browser acceptance and a multi-role UI session matrix remain unverified.
