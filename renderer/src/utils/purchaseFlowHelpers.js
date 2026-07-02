export async function openOrderPaymentLink({
  order,
  openExternalResource,
  successTitle,
  successMessage,
  showActionFeedback
}) {
  const paymentPayload = order?.paymentPayload && typeof order.paymentPayload === 'object'
    ? order.paymentPayload
    : {}
  const payUrl = (
    paymentPayload.checkoutUrl ||
    paymentPayload.paymentUrl ||
    paymentPayload.payUrl ||
    paymentPayload.redirectUrl ||
    paymentPayload.cashierUrl ||
    paymentPayload.mockPayUrl ||
    ''
  )
  console.log('[purchaseFlowHelpers] payment payload =', paymentPayload)
  console.log('[purchaseFlowHelpers] resolved pay url =', payUrl)
  if (!payUrl) {
    showActionFeedback({
      type: 'error',
      title: '支付链接缺失',
      message: '订单已创建，但服务端未返回可用的支付链接。'
    })
    return
  }

  await navigator.clipboard.writeText(payUrl)
  await openExternalResource({ target: payUrl })
  showActionFeedback({
    type: 'success',
    title: successTitle,
    message: successMessage
  })
}

export async function handlePaidOrderSuccess({
  refreshActions = [],
  showActionFeedback,
  successTitle,
  successMessage
}) {
  await Promise.all(refreshActions)
  showActionFeedback({
    type: 'success',
    title: successTitle,
    message: successMessage
  })
}
