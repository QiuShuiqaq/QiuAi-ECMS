# QiuAi 当前结构复盘与桌面端/服务端对接结论

## 1. 这份文档解决什么问题

这份文档只回答四件事：

1. 当前 `QiuAi` 桌面端和 `qiu-commerce-license-platform` 服务端，真实生效的职责边界是什么。
2. 当前主链路是否已经打通，哪些链路已经不是旧方案。
3. 这轮桌面端瘦身后，哪些重复/失效结构已经被移除。
4. 现在还剩哪些风险点，需要继续清理，但不会阻塞当前继续开发和联调。

这不是理想架构文档，也不是未来规划文档。它只描述 2026-06-21 这版代码的真实现状。

## 2. 当前系统边界

### 2.1 桌面端负责什么

桌面端仓库：`QiuAi`

当前桌面端主要负责：

- 用户激活入口和会话承接
- 软件套餐、算力包、充值的购买入口
- 工作台项目编辑和生成任务创建
- 本地运行态展示
- 结果下载、导出、打开目录

当前桌面端不再承担“业务真相源”。它更接近三层角色：

- 渲染层交互壳
- Electron IPC 壳
- 本地结果和任务展示壳

### 2.2 服务端负责什么

服务端仓库：`qiu-commerce-license-platform`

当前服务端主要负责：

- 激活和 `sessionToken` 颁发
- 软件授权、订单、支付状态
- 钱包余额和算力包
- 远程服务能力档位
- 远程生成任务创建、排队、状态查询、产物下载地址

服务端现在已经是以下几个领域的真相源：

- 授权真相源
- 钱包真相源
- 套餐和服务能力真相源
- 远程生成任务真相源

## 3. 当前真实主链路

### 3.1 激活链路

链路如下：

1. 渲染层调用 `renderer/src/services/desktopBridge.js`
2. 通过 `LICENSE_REMOTE_ACTIVATE` 进入 `main/src/ipc/licenseIpc.js`
3. 主进程调用 `main/src/services/qiuAiLicensePlatformClientService.js`
4. 请求服务端激活接口
5. 服务端返回激活结果和会话信息
6. 主进程把授权状态写入本地 `settingsService`

结论：

- 当前激活主链路已经是“服务端优先”
- 本地 legacy license 只剩兼容意义，不是主链路

### 3.2 购买链路

当前桌面端已对接三类购买：

- 软件套餐
- 算力包
- 充值

桌面端职责是：

- 创建订单
- 拉起支付页或展示支付载荷
- 轮询订单状态

订单状态和支付状态以服务端返回为准，桌面端不保存业务真相。

### 3.3 远程能力链路

桌面端当前会读取两类远程状态：

- `walletSummary`
- `remoteServiceCapacity`

这些数据用于：

- 展示钱包余额
- 展示当前服务能力档位
- 给工作台估算并发和任务能力边界

### 3.4 远程生成链路

当前远程生成不是渲染层直连服务端，而是：

1. 渲染层创建 studio task
2. Electron 主进程 `studioWorkspaceService` 编排任务
3. `cloudGenerationService` 决定走远程还是本地兼容路径
4. 主进程请求服务端创建生成任务
5. 主进程按服务端建议节奏轮询状态
6. 主进程下载产物或接收产物信息
7. 主进程把结果落到本地输出目录
8. 渲染层只展示本地结果和导出入口

结论：

- 文本、图片、视频已经具备走服务端主链路的基础
- 渲染层没有直接持有远程业务逻辑
- 主进程仍然是桌面端和服务端之间唯一可信编排层

## 4. 这轮瘦身已经完成的内容

### 4.1 已移除的桌面端死链路

本轮之前，已经完成以下大块清理：

- 删除旧页面和旧组件入口，如 `GenerationPage.vue`、`SettingsPage.vue`
- 删除旧本地任务链路，如 `drawIpc.js`、`taskIpc.js`、`taskRunnerService.js`
- 删除旧壳层方法，如 `saveProviderApiKeys`、`createProjectsFromAssets`、`refreshDashboardCredits`
- 主导航已收缩为工作台为主，不再把旧生成页作为一级入口

### 4.2 本轮新增完成的清理

本轮新增完成的是“渲染层旧设置桥接链路”清理：

- 删除 `renderer/src/services/desktopBridge.js` 中已无页面使用的 `getSettings` / `saveSettings`
- 删除对应的 `SETTINGS_GET` / `SETTINGS_SAVE` IPC 通道
- 删除 `main/src/ipc/settingsIpc.js`
- 删除 `main/preload.js` 和 `shared/ipcChannels.js` 中对应暴露
- 删除 `main/src/bootstrap/registerIpc.js` 中对应注册

同时保留了浏览器模式下仍然需要的最小兜底能力：

- `getStudioSnapshot()`
- `saveStudioDraft()`
- `settingsSummary` 的轻量默认结构

这意味着：

- 渲染层不再维护一套独立的“浏览器设置系统”
- 工作台浏览器兜底模式仍可正常工作
- 主进程真实 `settingsService` 未被误删，远程生成兼容链路仍然可用

## 5. 当前活跃结构判断

### 5.1 桌面端当前活跃主结构

当前最重要的活跃链路如下：

- `renderer/src/App.vue`
  负责应用壳、菜单、快照装载、主题切换、页面切换
- `renderer/src/services/desktopBridge.js`
  负责渲染层到 Electron IPC 的唯一桥接
- `main/src/ipc/licenseIpc.js`
  负责授权和远程激活 IPC
- `main/src/ipc/studioIpc.js`
  负责工作台相关 IPC
- `main/src/services/qiuAiLicensePlatformClientService.js`
  负责主进程到服务端 HTTP 客户端
- `main/src/services/cloudGenerationService.js`
  负责远程生成适配
- `main/src/services/studioWorkspaceService.js`
  负责工作台状态、任务、结果、快照编排

结论：

- 结构已经比早期版本清晰很多
- 当前继续开发，应该围绕这条主链路继续收敛，而不是重新推翻

### 5.2 当前服务端对桌面端的接口形态

桌面端当前依赖的是一组“平台 API”，而不是后台管理 API。

这很关键，因为这代表：

- 桌面端边界已经明确
- 服务端内部继续重构时，只要平台 API 契约稳定，桌面端不需要跟着大改

## 6. 本轮验证结果

本轮已经完成以下验证：

- 定向测试通过
- 全量测试通过
- 渲染层构建通过

具体结果：

- `npm.cmd test` 通过：`46` 个测试文件，`115` 个测试用例
- `npm.cmd run build:renderer` 通过

因此可以确认：

- 本轮删除的设置桥接链路没有破坏桌面端/主进程契约
- 当前桌面端主链路仍可继续迭代

## 7. 还存在但暂时不阻塞的风险点

### 7.1 仍有旧文本生成能力残留为内部路由

当前虽然一级导航已经收缩，但以下旧能力还以内部能力形式存在：

- `title-generator`
- 相关 draft / export / snapshot 兼容映射

这不是立即故障，但说明“工作台唯一主入口”还没有彻底收口。

### 7.2 主进程本地 Provider 配置残留已清理

本轮之后，主进程 `settingsStoreService` 已不再向运行态暴露以下旧字段：

- `apiKeys`
- `apiKey`
- `activeApiKeyIndex`
- `providerApiKeys`
- `apiBaseUrl`

同时，以下仅服务于旧本地 Provider 余额链路的文件也已删除：

- `providerApiKeyService.js`
- `deepseekBalanceService.js`

这意味着当前桌面端主链路已经进一步收紧为“服务端优先”：

- 授权和会话由服务端提供
- 钱包余额由服务端提供
- 服务能力档位由服务端提供
- 文本、图片、视频生成由服务端任务链路提供

当前这部分不再是运行态风险，剩余风险主要转移为：

- 历史文档仍引用旧字段和旧设计
- 个别内部旧菜单键和兼容映射仍待继续收口

### 7.3 技术文档仍有少量历史描述未更新完全

这轮已经修掉了一部分，但文档层面仍然存在历史阶段信息。

后面继续清理时，文档要跟代码同步，否则你会继续被旧说明误导。

## 8. 当前工程结论

可以给出三个明确判断：

1. 当前版本不是“桌面端和服务端还没真正打通”的状态。
2. 当前版本已经具备“继续围绕主链路做桌面端瘦身和精细化升级”的基础。
3. 现在最重要的工作不是重新设计联通方式，而是继续清掉残余旧生成入口、旧兼容映射和主进程内不再必要的本地生成依赖。

## 9. 下一步建议顺序

建议继续按这个顺序推进：

1. 先做结构复盘后的第二轮清理：聚焦 `title-generator` 等内部残余入口和重复业务流。
2. 再审计主进程本地生成兼容链路，判断哪些必须保留，哪些可以转交服务端。
3. 最后做一次“桌面端主流程回归 + 服务端契约回归”，把这版定为稳定联通基线。

当前可以继续往下做，不需要回头重做联通方案。
