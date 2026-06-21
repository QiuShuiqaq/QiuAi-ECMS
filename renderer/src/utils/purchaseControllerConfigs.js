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
      errorMessage: '充值订单创建失败'
    },
    successConfig: {
      refreshActions: () => [
        loadStudioSnapshot(),
        loadActivationState()
      ],
      paidTitle: '到账成功',
      paidMessage: '余额已更新',
      openTitle: '已打开',
      openMessage: '支付链接已在新窗口打开',
      refreshErrorMessage: '订单状态查询失败'
    }
  })
}

export function createSoftwareOrderController({
  currentSoftwareOrderRef,
  isSoftwareOrderSubmittingRef,
  isSoftwareOrderRefreshingRef,
  createSoftwareOrder,
  getSoftwareOrder,
  openExternalResource,
  showActionFeedback,
  buildErrorMessage,
  loadActivationState,
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
        channel: 'alipay'
      }),
      successTitle: '授权订单已创建',
      successMessage: '请继续完成支付',
      errorMessage: '授权订单创建失败'
    },
    successConfig: {
      refreshActions: () => [
        loadActivationState(),
        loadStudioSnapshot(),
        loadPurchaseCenterCatalog()
      ],
      paidTitle: '授权已到账',
      paidMessage: '已同步最新授权状态',
      openTitle: '已打开支付',
      openMessage: '授权订单支付链接已在浏览器打开',
      refreshErrorMessage: '授权订单查询失败'
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
            title: '无法购买',
            message: targetPackage.purchaseBlockedReason || '当前授权版本不可购买该算力包'
          })
          return false
        }
        return true
      },
      buildPayload: (computePackageId) => ({
        computePackageId,
        channel: 'alipay'
      }),
      successTitle: '月套餐订单已创建',
      successMessage: '请继续完成支付',
      errorMessage: '月套餐订单创建失败'
    },
    successConfig: {
      refreshActions: () => [
        loadActivationState(),
        loadStudioSnapshot(),
        loadPurchaseCenterCatalog()
      ],
      paidTitle: '月套餐已到账',
      paidMessage: '已同步最新算力额度',
      openTitle: '已打开支付',
      openMessage: '月套餐订单支付链接已在浏览器打开',
      refreshErrorMessage: '月套餐订单查询失败'
    }
  })
}
