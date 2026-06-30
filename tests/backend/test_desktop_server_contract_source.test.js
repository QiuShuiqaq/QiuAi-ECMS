import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

function readDesktopFile(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function readPlatformFile(relativePath) {
  return fs.readFileSync(path.resolve(process.cwd(), '..', 'qiu-commerce-license-platform', relativePath), 'utf8')
}

describe('desktop-server contract source', () => {
  it('keeps desktop remote client routes aligned with platform api routes', () => {
    const desktopClientSource = readDesktopFile('main/src/services/qiuAiLicensePlatformClientService.js')
    const activationStatusRouteSource = readPlatformFile('src/app/api/activation/status/route.ts')
    const activationActivateRouteSource = readPlatformFile('src/app/api/activation/activate/route.ts')
    const walletSummaryRouteSource = readPlatformFile('src/app/api/wallet/summary/route.ts')
    const serviceCapacityRouteSource = readPlatformFile('src/app/api/service-capacity/profile/route.ts')
    const packagesRouteSource = readPlatformFile('src/app/api/packages/route.ts')
    const ordersRouteSource = readPlatformFile('src/app/api/orders/route.ts')
    const orderDetailRouteSource = readPlatformFile('src/app/api/orders/[id]/route.ts')
    const computePackagesRouteSource = readPlatformFile('src/app/api/compute-packages/route.ts')
    const computePackageOrdersRouteSource = readPlatformFile('src/app/api/compute-package-orders/route.ts')
    const computePackageOrderDetailRouteSource = readPlatformFile('src/app/api/compute-package-orders/[id]/route.ts')
    const rechargeOrdersRouteSource = readPlatformFile('src/app/api/recharge/orders/route.ts')
    const rechargeOrderDetailRouteSource = readPlatformFile('src/app/api/recharge/orders/[id]/route.ts')
    const publishChannelAccountsRouteSource = readPlatformFile('src/app/api/client/publish/channel-accounts/route.ts')
    const publishConfigRouteSource = readPlatformFile('src/app/api/client/publish/config/route.ts')
    const publishDraftsRouteSource = readPlatformFile('src/app/api/client/publish/drafts/route.ts')
    const publishDraftDetailRouteSource = readPlatformFile('src/app/api/client/publish/drafts/[id]/route.ts')
    const publishDraftPreviewRouteSource = readPlatformFile('src/app/api/client/publish/drafts/[id]/preview/route.ts')
    const publishTasksRouteSource = readPlatformFile('src/app/api/client/publish/tasks/route.ts')
    const publishTaskDetailRouteSource = readPlatformFile('src/app/api/client/publish/tasks/[id]/route.ts')
    const publishTaskRetryRouteSource = readPlatformFile('src/app/api/client/publish/tasks/[id]/retry/route.ts')
    const generationJobsRouteSource = readPlatformFile('src/app/api/generation/jobs/route.ts')
    const generationJobDetailRouteSource = readPlatformFile('src/app/api/generation/jobs/[id]/route.ts')
    const generationArtifactDownloadRouteSource = readPlatformFile('src/app/api/generation/artifacts/[id]/download/route.ts')

    expect(desktopClientSource).toContain("'/api/activation/status'")
    expect(activationStatusRouteSource).toContain('export async function GET')
    expect(activationStatusRouteSource).toContain('deviceFingerprint')

    expect(desktopClientSource).toContain("'/api/activation/activate'")
    expect(activationActivateRouteSource).toContain('export async function POST')

    expect(desktopClientSource).toContain("'/api/wallet/summary'")
    expect(walletSummaryRouteSource).toContain('export async function GET')

    expect(desktopClientSource).toContain("'/api/service-capacity/profile'")
    expect(serviceCapacityRouteSource).toContain('export async function GET')

    expect(desktopClientSource).toContain("'/api/packages'")
    expect(packagesRouteSource).toContain('export async function GET')

    expect(desktopClientSource).toContain("'/api/orders'")
    expect(ordersRouteSource).toContain('export async function POST')
    expect(orderDetailRouteSource).toContain('export async function GET')

    expect(desktopClientSource).toContain("'/api/compute-packages'")
    expect(computePackagesRouteSource).toContain('export async function GET')

    expect(desktopClientSource).toContain("'/api/compute-package-orders'")
    expect(computePackageOrdersRouteSource).toContain('export async function POST')
    expect(computePackageOrderDetailRouteSource).toContain('export async function GET')

    expect(desktopClientSource).toContain("'/api/recharge/orders'")
    expect(rechargeOrdersRouteSource).toContain('export async function POST')
    expect(rechargeOrderDetailRouteSource).toContain('export async function GET')

    expect(desktopClientSource).toContain("'/api/client/publish/channel-accounts'")
    expect(publishChannelAccountsRouteSource).toContain('export async function GET')

    expect(desktopClientSource).toContain("'/api/client/publish/config'")
    expect(publishConfigRouteSource).toContain('export async function GET')

    expect(desktopClientSource).toContain("'/api/client/publish/drafts'")
    expect(publishDraftsRouteSource).toContain('export async function POST')
    expect(publishDraftDetailRouteSource).toContain('export async function GET')
    expect(publishDraftPreviewRouteSource).toContain('export async function POST')

    expect(desktopClientSource).toContain("'/api/client/publish/tasks'")
    expect(publishTasksRouteSource).toContain('export async function POST')
    expect(publishTaskDetailRouteSource).toContain('export async function GET')
    expect(publishTaskRetryRouteSource).toContain('export async function POST')

    expect(desktopClientSource).toContain("'/api/generation/jobs'")
    expect(generationJobsRouteSource).toContain('export async function POST')
    expect(generationJobDetailRouteSource).toContain('export async function GET')
    expect(generationJobDetailRouteSource).toContain('mode: searchParams.get("mode")')

    expect(desktopClientSource).toContain('const artifactUrl = normalizedDownloadUrl || `/api/generation/artifacts/${trimString(id)}/download`')
    expect(desktopClientSource).toContain('return requestBinary(artifactUrl, {')
    expect(desktopClientSource).toContain('sessionToken,')
    expect(desktopClientSource).toContain('params: normalizedDownloadUrl && isAbsoluteHttpUrl(normalizedDownloadUrl)')
    expect(generationArtifactDownloadRouteSource).toContain('export async function GET')
    expect(generationArtifactDownloadRouteSource).toContain('sessionToken is required')
  })

  it('keeps activation and generation payload shapes aligned with platform schemas', () => {
    const desktopClientSource = readDesktopFile('main/src/services/qiuAiLicensePlatformClientService.js')
    const cloudGenerationSource = readDesktopFile('main/src/services/cloudGenerationService.js')
    const platformSchemasSource = readPlatformFile('src/modules/platform-api/schemas.ts')
    const generationSchemasSource = readPlatformFile('src/modules/generation/schemas.ts')
    const publishSchemasSource = readPlatformFile('src/modules/publish/schemas.ts')

    expect(platformSchemasSource).toContain('deviceFingerprint: z.string().trim().min(1)')
    expect(platformSchemasSource).toContain('durationDays: z.coerce.number().int().positive().optional()')
    expect(desktopClientSource).toContain('deviceFingerprint: trimString(deviceFingerprint)')
    expect(desktopClientSource).toContain("return request('post', '/api/activation/activate'")
    expect(desktopClientSource).toContain('function normalizeActivationPayload(payload = {})')
    expect(desktopClientSource).toContain('durationDays: normalizePositiveNumber(payload.durationDays)')

    expect(generationSchemasSource).toContain('requestedConcurrency: z.coerce.number().int().min(1).max(64).optional()')
    expect(generationSchemasSource).toContain('mode: z.enum(["full", "compact"]).optional().default("full")')
    expect(cloudGenerationSource).toContain("requestedConcurrency: resolveRequestedConcurrency({")
    expect(cloudGenerationSource).toContain("mode: 'compact'")
    expect(cloudGenerationSource).toContain("mode: 'full'")
    expect(desktopClientSource).toContain('function normalizeGenerationJobPayload(payload = {})')
    expect(desktopClientSource).toContain('items: Array.isArray(payload.items) ? payload.items.map((item) => normalizeGenerationJobItem(item)) : []')

    expect(publishSchemasSource).toContain('export const publishDraftPreviewSchema = z.object({')
    expect(publishSchemasSource).toContain('export const createPublishTaskSchema = z.object({')
    expect(publishSchemasSource).toContain('"create-listing"')
    expect(desktopClientSource).toContain("return request('post', `/api/client/publish/drafts/${trimString(id)}/preview`")
    expect(desktopClientSource).toContain("return request('post', '/api/client/publish/tasks'")
    expect(desktopClientSource).toContain("operationType: trimString(payload.operationType || 'create-listing') || 'create-listing'")
  })
})
