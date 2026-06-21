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

  async function create(input) {
    if (typeof createConfig?.guard === 'function') {
      const guardResult = await createConfig.guard(input)
      if (guardResult === false) {
        return
      }
    }

    setSubmitting(true)
    try {
      const nextOrder = await createOrder(createConfig.buildPayload(input))
      setOrder(nextOrder)
      startPolling()

      showActionFeedback({
        type: 'success',
        title: createConfig.successTitle,
        message: createConfig.successMessage
      })
    } catch (error) {
      showActionFeedback({
        type: 'error',
        title: '创建失败',
        message: buildErrorMessage(error, createConfig.errorMessage)
      })
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
      const nextOrder = await fetchOrder({ id: currentOrder.id })
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
