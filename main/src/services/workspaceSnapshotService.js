const os = require('node:os')

function createWorkspaceSnapshotService({
  settingsService,
  getStoredState,
  getStoredTasks,
  getResolvedExportItemsByMenu,
  buildAgentReadinessSnapshot,
  refreshDashboardCredits,
  hydrateResultsByMenuForDisplay,
  hydrateProjectRunsForDisplay,
  normalizeRequestMetrics,
  sortTasks,
  countCurrentResults,
  menuItems = [],
  stateMenuItems = menuItems,
  workspaceDashboardSections = [],
  menuLabelMap = {},
  taskMenuMapByCategory = {}
} = {}) {
  function pickStateMenuState(source = {}) {
    return Object.fromEntries(stateMenuItems.map((item) => {
      return [item.key, source[item.key]]
    }))
  }

  function buildBaseSnapshot() {
    const state = getStoredState()
    const settings = settingsService.getSettings()
    const tasks = getStoredTasks(state)
    const exportItemsByMenu = getResolvedExportItemsByMenu(state)
    const derivedState = {
      ...state,
      exportItemsByMenu
    }

    return {
      state,
      settings,
      tasks,
      exportItemsByMenu,
      derivedState
    }
  }

  function resolveTaskMenuKey(task = {}) {
    if (task.menuKey && menuLabelMap[task.menuKey]) {
      return task.menuKey
    }

    return taskMenuMapByCategory[task.category] || ''
  }

  function countStoredResults(exportItems = []) {
    return exportItems.filter((item) => {
      return item && (item.savedPath || item.directoryPath || item.outputDirectory || item.status === '已存储')
    }).length
  }

  function buildWorkspaceStatsCard({ state, tasks = [], menuKey, title }) {
    const relatedTasks = sortTasks(tasks).filter((task) => resolveTaskMenuKey(task) === menuKey)
    const completedTaskCount = relatedTasks.filter((task) => task.status === '已完成').length
    const failedTaskCount = relatedTasks.filter((task) => task.status === '失败').length
    const exportItems = state.exportItemsByMenu[menuKey] || []
    const resultPayload = state.resultsByMenu[menuKey] || { textResults: [], images: [] }
    const items = [
      { label: '模型调用次数', value: String(relatedTasks.length) },
      { label: '任务总数', value: String(relatedTasks.length) },
      { label: '已完成任务', value: String(completedTaskCount) },
      { label: '失败任务', value: String(failedTaskCount) },
      { label: '当前结果数', value: String(countCurrentResults(resultPayload)) },
      { label: '已存储结果', value: String(countStoredResults(exportItems)) }
    ]

    return {
      title,
      items
    }
  }

  function buildCreditOverview(settings = {}) {
    const dashboardCreditState = settings.dashboardCreditState && typeof settings.dashboardCreditState === 'object'
      ? settings.dashboardCreditState
      : {}
    const textBalanceCny = Math.max(0, Number(dashboardCreditState.text?.balanceCny) || 0)
    const textSubscriptionBalanceCny = Math.max(0, Number(dashboardCreditState.text?.subscriptionBalanceCny) || 0)
    const textPermanentBalanceCny = Math.max(0, Number(dashboardCreditState.text?.permanentBalanceCny) || 0)
    const imageBalanceCny = Math.max(0, Number(dashboardCreditState.image?.balanceCny) || 0)
    const imageSubscriptionBalanceCny = Math.max(0, Number(dashboardCreditState.image?.subscriptionBalanceCny) || 0)
    const imagePermanentBalanceCny = Math.max(0, Number(dashboardCreditState.image?.permanentBalanceCny) || 0)
    const videoBalanceCny = Math.max(0, Number(dashboardCreditState.video?.balanceCny) || 0)
    const videoSubscriptionBalanceCny = Math.max(0, Number(dashboardCreditState.video?.subscriptionBalanceCny) || 0)
    const videoPermanentBalanceCny = Math.max(0, Number(dashboardCreditState.video?.permanentBalanceCny) || 0)

    return {
      ledgers: [
        {
          key: 'text',
          title: '文本',
          unit: 'CNY',
          value: textBalanceCny.toFixed(2),
          items: [
            { label: '可用余额', value: textBalanceCny.toFixed(2) },
            { label: '月度余额', value: textSubscriptionBalanceCny.toFixed(2) },
            { label: '永久余额', value: textPermanentBalanceCny.toFixed(2) }
          ]
        },
        {
          key: 'image',
          title: '图片',
          unit: 'CNY',
          value: imageBalanceCny.toFixed(2),
          items: [
            { label: '可用余额', value: imageBalanceCny.toFixed(2) },
            { label: '月度余额', value: imageSubscriptionBalanceCny.toFixed(2) },
            { label: '永久余额', value: imagePermanentBalanceCny.toFixed(2) }
          ]
        },
        {
          key: 'video',
          title: '视频',
          unit: 'CNY',
          value: videoBalanceCny.toFixed(2),
          items: [
            { label: '可用余额', value: videoBalanceCny.toFixed(2) },
            { label: '月度余额', value: videoSubscriptionBalanceCny.toFixed(2) },
            { label: '永久余额', value: videoPermanentBalanceCny.toFixed(2) }
          ]
        }
      ]
    }
  }

  function buildCreditMessages(settings = {}) {
    const dashboardCreditState = settings.dashboardCreditState && typeof settings.dashboardCreditState === 'object'
      ? settings.dashboardCreditState
      : {}

    return {
      ledgers: [
        {
          key: 'text',
          title: '文本记录',
          items: dashboardCreditState.text?.lastSyncedAt
            ? [{
                id: `text-sync-${dashboardCreditState.text.lastSyncedAt}`,
                createdAt: dashboardCreditState.text.lastSyncedAt,
                note: '文本余额同步',
                amount: Number(dashboardCreditState.text.balanceCny || 0).toFixed(2)
              }]
            : []
        },
        {
          key: 'image',
          title: '图片记录',
          items: dashboardCreditState.image?.lastSyncedAt
            ? [{
                id: `image-sync-${dashboardCreditState.image.lastSyncedAt}`,
                createdAt: dashboardCreditState.image.lastSyncedAt,
                note: '图片余额同步',
                amount: Number(dashboardCreditState.image.balanceCny || 0).toFixed(2)
              }]
            : []
        },
        {
          key: 'video',
          title: '视频记录',
          items: dashboardCreditState.video?.lastSyncedAt
            ? [{
                id: `video-sync-${dashboardCreditState.video.lastSyncedAt}`,
                createdAt: dashboardCreditState.video.lastSyncedAt,
                note: '视频额度同步',
                amount: Number(dashboardCreditState.video.balanceCny || 0).toFixed(2)
              }]
            : []
        }
      ]
    }
  }

  function formatMonitorTimeLabel(dateValue = '') {
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) {
      return '--:--:--'
    }

    return [
      String(date.getHours()).padStart(2, '0'),
      String(date.getMinutes()).padStart(2, '0'),
      String(date.getSeconds()).padStart(2, '0')
    ].join(':')
  }

  function buildNetworkMonitor(state = {}) {
    const requestMetrics = normalizeRequestMetrics(state.requestMetrics).sort((left, right) => {
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0
      return rightTime - leftTime
    })
    const totalCount = requestMetrics.length
    const successCount = requestMetrics.filter((item) => item.requestStatus === 'success').length
    const averageLatencyMs = totalCount
      ? Math.round(requestMetrics.reduce((sum, item) => sum + item.elapsedMs, 0) / totalCount)
      : 0

    return {
      title: '网络监控',
      items: requestMetrics.slice(0, 12).map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        timeLabel: formatMonitorTimeLabel(item.createdAt),
        method: item.method || 'POST',
        requestPath: item.requestPath,
        elapsedMs: item.elapsedMs,
        status: item.requestStatus
      })),
      summary: {
        latestLatencyMs: requestMetrics[0]?.elapsedMs || 0,
        averageLatencyMs,
        successRate: totalCount ? `${Math.round((successCount / totalCount) * 100)}%` : '0%'
      }
    }
  }

  function buildWorkspaceDashboard(state, tasks = [], settings = {}) {
    return {
      ...Object.fromEntries(workspaceDashboardSections.map((section) => [
        section.cardKey,
        buildWorkspaceStatsCard({
          state,
          tasks,
          menuKey: section.menuKey,
          title: section.title
        })
      ])),
      creditOverview: buildCreditOverview(settings),
      creditMessages: buildCreditMessages(settings),
      networkMonitor: buildNetworkMonitor(state)
    }
  }

  function safeResolveUserName() {
    try {
      return os.userInfo().username || 'unknown'
    } catch (_error) {
      return 'unknown'
    }
  }

  function buildHostInfo() {
    const cpuList = os.cpus() || []

    return {
      systemName: os.hostname(),
      platformName: `${os.platform()} ${os.release()}`,
      architecture: os.arch(),
      cpuModel: cpuList[0]?.model || 'Unknown CPU',
      userName: safeResolveUserName(),
      runtimeName: `Node ${process.versions.node}`
    }
  }

  function buildSettingsSummary(settings = {}) {
    return {
      dashboardCreditState: settings.dashboardCreditState && typeof settings.dashboardCreditState === 'object'
        ? settings.dashboardCreditState
        : {
            text: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
            image: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' },
            video: { balanceCny: 0, lastSyncedAt: '', syncStatus: 'idle' }
          }
    }
  }

  function getSnapshot() {
    const {
      state,
      settings,
      tasks,
      exportItemsByMenu,
      derivedState
    } = buildBaseSnapshot()

    return {
      themeMode: settings.themeMode || 'dark',
      menuItems,
      productProjects: state.productProjects,
      activeProductProjectId: state.activeProductProjectId,
      projectRuns: hydrateProjectRunsForDisplay(state.projectRuns),
      activeProjectRunId: state.activeProjectRunId,
      formDrafts: pickStateMenuState(state.formDrafts),
      resultsByMenu: pickStateMenuState(hydrateResultsByMenuForDisplay(state.resultsByMenu)),
      exportItemsByMenu: pickStateMenuState(exportItemsByMenu),
      tasks,
      agentReadiness: buildAgentReadinessSnapshot(tasks),
      workspaceDashboard: buildWorkspaceDashboard(derivedState, tasks, settings),
      settingsSummary: buildSettingsSummary(settings),
      remoteServiceCapacity: settings.authPlatform?.remoteServiceCapacity || null,
      hostInfo: buildHostInfo()
    }
  }

  async function getDisplaySnapshot() {
    await refreshDashboardCredits({
      target: 'all'
    })
    const {
      state,
      settings,
      tasks,
      exportItemsByMenu,
      derivedState
    } = buildBaseSnapshot()

    return {
      themeMode: settings.themeMode || 'dark',
      menuItems,
      productProjects: state.productProjects,
      activeProductProjectId: state.activeProductProjectId,
      projectRuns: state.projectRuns,
      activeProjectRunId: state.activeProjectRunId,
      formDrafts: pickStateMenuState(state.formDrafts),
      resultsByMenu: pickStateMenuState(hydrateResultsByMenuForDisplay(state.resultsByMenu)),
      exportItemsByMenu: pickStateMenuState(exportItemsByMenu),
      tasks,
      agentReadiness: buildAgentReadinessSnapshot(tasks),
      workspaceDashboard: buildWorkspaceDashboard(derivedState, tasks, settings),
      settingsSummary: buildSettingsSummary(settings),
      remoteServiceCapacity: settings.authPlatform?.remoteServiceCapacity || null,
      hostInfo: buildHostInfo()
    }
  }

  function getRuntimeSnapshot() {
    const {
      state,
      settings,
      tasks,
      exportItemsByMenu
    } = buildBaseSnapshot()

    return {
      productProjects: state.productProjects,
      activeProductProjectId: state.activeProductProjectId,
      projectRuns: hydrateProjectRunsForDisplay(state.projectRuns),
      activeProjectRunId: state.activeProjectRunId,
      formDrafts: pickStateMenuState(state.formDrafts),
      resultsByMenu: pickStateMenuState(hydrateResultsByMenuForDisplay(state.resultsByMenu)),
      exportItemsByMenu: pickStateMenuState(exportItemsByMenu),
      tasks,
      agentReadiness: buildAgentReadinessSnapshot(tasks),
      remoteServiceCapacity: settings.authPlatform?.remoteServiceCapacity || null,
      settingsSummary: buildSettingsSummary(settings)
    }
  }

  return {
    getSnapshot,
    getDisplaySnapshot,
    getRuntimeSnapshot
  }
}

module.exports = {
  createWorkspaceSnapshotService
}
