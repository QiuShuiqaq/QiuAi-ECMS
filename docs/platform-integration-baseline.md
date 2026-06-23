# QiuAi Platform Integration Baseline

## Current desktop target

The desktop app should now default to:

- `https://api.qiuaihub.com`

This base URL is stored in:

- `main/src/services/settingsStoreService.js`

## Current desktop-to-platform route groups

The desktop client currently calls these platform route groups:

- activation:
  - `/api/activation/status`
  - `/api/activation/activate`
- commerce:
  - `/api/packages`
  - `/api/orders`
  - `/api/orders/:id`
  - `/api/compute-packages`
  - `/api/compute-package-orders`
  - `/api/compute-package-orders/:id`
  - `/api/recharge/orders`
  - `/api/recharge/orders/:id`
  - `/api/wallet/summary`
  - `/api/service-capacity/profile`
- selection assistant:
  - `/api/client/selection/manifest`
  - `/api/client/selection/platforms`
  - `/api/client/selection/sites`
  - `/api/client/selection/items`
  - `/api/client/selection/items/:id`
- publish center:
  - `/api/client/publish/config`
  - `/api/client/publish/channel-accounts`
  - `/api/client/publish/drafts`
  - `/api/client/publish/drafts/:id`
  - `/api/client/publish/drafts/:id/preview`
  - `/api/client/publish/tasks`
  - `/api/client/publish/tasks/:id`
  - `/api/client/publish/tasks/:id/retry`
- generation:
  - `/api/generation/jobs`
  - `/api/generation/jobs/:id`
  - `/api/generation/artifacts/:id/download`

## Current transport model

- JSON APIs go through `api.qiuaihub.com`
- artifact binary download may bypass the platform API when an absolute `downloadUrl` is returned
- CDN-style URLs such as `https://cdn.qiuaihub.com/...` are still valid and should remain direct-download targets

## Confirmed baseline

- platform server is live on `https://api.qiuaihub.com`
- admin server is live on `https://admin.qiuaihub.com`
- desktop default remote base URL has been switched from `https://qiuaihub.com` to `https://api.qiuaihub.com`
- related desktop tests for settings, platform client, cloud generation, and workspace service are passing

## Next integration checkpoints

1. Verify desktop activation flow against `api.qiuaihub.com`
2. Verify desktop session token persistence and reuse after restart
3. Verify purchase-center reads:
   - packages
   - wallet summary
   - service capacity
4. Verify generation job create and job polling against live platform
5. Verify selection assistant list/detail flow against live platform
6. Verify publish draft and publish task flow against live platform

## Known remaining gap

The desktop app has only completed the default-domain cutover and test-baseline update.

It has not yet completed a real end-to-end live integration verification against the production platform for:

- activation
- purchase center
- selection assistant
- generation
- publish center
