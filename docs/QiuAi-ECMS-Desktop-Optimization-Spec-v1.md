# Spec: QiuAi 桌面端瘦身与架构收口 v1

## Assumptions

1. 本轮目标是把 `QiuAi` 从“历史阶段叠加后的混合型桌面工具”收口成“可稳定售卖的桌面客户端”。
2. 平台服务端已经成为授权、套餐、钱包、算力、并发、生成任务、结果下载的唯一业务真相源。
3. 桌面端继续保留本地项目、草稿、结果文件、导出包和操作体验，但不再承担计费、并发控制、上游 API 调度真相。
4. 当前主要运行环境仍然是 Windows + Electron，不在本轮引入多端同步或云端工作区。
5. 本轮先聚焦桌面端仓库 `QiuAi`，服务端只做必要的契约配合，不在本 spec 内大改支付或后台页面。
6. 本轮优先级高于新功能开发，先做“瘦身、边界收紧、可持续开发”，再继续扩展桌面能力。

## Objective

把当前桌面端整理为一套边界清晰、功能收口、可持续迭代的商用客户端。

本轮要同时解决两类问题：

- 产品层问题：历史阶段反复叠加后，导航过多、功能重复、低价值页面残留、用户心智分散。
- 工程层问题：本地生成与云端生成混杂、旧任务链路与新工作区并存、主服务过大、配置与凭据管理不适合正式售卖。

本轮完成后，桌面端应满足：

- 用户只需要理解一条主线：登录/授权 -> 购买权益 -> 创建项目 -> 提交生成 -> 下载结果。
- 生成相关能力统一走服务端规则，不再出现“客户端悄悄绕过平台规则”的情况。
- 客户端职责收口，只做本地体验层、项目组织层和结果消费层。
- 后续再开发桌面端功能时，不需要反复兼容过多历史包袱。

## Current Problems

### 1. 产品面问题

- 主导航项过多，当前包含：
  - `workspace`
  - `data-center`
  - `product-template`
  - `title-generator`
  - `description-generator`
  - `series-generate`
  - `video-generate`
  - `model-pricing`
  - `prompt-library`
  - `model-config`
- 其中存在明显重复心智：
  - 工作台已经具备项目化生成入口，但标题、描述、套图、视频仍作为独立主页面存在。
  - 模型价格、模型配置、购买中心、数据中心之间存在概念重叠。
- 一些页面是历史阶段产物，不再适合正式商用版长期保留：
  - `product-template`
  - 面向终端用户的 `model-config`
  - 单独的 `model-pricing`

### 2. 架构面问题

- 客户端仍存在“本地直连能力”和“服务端统一能力”并存的混合结构。
- 云端不可用时，部分生成能力会直接回退到本地逻辑，这会破坏授权、套餐、并发、计费的一致性。
- 平台地址在启动时创建服务实例，后续修改配置不一定真正生效。
- `studioWorkspaceService.js` 体量过大，当前已经超过 4000 行，后续继续开发会越来越难维护。
- 旧任务链路仍然存在：
  - `localTaskStoreService`
  - `taskRunnerService`
  - 旧 `draw` 任务逻辑
- 本地仍保留一些不适合商用正式版的职责：
  - 本地积分台账真相
  - 本地 provider API key 管理
  - 本地 provider 余额查询心智
  - 旧离线 license 兼容路径

### 3. 安全面问题

- `sessionToken` 仍按普通本地配置对待，不符合正式售卖客户端的凭据保护要求。
- 上游 provider 的 API key 仍然出现在桌面端配置模型中，不符合后续“服务端统一发号与调度”的方向。

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- Lint: `npm run lint`
- Build renderer: `npm run build:renderer`
- Package Windows: `npm run package:win`

## Project Structure

- `main/src/bootstrap/`
  - Electron 主进程启动与 IPC 注册入口
- `main/src/ipc/`
  - 渲染层到主进程的接口边界
- `main/src/services/`
  - 主进程业务服务层
  - 本轮重点关注：
    - `authorizationService.js`
    - `qiuAiLicensePlatformClientService.js`
    - `cloudGenerationService.js`
    - `studioWorkspaceService.js`
    - `settingsStoreService.js`
- `renderer/src/App.vue`
  - 当前导航、主壳层和多个页面装配入口
- `renderer/src/components/`
  - 工作台、生成页、数据页、配置页等视图组件
- `shared/`
  - IPC channel 和共享常量
- `tests/backend/`
  - 主进程服务和 IPC 相关测试
- `tests/renderer/`
  - 渲染层结构和交互测试
- `docs/`
  - 规格、计划、技术说明文档

## Code Style

延续当前仓库的 CommonJS + 工厂函数 + 依赖注入风格，但要进一步收紧职责边界。

示例：

```js
function createGenerationGateway({ platformClient, sessionStore }) {
  async function submitJob(payload) {
    const sessionToken = await sessionStore.getSessionToken()
    if (!sessionToken) {
      throw new Error('Session is required.')
    }

    return platformClient.createGenerationJob({
      ...payload,
      sessionToken
    })
  }

  return {
    submitJob
  }
}

module.exports = {
  createGenerationGateway
}
```

约束：

- 服务对象必须单一职责，不再接受“大而全”的超级 service 持续膨胀。
- IPC handler 只做参数接收和服务调用，不写业务真相。
- 不允许页面组件直接决定平台并发、计费、能力真相。
- 不允许为了兼容旧路径继续堆叠 `if local / else remote` 这种长期分叉。

## Testing Strategy

- 单元测试：
  - 授权状态映射
  - 平台客户端请求封装
  - 会话存储与凭据保护
  - 生成模式矩阵
  - 轮询策略与服务端 advice 处理
- 集成测试：
  - 登录/授权后获取能力快照
  - 从工作台创建项目并发起生成
  - 任务状态刷新
  - 结果下载与导出
- 回归测试：
  - 购买中心链路
  - 提示词库
  - 工作台项目草稿恢复
- 本轮必须新增的测试重点：
  - “云端不可用时不再静默回退到本地生成”
  - “修改平台地址后新请求使用新地址”
  - “旧任务链路不再从主 UI 入口可达”

## Boundaries

- Always:
  - 服务端为授权、权益、并发、计费、任务状态的唯一真相源
  - 桌面端只保存本地体验所需状态，不保存业务主账
  - 任何新功能优先挂接到统一工作区任务模型
  - 任何敏感凭据必须走受保护存储
  - 所有生成轮询必须遵循服务端 advice，客户端只做保底退避

- Ask first:
  - 新增依赖
  - 修改服务端 API 契约
  - 删除旧测试
  - 彻底移除旧离线 license 导入能力

- Never:
  - 在桌面端继续保留第三方 provider 的正式生产 API key 作为默认运行前提
  - 让正式商用路径依赖本地积分账本
  - 让正式云端能力在失败时静默回退本地直连
  - 在未明确标记迁移期的情况下继续扩展旧任务系统

## Target Product Model

### 1. 主导航收口

目标主导航压缩到不超过 5 个一级入口：

- `工作台`
- `购买中心`
- `提示词库`
- `账户与用量`
- `设置与支持`

当前页面到目标结构的映射：

| 当前页面 | 目标处理 |
|---|---|
| `workspace` | 保留，升级为唯一主生产入口 |
| `data-center` | 并入 `账户与用量` |
| `product-template` | 删除 |
| `title-generator` | 并入 `工作台` 内部能力页 |
| `description-generator` | 并入 `工作台` 内部能力页 |
| `series-generate` | 并入 `工作台` 内部能力页 |
| `video-generate` | 并入 `工作台` 内部能力页 |
| `model-pricing` | 并入 `购买中心` 或产品说明，不再单独导航 |
| `prompt-library` | 保留 |
| `model-config` | 对终端用户移除，必要时变成内部/调试页 |

### 2. 工作台成为唯一生成入口

工作台负责：

- 商品项目创建
- 标题/描述/套图/视频任务组织
- 任务提交
- 运行状态查看
- 结果下载与导出

标题、描述、套图、视频不再各自拥有独立业务真相，只保留为：

- 工作台中的能力面板
- 或迁移期兼容入口，但必须复用同一提交链路和同一结果模型

### 3. 账户与用量收口

终端用户只应看到：

- 当前登录状态
- 生效套餐/服务档位
- 钱包摘要
- 算力余额或配额摘要
- 最近任务与错误提示

终端用户不应再看到：

- 第三方 provider 余额真相
- 本地积分账本真相
- 自己配置第三方 provider key 的正式流程

## Functional Slimming Decisions

### 保留

- 工作台项目制流程
- 购买中心
- 提示词库
- 结果导出
- 本地项目草稿和结果缓存
- 登录/授权/会话恢复

### 合并

- 标题生成、描述生成、套图生成、视频生成
  - 合并为工作台内部能力
- 数据中心
  - 合并为账户与用量视图
- 模型价格
  - 合并到购买中心或帮助说明

### 删除

- `product-template` 演示型页面
- 面向终端用户开放的 `model-config`
- 单独的 `model-pricing` 一级页面

### 迁移期保留但禁止继续扩展

- 旧离线 license 导入路径
- 旧本地 draw/task 链路
- 本地 provider 余额相关能力

## Target Architecture Boundaries

### 桌面端负责

- 会话建立与恢复
- 本地项目、草稿、下载结果、导出包管理
- 任务提交体验
- 任务状态展示
- 文件下载和本地打开
- 基于服务端返回能力的界面约束

### 服务端负责

- 用户身份真相
- 授权真相
- 套餐与服务能力真相
- 并发与排队控制
- 第三方 provider key 分配与调度
- 计费、冻结、扣减、结算
- 任务生命周期真相

### 明确禁止的客户端职责

- 自己决定图片/视频真实并发上限
- 自己维护正式计费账本
- 自己轮换正式生产 provider key
- 自己在服务端不可用时切换成正式本地生成链路

## Technical Refactor Scope

### 1. 平台客户端改造

目标：

- 平台地址不在应用启动时固化
- 每次请求都从当前有效配置或统一 gateway 读取目标地址
- 平台请求统一经过一层桌面端 gateway

验收标准：

- 修改平台地址后，不重启应用也能对新地址发请求
- 相关测试覆盖地址切换场景

### 2. 会话与敏感信息改造

目标：

- `sessionToken` 不再按普通配置明文逻辑处理
- 使用 Electron 安全能力存储敏感值
- `electron-store` 只保留非敏感展示信息

验收标准：

- 普通 settings 快照中不再直接承担会话真相
- 会话丢失和恢复路径可测

### 3. 云端生成链路收口

目标：

- 正式商用能力统一走服务端
- 对服务端依赖的能力失败时必须显式报错，不静默回退
- 客户端轮询必须优先使用服务端 `pollingAdvice`

默认轮询策略：

- 如果服务端返回 `pollingAdvice`，严格使用
- 如果服务端没有返回：
  - 图片任务不低于 10 秒
  - 视频任务不低于 15 秒
  - 文本任务不低于 10 秒
- 不再使用 3 秒级默认高频轮询

验收标准：

- 远程能力不可用时，用户能看到明确错误，不会偷偷切到本地正式链路
- 同一任务在高并发场景下不会出现 3 秒一次的客户端轮询风暴

### 4. 工作区服务拆分

目标：

- 将 `studioWorkspaceService.js` 拆成多个明确服务：
  - `workspaceProjectService`
  - `workspaceTaskService`
  - `workspaceResultService`
  - `workspaceUsageService`
  - `workspaceExportService`
- `App.vue` 只保留视图装配和状态编排，不继续膨胀为业务中心

验收标准：

- 不再存在单个 4000+ 行的核心 orchestrator
- 工作区主要流程仍通过测试

### 5. 旧任务系统退役

目标：

- 旧 `draw/task` 体系退出主产品路径
- 新工作台任务模型成为唯一默认任务模型

验收标准：

- 主 UI 不再提供旧任务入口
- 旧 `taskRunnerService` 和相关 IPC 不再是默认运行链路
- 删除或标记废弃的代码路径有文档记录

## Success Criteria

满足以下条件，视为本轮 spec 成功：

1. 主导航从当前 10 项压缩到不超过 5 项。
2. 工作台成为唯一主生成入口，标题/描述/套图/视频不再各自维护独立业务真相。
3. 服务端依赖能力不再静默回退到本地正式生成链路。
4. 终端用户不再通过正式 UI 配置第三方 provider API key。
5. 会话凭据不再按普通设置项处理。
6. 旧任务系统退出主路径，旧页面和重复功能完成裁剪。
7. `studioWorkspaceService` 完成职责拆分，后续功能开发可按模块继续推进。
8. 桌面端与服务端的链路变成：
   - 登录/授权
   - 获取能力
   - 提交任务
   - 服务端排队
   - 服务端产出结果
   - 客户端下载结果

## Phased Delivery

### Phase 1: 产品瘦身

- 删除低价值页面
- 合并导航
- 明确保留/迁移/删除清单

### Phase 2: 架构收口

- 平台 gateway 改造
- 会话存储改造
- 云端生成 fail-closed 改造
- 轮询降频与 server advice 化

### Phase 3: 核心服务拆分

- 拆分工作区大服务
- 退役旧任务链路
- 统一任务与结果模型

### Phase 4: 稳定性验证

- 全链路测试
- 回归测试
- 打包验证

## Open Questions

- 是否保留“迁移期隐藏调试页”来承接模型配置与兼容诊断，而不是立即物理删除全部旧 UI。
- 是否在本轮同步完成旧离线 license 彻底下线，还是仅先从主入口移除。
