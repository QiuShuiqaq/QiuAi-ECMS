# Plan: QiuAi 桌面端瘦身与架构收口 v1

## Overview

这个计划对应 [QiuAi-ECMS-Desktop-Optimization-Spec-v1.md](f:\Workspace_VS\QiuAi-ECMS\QiuAi\docs\QiuAi-ECMS-Desktop-Optimization-Spec-v1.md)。

目标不是继续往现有桌面端叠加功能，而是先把产品结构和工程边界收紧，让 `QiuAi` 变成一套适合正式售卖和持续开发的客户端。

本轮实施顺序遵循两个原则：

1. 先做低风险、高收益、能立刻减复杂度的产品瘦身。
2. 再做会影响服务端联调稳定性的关键架构收口。

## Architecture Decisions

- 生成真相统一收口到服务端，客户端只保留体验层和文件层职责。
- 工作台是唯一主生产入口，其它生成页进入迁移态或直接退出主导航。
- 终端用户不再以正式产品路径配置第三方 provider API key。
- 工作区大服务必须拆分，不再继续扩展单个超大 orchestrator。
- 旧 `draw/task` 体系不再作为默认主路径，仅迁移保留，不继续演化。

## Recommended Delivery Order

### Phase 1: 产品瘦身与主导航收口

先把主界面复杂度降下来，避免后续架构改造还要兼容太多低价值页面。

### Phase 2: 平台接入与会话收口

处理平台地址动态生效、会话存储、敏感信息边界，为后续正式联调建立稳定基础。

### Phase 3: 云端生成链路 fail-closed

关闭“服务端失效时偷偷回退本地正式生成”的混合行为，确保并发、套餐、计费、任务状态统一。

### Phase 4: 工作区服务拆分

在主路径已经稳定的前提下，把大服务拆分成可继续开发的模块。

### Phase 5: 旧任务链路退役

清理旧入口和默认运行链路，把主产品彻底切到统一工作区模型。

## Task List

### Phase 1: 产品瘦身与主导航收口

#### Task 1: 收缩主导航并移除低价值一级入口

**Description:**  
把当前 10 项主导航收缩为目标结构，至少先完成主 UI 层面的入口裁剪。

**Acceptance criteria:**
- [ ] 主导航一级入口不超过 5 项
- [ ] `product-template` 不再出现在主导航
- [ ] `model-pricing` 不再出现在主导航
- [ ] `model-config` 不再出现在终端用户主导航

**Verification:**
- [ ] 手动检查主界面导航结构
- [ ] 渲染层相关测试通过
- [ ] `npm test`

**Dependencies:** None

**Files likely touched:**
- `renderer/src/App.vue`
- `renderer/src/components/WorkspaceSidebar.vue`
- `tests/renderer/*`

**Estimated scope:** Medium

#### Task 2: 合并生成页心智到工作台

**Description:**  
把标题、描述、套图、视频从“独立业务入口”调整为“工作台中的能力入口”，先做导航和入口收口，不要求一次完成底层全重构。

**Acceptance criteria:**
- [ ] 主导航中不再同时突出 4 个独立生成页作为核心工作路径
- [ ] 工作台可继续承接打开对应能力的入口
- [ ] 旧生成页如果保留，仅作为迁移页或内部入口，不再主导产品结构

**Verification:**
- [ ] 手动从工作台进入主要生成流程
- [ ] 相关 renderer 测试通过

**Dependencies:** Task 1

**Files likely touched:**
- `renderer/src/App.vue`
- `renderer/src/components/ProductWorkbench.vue`
- `renderer/src/components/GeneratorStudioPage.vue`
- `tests/renderer/*`

**Estimated scope:** Medium

#### Task 3: 收口数据页和购买页结构

**Description:**  
将 `data-center` 收口为“账户与用量”视图，将模型价格信息并入购买中心或说明区域。

**Acceptance criteria:**
- [ ] `data-center` 不再作为独立旧概念暴露
- [ ] 模型价格信息不再占用独立主页面
- [ ] 购买中心仍然可用

**Verification:**
- [ ] 手动检查购买中心和账户页
- [ ] `npm test`

**Dependencies:** Task 1

**Files likely touched:**
- `renderer/src/App.vue`
- `renderer/src/components/DataCenterPage.vue`
- `renderer/src/components/PurchaseCenterPage.vue`
- `tests/renderer/*`

**Estimated scope:** Medium

### Checkpoint: Phase 1

- [ ] 主导航已瘦身
- [ ] 用户主路径收敛为工作台 + 购买中心 + 账户/提示词/设置
- [ ] 没有明显 broken route
- [ ] `npm test` 通过

### Phase 2: 平台接入与会话收口

#### Task 4: 引入统一平台 gateway，修复 baseUrl 固化问题

**Description:**  
改造平台客户端访问方式，避免启动时固定 baseUrl，保证后续切换测试/正式环境时可立即生效。

**Acceptance criteria:**
- [ ] 修改平台地址后新请求使用新地址
- [ ] 不需要重启应用才能让平台地址变更生效
- [ ] 平台请求通过统一 gateway 或工厂路径获取最新配置

**Verification:**
- [ ] 新增 backend test 覆盖 baseUrl 切换
- [ ] `npm test`

**Dependencies:** Phase 1 complete

**Files likely touched:**
- `main/src/bootstrap/registerIpc.js`
- `main/src/services/qiuAiLicensePlatformClientService.js`
- `main/src/services/settingsStoreService.js`
- `tests/backend/test_qiuai_license_platform_client_service.test.js`

**Estimated scope:** Medium

#### Task 5: 收口 sessionToken 存储边界

**Description:**  
把 `sessionToken` 从普通 settings 逻辑中拆出，进入受保护存储或受保护访问接口。

**Acceptance criteria:**
- [ ] 普通 settings 快照不再承担会话真相
- [ ] 登录后会话可恢复
- [ ] 会话失效时客户端状态明确

**Verification:**
- [ ] 新增 backend test 覆盖会话读写
- [ ] `npm test`

**Dependencies:** Task 4

**Files likely touched:**
- `main/src/services/settingsStoreService.js`
- `main/src/ipc/licenseIpc.js`
- `main/src/services/authorizationService.js`
- `tests/backend/test_authorization_service.test.js`
- `tests/backend/test_settings_store_service.test.js`

**Estimated scope:** Medium

### Checkpoint: Phase 2

- [ ] 平台地址动态切换生效
- [ ] 会话边界清晰
- [ ] 授权相关回归测试通过

### Phase 3: 云端生成链路 fail-closed

#### Task 6: 关闭正式云端能力的静默本地回退

**Description:**  
对服务端统一治理的能力，在远程不可用时显式报错，不再偷偷走本地正式生成逻辑。

**Acceptance criteria:**
- [ ] 图片/视频/文本的正式云端链路不再静默本地回退
- [ ] 错误能反馈到 UI
- [ ] 迁移期兼容逻辑有明确边界

**Verification:**
- [ ] 新增 backend test 覆盖 remote unavailable 场景
- [ ] 手动验证错误提示
- [ ] `npm test`

**Dependencies:** Phase 2 complete

**Files likely touched:**
- `main/src/services/cloudGenerationService.js`
- `main/src/services/studioWorkspaceService.js`
- `tests/backend/test_studio_workspace_service.test.js`
- `tests/backend/test_*cloud*`

**Estimated scope:** Medium

#### Task 7: 调整默认轮询策略，优先 server advice

**Description:**  
把客户端轮询从高频默认拉低，严格优先服务端 `pollingAdvice`。

**Acceptance criteria:**
- [ ] 有 `pollingAdvice` 时严格遵从
- [ ] 无 advice 时图片/文本不少于 10 秒，视频不少于 15 秒
- [ ] 不再存在默认 3 秒级轮询

**Verification:**
- [ ] 新增 backend test 覆盖 polling interval 计算
- [ ] `npm test`

**Dependencies:** Task 6

**Files likely touched:**
- `main/src/services/cloudGenerationService.js`
- `tests/backend/*cloud*`

**Estimated scope:** Small

### Checkpoint: Phase 3

- [ ] 正式云端链路 fail-closed
- [ ] 轮询频率收口
- [ ] 不会破坏工作台任务提交流程

### Phase 4: 工作区服务拆分

#### Task 8: 抽离项目与结果服务

**Description:**  
先从 `studioWorkspaceService` 中抽出项目管理和结果管理职责，减少大服务体积。

**Acceptance criteria:**
- [ ] 新增独立项目服务和结果服务
- [ ] `studioWorkspaceService` 明显缩小
- [ ] 现有工作台流程不回归

**Verification:**
- [ ] `npm test`
- [ ] 手动验证工作台项目与结果操作

**Dependencies:** Phase 3 complete

**Files likely touched:**
- `main/src/services/studioWorkspaceService.js`
- `main/src/services/*workspace*.js`
- `tests/backend/test_studio_workspace_service.test.js`

**Estimated scope:** Large

#### Task 9: 抽离任务与用量服务

**Description:**  
继续把任务编排和用量摘要从大服务中抽离。

**Acceptance criteria:**
- [ ] 任务与用量职责拆出
- [ ] 工作区主服务只保留装配层角色
- [ ] 现有快照接口保持可用

**Verification:**
- [ ] `npm test`
- [ ] 手动检查 runtime snapshot / display snapshot

**Dependencies:** Task 8

**Files likely touched:**
- `main/src/services/studioWorkspaceService.js`
- `main/src/services/*workspace*.js`
- `tests/backend/test_studio_workspace_service.test.js`

**Estimated scope:** Large

### Checkpoint: Phase 4

- [ ] 不再依赖单个超大 service 持续开发
- [ ] 工作台主流程测试仍通过

### Phase 5: 旧任务链路退役

#### Task 10: 从主产品路径移除旧 draw/task 体系

**Description:**  
让旧 `draw/task` 链路退出主 UI 和默认执行链路，只保留必要兼容或彻底删除。

**Acceptance criteria:**
- [ ] 主 UI 无旧任务入口
- [ ] 默认运行链路不再使用 `taskRunnerService`
- [ ] 旧链路状态有文档说明

**Verification:**
- [ ] 手动检查主路径
- [ ] 相关 backend/renderer 测试通过

**Dependencies:** Phase 4 complete

**Files likely touched:**
- `main/src/ipc/taskIpc.js`
- `main/src/services/taskRunnerService.js`
- `renderer/src/App.vue`
- `shared/ipcChannels.js`
- `tests/backend/*task*`

**Estimated scope:** Medium

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 导航瘦身后打断当前用户路径 | High | 先保留迁移入口，再逐步移除旧入口 |
| 平台地址/会话改造引入授权回归 | High | 先补测试，再改主路径 |
| fail-closed 改造导致部分旧本地流程不可用 | Medium | 明确区分正式云端能力和迁移态本地能力 |
| 工作区服务拆分过大导致回归难查 | High | 先拆项目/结果，再拆任务/用量，分两步进行 |
| 旧任务系统删除过早 | Medium | 先移出主路径，再决定是否物理删除 |

## Open Questions

- 是否保留隐藏调试入口来承接迁移期模型配置能力。
- 是否在本轮同步彻底移除离线 license 导入路径。
- 是否需要在桌面端增加“当前连接环境”展示，帮助区分测试服和正式服。
