export async function openOrderPaymentLink({
  order,
  openExternalResource,
  successTitle,
  successMessage,
  showActionFeedback
}) {
  const payUrl = order?.paymentPayload?.mockPayUrl || ''
  if (!payUrl) {
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
