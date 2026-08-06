# Mobile Privacy/RBAC Review

- Tokens are stored only through SecureStore and are absent from telemetry/log payloads.
- Every tenant operation uses the authenticated membership path and selected branch context.
- Media upload intents require server consent/permission; signed URLs and raw media are not cached
  in general query state and are redacted from logs.
- Notification payloads contain safe IDs/routes only. Deep links and native actions re-authorize
  session, tenant, branch, permission, freshness and current state before mutation.
- Logout, tenant switch, session expiry and upload lifecycle evict sensitive query data.
- Local Google, notification, camera and storage doubles are test/local adapters; production
  credentials are not committed.
