import { createIntervalPoller } from './pollingController'
import { handlePaidOrderSuccess, openOrderPaymentLink } from './purchaseFlowHelpers'

export function createPurchaseOrderController({
  getOrder,
  setOrder,
  setSubmitting,
  getRefreshing,
  setRefreshing,
  createOrder,
  fetchOrder,
  openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  successConfig,
  createConfig
}) {
  let poller = null

  function isOrderNotFoundError(error) {
    const code = String(error?.code || '').trim()
    const message = String(error?.message || '').trim().toLowerCase()
    return code.includes('NOT_FOUND') || message.includes('was not found')
  }

  function buildFetchPayload(currentOrder) {
    if (typeof createConfig?.buildRefreshPayload === 'function') {
      return createConfig.buildRefreshPayload(currentOrder) || {}
    }

    return {
      id: currentOrder?.id
    }
  }

  async function create(input) {
    if (typeof createConfig?.guard === 'function') {
      const guardResult = await createConfig.guard(input)
      if (guardResult === false) {
        return null
      }
    }

    setSubmitting(true)
    try {
      const nextOrder = await createOrder(createConfig.buildPayload(input))
      console.log('[purchaseOrderController] created order =', nextOrder)
      setOrder(nextOrder)
      startPolling()

      if (typeof createConfig?.afterCreate === 'function') {
        await createConfig.afterCreate(nextOrder)
      }

      showActionFeedback({
        type: 'success',
        title: createConfig.successTitle,
        message: createConfig.successMessage
      })
      return nextOrder
    } catch (error) {
      showActionFeedback({
        type: 'error',
        title: '创建失败',
        message: buildErrorMessage(error, createConfig.errorMessage)
      })
      return null
    } finally {
      setSubmitting(false)
    }
  }

  async function refresh() {
    const currentOrder = getOrder()
    if (!currentOrder?.id) {
      return
    }

    setRefreshing(true)
    try {
      const nextOrder = await fetchOrder(buildFetchPayload(currentOrder))
      setOrder(nextOrder)

      if (nextOrder?.status === 'paid') {
        await handlePaidOrderSuccess({
          refreshActions: successConfig.refreshActions(),
          showActionFeedback,
          successTitle: successConfig.paidTitle,
          successMessage: successConfig.paidMessage
        })
      }
    } catch (error) {
      if (isOrderNotFoundError(error)) {
        stopPolling()
        setOrder(null)
        return
      }

      showActionFeedback({
        type: 'error',
        title: '查询失败',
        message: buildErrorMessage(error, successConfig.refreshErrorMessage)
      })
    } finally {
      setRefreshing(false)
    }
  }

  function startPolling() {
    if (!poller) {
      poller = createIntervalPoller({
        shouldRun: () => Boolean(getOrder()?.id) && !getRefreshing(),
        shouldStop: () => ['paid', 'failed', 'closed'].includes(getOrder()?.status),
        onTick: refresh
      })
    }
    poller.start()
  }

  function stopPolling() {
    poller?.stop()
  }

  async function openPaymentLink() {
    await openOrderPaymentLink({
      order: getOrder(),
      openExternalResource,
      successTitle: successConfig.openTitle,
      successMessage: successConfig.openMessage,
      showActionFeedback
    })
  }

  return {
    create,
    refresh,
    startPolling,
    stopPolling,
    openPaymentLink
  }
}
