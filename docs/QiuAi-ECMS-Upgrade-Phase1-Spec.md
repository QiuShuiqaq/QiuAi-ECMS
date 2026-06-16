# Spec: QiuAi 电商内容工作流升级（阶段一）

## Assumptions

1. 本阶段目标是把 QiuAi 从“电商生图桌面工具”升级为“电商内容生产桌面系统”，但暂不实现正式的平台自动上架。
2. 本阶段优先打通“商品信息 -> 标题 -> 描述 -> 图片 -> 导出”的主流程，视频能力作为阶段一的可插拔扩展，不强制和首版一起上线。
3. 当前桌面端仍然以 Windows 为主要运行环境，继续沿用 Electron + Vue 3 的本地桌面架构。
4. 当前仓库中的 `studio` 任务体系是后续升级的主干，不再回到旧的 `taskRunnerService / taskModeService` 作为正式主链路。
5. 后续会适配 OZON、Temu、TikTok Shop、亚马逊、速卖通等平台，因此现在就要采用“平台无关的商品发布数据模型”。

## Objective

QiuAi 当前主要解决电商商品图生成问题，但用户真实需求已经从“单点生图”升级为“整套电商内容生产”。阶段一的目标是把现有桌面应用升级为一个围绕单个商品项目运转的内容工作台，让用户能够在一个项目里完成：

- 录入商品基础信息与卖点
- AI 生成标题
- AI 生成描述
- AI 生成商品图
- 可选生成视频草稿或视频成品
- 统一预览、校对、导出

阶段一不是“做几个新按钮”，而是把产品核心对象从“图片任务”升级成“商品项目 / SKU 项目”。

### Target User

- 电商运营
- 电商设计
- 跨境上架助理
- 中小团队内容生产人员

### User Value

- 减少在多个工具之间切换
- 让商品标题、描述、图片风格保持一致
- 把内容生产结果沉淀为可复用的上架包
- 为后续自动化上架打基础

## Scope

### In Scope

- 商品项目工作台
- 商品基础信息录入
- 标题生成
- 描述生成
- 图片生成
- 统一任务队列与结果管理
- 项目级导出
- 为视频和平台适配预留扩展接口

### Limited Scope

- 视频能力允许先做成“第二子阶段”，即阶段一接口预留 + UI 预留 + 服务封装预留
- 平台自动上架本阶段只做数据结构和导出结构预留，不做正式执行器

### Out of Scope

- 正式接入 OZON / Temu / TikTok Shop / Amazon / AliExpress 的上架 API
- 模拟人工浏览器自动化上架
- 多账号后台管理系统
- 云端协同、多人在线项目协作

## Success Criteria

1. 用户能在桌面端创建一个“商品项目”，并在同一项目内管理商品信息、标题、描述、图片结果。
2. 用户能从同一份商品输入中连续触发标题生成、描述生成、图片生成，且每个结果都能回写到同一项目。
3. 用户能导出一个可交付的“上架包”，至少包含：
   - 标题文本
   - 描述文本
   - 图片目录
   - 结构化 `project.json`
4. 系统内部的数据结构不依赖某个平台字段命名，而是保留平台映射入口。
5. 在现有自动化测试基础上，为新增主流程补齐核心单测，且原有图片工作流不回归。

## Tech Stack

- Electron 30
- Vue 3
- Vite 5
- CommonJS for main process
- electron-store
- axios
- Vitest
- ESLint

## Commands

- Install: `npm.cmd install`
- Dev: `npm.cmd run dev`
- Test: `npm.cmd test`
- Lint: `npm.cmd run lint`
- Build renderer: `npm.cmd run build:renderer`
- Package Windows: `npm.cmd run package:win`

## Project Structure

- `main/`
  Electron 主进程入口、IPC 注册、本地服务、任务编排、数据持久化。
- `main/src/services/`
  业务服务层。阶段一升级的核心改动会主要落在这里。
- `main/src/ipc/`
  渲染层到主进程的接口边界。
- `renderer/src/`
  Vue 渲染层、工作台 UI、表单与结果展示。
- `renderer/src/components/`
  工作区、参数面板、结果区、项目侧边栏等组件。
- `shared/`
  主渲染共享常量，主要是 IPC channel。
- `tests/backend/`
  主进程服务与 IPC 测试。
- `tests/renderer/`
  前端结构与交互约束测试。
- `docs/`
  产品、技术文档与升级规格。

## Proposed Product Model

阶段一新增统一的“商品项目”概念，建议主数据结构如下：

```js
{
  id: 'project-001',
  name: '宠物饮水机-白色款',
  status: 'draft',
  platformTarget: ['temu', 'ozon'],
  baseInfo: {
    productName: '',
    brand: '',
    category: '',
    highlights: [],
    keywords: [],
    language: 'zh-CN'
  },
  assets: {
    sourceImages: [],
    generatedImages: [],
    generatedVideo: null
  },
  content: {
    titleCandidates: [],
    descriptionCandidates: [],
    selectedTitle: '',
    selectedDescription: ''
  },
  publishDraft: {
    attributes: {},
    variants: [],
    platformDrafts: {}
  },
  taskRefs: [],
  createdAt: '',
  updatedAt: ''
}
```

这个模型要作为后续平台适配层的基础，而不是直接使用某个平台字段。

## Proposed Workflow

阶段一建议围绕下面这条主链路实现：

1. 用户创建商品项目
2. 用户录入基础信息、卖点、关键词、素材图
3. 用户先生成标题候选
4. 用户再生成描述候选
5. 用户基于同一项目继续生成图片
6. 用户人工选择最终标题、描述、图片
7. 用户导出项目包

可选扩展步骤：

8. 用户生成视频脚本或视频成品

## Architecture Direction

### 1. Continue Using `studioWorkspaceService` as the Main Workflow Orchestrator

现有 `studioWorkspaceService` 已经具备以下能力：

- 草稿管理
- 任务创建
- 任务排队
- 结果持久化
- 导出结果
- 运行时清理

阶段一应该继续沿用它作为总编排层，而不是新起一套平行系统。

### 2. Split Generation Capabilities by Content Type

建议把生成能力抽象成三类服务：

- `projectTextGenerationService`
- `projectImageGenerationService`
- `projectVideoGenerationService`

当前图片能力可继续复用 `studioImageGenerationService`。
当前文案能力可吸收 `copywritingGenerationService` 和 `chatCompletionService`。
视频能力先只定义接口和结果结构。

### 3. Upgrade Result Structure from “Image Result” to “Project Result”

当前系统虽然已经支持 `textResults`，但前端显示仍主要面向图片结果。阶段一需要把结果视图升级为：

- 标题结果区
- 描述结果区
- 图片结果区
- 导出包区

## Code Style

继续遵守现有仓库风格：

- 主进程使用 CommonJS
- 少用全局状态，优先通过 service 注入依赖
- 结果结构统一做 normalize
- 异步流程优先封装在 service 层，不把复杂逻辑堆在 IPC 或 Vue 组件里

示例风格：

```js
async function createTask({ menuKey = 'workspace', draft: incomingDraft } = {}) {
  const state = getStoredState()
  const draft = normalizeDraftForMenu(menuKey, {
    ...(state.formDrafts[menuKey] || {}),
    ...(incomingDraft || {})
  })

  validateTaskScale(menuKey, draft)
  return persistTaskAndState({ task: buildQueuedTaskSummary({ menuKey, draft }) })
}
```

## Testing Strategy

- 测试框架：Vitest
- 主进程服务测试放在 `tests/backend/`
- 渲染层结构与约束测试放在 `tests/renderer/`
- 优先覆盖以下层级：
  - 数据模型 normalize
  - 项目任务编排
  - 文案生成 service
  - 导出 service
  - IPC 接线
  - 页面结构关键约束

阶段一新增能力至少补齐：

- 商品项目默认状态测试
- 标题生成结果归档测试
- 描述生成结果归档测试
- 项目导出包结构测试
- UI 菜单与结果区新增模块测试

## Boundaries

### Always

- 复用现有 `studio` 任务体系，不平行造第二套调度系统
- 新增能力必须通过 service + IPC + renderer 分层接入
- 所有结果都要可持久化、可恢复、可导出
- 新功能必须补测试，且保留原有图片链路能力

### Ask First

- 引入新的远程供应商 SDK
- 大改现有授权体系
- 引入数据库或云同步
- 直接重写现有 UI 信息架构
- 把视频能力强行做进首版必经流程

### Never

- 为了快速上线把标题、描述、图片结果拆成三套互不关联的本地状态
- 把平台字段直接写死在核心项目模型里
- 绕过现有任务队列直接在渲染层发远程请求
- 删除现有图片能力或破坏已有导出能力

## Risks

1. 如果直接把视频并入首版主链路，任务时长和失败率会明显上升。
2. 如果继续沿用“菜单 = 能力模块”的旧心智，后期会很难转成“商品项目 = 工作对象”。
3. 如果不先定义平台无关模型，第二阶段平台适配会被字段差异拖垮。
4. 如果标题、描述、图片仍然分散在不同草稿结构里，后续很难做一键导出和自动上架。

## Open Questions

1. 阶段一首版是否要把“视频生成”做成真实可用功能，还是只做接口预留与 UI 占位？
2. 阶段二平台优先级是否确定为：`OZON -> Temu -> TikTok Shop -> Amazon -> AliExpress`？
3. 商品项目是否需要“多语言”作为阶段一首版字段？
4. 描述输出是否要区分：
   - 简短卖点描述
   - 详情长描述
   - 平台 bullet points
5. 图片生成是否要继续保留当前四个菜单，还是逐步收敛为“项目内图片任务模板”？
