import { createPurchaseOrderController } from './purchaseOrderController'

export function createRechargeOrderController({
  currentRechargeOrderRef,
  isRechargeSubmittingRef,
  isRechargeRefreshingRef,
  rechargeForm,
  createRechargeOrder,
  getRechargeOrder,
  openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  loadStudioSnapshot,
  loadActivationState
}) {
  return createPurchaseOrderController({
    getOrder: () => currentRechargeOrderRef.value,
    setOrder: (order) => {
      currentRechargeOrderRef.value = order
    },
    setSubmitting: (value) => {
      isRechargeSubmittingRef.value = value
    },
    getRefreshing: () => isRechargeRefreshingRef.value,
    setRefreshing: (value) => {
      isRechargeRefreshingRef.value = value
    },
    createOrder: createRechargeOrder,
    fetchOrder: getRechargeOrder,
    openExternalResource,
    showActionFeedback,
    buildErrorMessage,
    createConfig: {
      buildPayload: () => ({
        walletType: rechargeForm.walletType,
        channel: rechargeForm.channel,
        amountCny: Number(rechargeForm.amountCny),
        couponCode: rechargeForm.couponCode
      }),
      successTitle: '订单已创建',
      successMessage: '请继续完成支付',
      errorMessage: '创建充值订单失败'
    },
    successConfig: {
      refreshActions: () => [loadStudioSnapshot(), loadActivationState()],
      paidTitle: '充值已到账',
      paidMessage: '钱包余额已更新',
      openTitle: '已打开支付链接',
      openMessage: '支付链接已在浏览器中打开',
      refreshErrorMessage: '刷新充值订单失败'
    }
  })
}

export function createSoftwareOrderController({
  currentSoftwareOrderRef,
  isSoftwareOrderSubmittingRef,
  isSoftwareOrderRefreshingRef,
  activationFormRef,
  createSoftwareOrder,
  getSoftwareOrder,
  openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  activateRemoteLicense,
  loadActivationState,
  loadUserAgreementState,
  loadStudioSnapshot,
  loadPurchaseCenterCatalog
}) {
  return createPurchaseOrderController({
    getOrder: () => currentSoftwareOrderRef.value,
    setOrder: (order) => {
      currentSoftwareOrderRef.value = order
    },
    setSubmitting: (value) => {
      isSoftwareOrderSubmittingRef.value = value
    },
    getRefreshing: () => isSoftwareOrderRefreshingRef.value,
    setRefreshing: (value) => {
      isSoftwareOrderRefreshingRef.value = value
    },
    createOrder: createSoftwareOrder,
    fetchOrder: getSoftwareOrder,
    openExternalResource,
    showActionFeedback,
    buildErrorMessage,
    createConfig: {
      buildPayload: (productPackageId) => ({
        productPackageId,
        channel: 'alipay',
        customerName: activationFormRef?.value?.customerName || '',
        contact: activationFormRef?.value?.contact || '',
        inviteCode: activationFormRef?.value?.inviteCode || '',
        deviceName: 'QiuAi Desktop'
      }),
      buildRefreshPayload: (currentOrder) => ({
        id: currentOrder?.id || '',
        orderAccessToken: currentOrder?.orderAccessToken || ''
      }),
      successTitle: '授权订单已创建',
      successMessage: '请继续完成支付',
      errorMessage: '创建授权订单失败'
    },
    successConfig: {
      refreshActions: () => {
        const activationPayload = {
          customerName: activationFormRef?.value?.customerName || '',
          contact: activationFormRef?.value?.contact || '',
          inviteCode: activationFormRef?.value?.inviteCode || '',
          deviceName: 'QiuAi Desktop'
        }

        return [
          activateRemoteLicense(activationPayload).catch(() => null),
          loadActivationState(),
          loadUserAgreementState(),
          loadStudioSnapshot(),
          loadPurchaseCenterCatalog()
        ]
      },
      paidTitle: '授权已到账',
      paidMessage: '当前设备会自动尝试激活',
      openTitle: '已打开支付链接',
      openMessage: '授权支付链接已在浏览器中打开',
      refreshErrorMessage: '刷新授权订单失败'
    }
  })
}

export function createComputePackageOrderController({
  currentComputePackageOrderRef,
  isComputePackageOrderSubmittingRef,
  isComputePackageOrderRefreshingRef,
  computePackagesRef,
  createComputePackageOrder,
  getComputePackageOrder,
  openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  loadActivationState,
  loadStudioSnapshot,
  loadPurchaseCenterCatalog
}) {
  return createPurchaseOrderController({
    getOrder: () => currentComputePackageOrderRef.value,
    setOrder: (order) => {
      currentComputePackageOrderRef.value = order
    },
    setSubmitting: (value) => {
      isComputePackageOrderSubmittingRef.value = value
    },
    getRefreshing: () => isComputePackageOrderRefreshingRef.value,
    setRefreshing: (value) => {
      isComputePackageOrderRefreshingRef.value = value
    },
    createOrder: createComputePackageOrder,
    fetchOrder: getComputePackageOrder,
    openExternalResource,
    showActionFeedback,
    buildErrorMessage,
    createConfig: {
      guard: (computePackageId) => {
        const targetPackage = computePackagesRef.value.find((item) => item.id === computePackageId)
        if (targetPackage?.canPurchase === false) {
          showActionFeedback({
            type: 'error',
            title: '当前不可购买',
            message: targetPackage.purchaseBlockedReason || '当前授权版本不能购买该算力包'
          })
          return false
        }
        return true
      },
      buildPayload: (computePackageId) => ({
        computePackageId,
        channel: 'alipay'
      }),
      successTitle: '算力包订单已创建',
      successMessage: '请继续完成支付',
      errorMessage: '创建算力包订单失败'
    },
    successConfig: {
      refreshActions: () => [loadActivationState(), loadStudioSnapshot(), loadPurchaseCenterCatalog()],
      paidTitle: '算力包已到账',
      paidMessage: '算力余额和服务档位已同步',
      openTitle: '已打开支付链接',
      openMessage: '算力包支付链接已在浏览器中打开',
      refreshErrorMessage: '刷新算力包订单失败'
    }
  })
}
