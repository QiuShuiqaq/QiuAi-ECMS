# Spec: QiuAi 电商 Agent 工作台升级

## Assumptions

1. 当前阶段的核心目标不是做“自动上架系统”，而是先把 QiuAi 升级成一个稳定的电商内容生产工作台。
2. `工作台` 会成为主入口，负责围绕“项目任务”组织标题、描述、套图、视频的一整套生成流程。
3. `标题生成`、`描述生成`、`套图生成`、`视频生成` 这四个页面仍然保留独立工具属性，不能被工作台完全替代。
4. 当前项目继续沿用 Electron + Vue 3 + 本地持久化的桌面端架构，不引入云协同或数据库。
5. 未来的 `电商运营 Agent 助手` 当前只做结构预留，不在本阶段实现真正的多任务自主执行。
6. 实现标准以“稳定、可恢复、可追踪、可导出”为优先，而不是先追求最大功能面。

## Objective

把 QiuAi 从“偏单点生成工具”升级成“项目任务驱动的电商 Agent 工作台”，让用户可以围绕一个商品项目完成：

- 建立项目任务
- 配置商品基础参数
- 一键生成标题、描述、套图、视频
- 逐步查看每个阶段的结果
- 将结果稳定写入结果仓库
- 随时打开本地目录和导出交付内容

本阶段成功的标志不是新增几个页面，而是建立一套稳定的“项目任务 -> 流水线执行 -> 结果归档 -> 结果导出”的产品骨架。

## User Stories

- 作为电商运营，我希望先创建一个商品项目，再一次性完成标题、描述、套图、视频的生成，不想在多个工具之间来回切换。
- 作为内容生产人员，我希望每次生成结果都能稳定保存，并且能回看历史结果。
- 作为单项工具用户，我希望只使用“套图生成”或“标题生成”时，也能独立生成并独立存储结果。
- 作为未来的系统管理员，我希望这套结构后续能扩展成批量任务执行和电商平台自动化。

## In Scope

- 工作台升级为左中右三栏结构
- 左侧项目任务仓库
- 中间项目结果仓库
- 右侧电商运营 Agent 助手预留区
- 项目任务统一数据模型
- 一键生成流水线
- 标题 / 描述 / 套图 / 视频结果映射与归档
- 四个独立生成工具页的独立存储与导出
- 所有结果区域增加“打开目录”类快捷操作

## Out of Scope

- 真正的多 Agent 自主执行
- 自动上架到 OZON / Temu / TikTok Shop / Amazon / AliExpress
- 云端任务调度
- 多端同步
- 余额结算和平台定价策略扩展

## Commands

- Install: `npm.cmd install`
- Dev: `npm.cmd run dev`
- Test: `npm.cmd test`
- Lint: `npm.cmd run lint`
- Build renderer: `npm.cmd run build:renderer`
- Package Windows: `npm.cmd run package:win`

## Project Structure

- `main/src/services/studioWorkspaceService.js`
  负责项目任务、结果仓库、项目导出、工作台状态的主编排。
- `main/src/services/studioTaskManagerService.js`
  负责工作台流水线任务调度与状态推进。
- `main/src/services/copywritingGenerationService.js`
  负责标题和描述生成能力。
- `main/src/services/studioImageGenerationService.js`
  负责套图生成能力。
- `main/src/services/studioVideoGenerationService.js`
  负责视频生成能力。
- `main/src/services/promptTemplateStoreService.js`
  负责提示词模板的持久化与读取。
- `renderer/src/components/ProductWorkbench.vue`
  未来升级为完整工作台视图的主要入口。
- `renderer/src/components/GeneratorStudioPage.vue`
  负责四类单工具页的统一结构。
- `renderer/src/components/ResultExportPanel.vue`
  可作为统一结果导出能力的复用区。
- `tests/backend/`
  主进程服务与流程编排测试。
- `tests/renderer/`
  渲染层结构与交互约束测试。
- `docs/`
  存放升级规格和实施计划。

## Product Model

### 1. 工作台

工作台拆成三栏：

- 左侧 `项目任务仓库`
  - 默认显示一个 `+ 新建项目`
  - 点击后创建项目任务
  - 项目任务只保留一套必要参数，不重复配置
  - 每个项目任务都支持 `一键生成`

- 中间 `项目结果仓库`
  - 显示当前项目的最新运行结果
  - 支持查看历史运行记录
  - 支持复制文本、查看图片缩略图、查看视频状态、打开目录、打包导出

- 右侧 `电商运营 Agent 助手`
  - 当前只做预留容器
  - 预留未来的任务批量投递、队列状态、执行日志、Agent 建议能力

### 2. 项目任务模型

每个项目任务统一使用如下结构：

```js
{
  id: 'project-001',
  name: '宠物饮水机-白色款',
  status: 'draft',
  baseInfo: {
    taskName: '',
    productName: '',
    platform: 'temu',
    language: 'zh-CN',
    keywordsText: '',
    sourceImages: []
  },
  generationConfig: {
    enabledSteps: {
      title: true,
      description: true,
      image: true,
      video: true
    },
    titleMaxChars: 80,
    descriptionMaxChars: 320,
    imageSize: '1:1',
    videoDuration: '6s',
    videoResolution: '768P',
    videoMotionStrength: 'auto',
    titleTemplateId: '',
    descriptionTemplateId: '',
    imageTemplateId: '',
    videoTemplateId: '',
    titlePrompt: '',
    descriptionPrompt: '',
    imagePrompt: '',
    videoPrompt: ''
  },
  latestRunId: '',
  runIds: [],
  createdAt: '',
  updatedAt: ''
}
```

### 3. 运行记录模型

每次点击 `一键生成` 都产生一条独立运行记录：

```js
{
  id: 'run-001',
  projectId: 'project-001',
  status: 'running',
  stepStates: {
    title: { status: 'success', error: '', startedAt: '', completedAt: '' },
    description: { status: 'success', error: '', startedAt: '', completedAt: '' },
    image: { status: 'success', error: '', startedAt: '', completedAt: '' },
    video: { status: 'pending', error: '', startedAt: '', completedAt: '' }
  },
  outputs: {
    title: '',
    description: '',
    images: [],
    video: null
  },
  storage: {
    runDirectory: '',
    titleFile: '',
    descriptionFile: '',
    imageDirectory: '',
    videoDirectory: ''
  },
  createdAt: '',
  completedAt: ''
}
```

### 4. 单工具结果模型

四个独立工具页也要有自己的结果记录，但不与工作台项目记录混淆。

## Workflow

### 工作台流水线

1. 用户点击 `+ 新建项目`
2. 填写必要参数
3. 点击 `一键生成`
4. 系统按顺序执行：
   - 生成标题
   - 生成描述
   - 生成套图
   - 生成视频
5. 每一步执行完成后立刻写入运行记录
6. 中间结果仓库即时展示可视化结果
7. 用户可打开目录、复制文本、导出项目包

### 单工具页流程

- 用户进入某个独立工具页
- 填写该工具所需最小参数
- 执行生成
- 结果写入该工具自己的结果目录
- 用户通过 `结果导出` 区快速打开目录

## Storage Strategy

### 工作台项目存储

```text
DATA/workspace/projects/{projectId}/
  project.json
  runs/{runId}/
    summary.json
    title.txt
    description.txt
    images/
    video/
```

### 单工具页存储

```text
DATA/workspace/generators/
  title/{taskId}/
  description/{taskId}/
  image/{taskId}/
  video/{taskId}/
```

## UI Rules

- 工作台的参数区不能重复出现同一语义字段
- 一键生成必须是可追踪流水线，不做黑盒
- 每个步骤都必须有状态
- 每个结果都必须有真实存储映射
- 每个存储区域都必须有 `打开目录` 按钮
- 文本结果必须支持快速复制
- 图片和视频结果必须支持目录定位

## Architecture Direction

### 1. 用 `studioWorkspaceService` 继续做总编排

不要新起第二套并行系统。工作台、结果仓库、项目导出都应继续收敛到 `studioWorkspaceService`。

### 2. 引入“项目任务流水线”概念

建议新增或扩展一层编排能力，例如：

- `projectPipelineService`
- 或在 `studioTaskManagerService` 中增加工作台流水线模式

这个编排层负责：

- 创建运行记录
- 顺序推进每个步骤
- 捕获步骤错误
- 支持后续单步重试

### 3. 四类生成能力共享底层，不共享结果目录

共享：

- 模型调用
- 提示词模板
- 输入规范化
- 错误处理

独立：

- 结果目录
- 导出目录
- 结果历史

## Code Style

- 主进程使用 CommonJS
- 渲染层保持 Vue 3 `script setup`
- 复杂流程优先沉到 `services`
- 结果结构统一做 normalize
- 文件系统写入必须稳定、可恢复、可重复读取

示例：

```js
async function createProjectRun({ projectId, snapshot } = {}) {
  const run = buildNormalizedProjectRun({ projectId, snapshot })
  await persistProjectRun(run)
  return run
}
```

## Testing Strategy

- 使用 Vitest
- `tests/backend/` 覆盖数据模型、流水线、导出、路径映射
- `tests/renderer/` 覆盖页面结构、按钮事件、结果区约束

重点补齐：

- 项目任务 normalize 测试
- 运行记录写入测试
- 一键生成流水线顺序测试
- 单步失败写入错误信息测试
- 项目包导出结构测试
- 单工具目录定位测试

## Boundaries

### Always

- 工作台和单工具页都要保留
- 先统一数据模型，再改界面
- 所有结果必须有稳定本地落盘
- 每个步骤都要有状态与失败信息
- 所有打开目录操作都必须落到真实路径

### Ask First

- 改动现有 `studioWorkspaceService` 数据结构时的大规模迁移方案
- 为视频引入新的轮询或下载机制时的结构重构
- 是否需要保留旧工作台数据兼容层

### Never

- 让工作台直接依赖渲染层临时状态作为唯一数据源
- 把标题、描述、图片、视频继续拆成四套互不关联的项目结构
- 只做界面展示、不做真实存储
- 为了快而跳过失败状态记录

## Success Criteria

1. 用户可以在工作台创建一个完整项目任务。
2. 用户可以点击一次 `一键生成`，系统能按顺序跑完标题、描述、套图、视频流程。
3. 每个步骤的结果都能写入真实运行记录。
4. 工作台结果仓库能展示最新结果，并能回看历史结果。
5. 四个独立工具页都能单独使用，并有独立结果目录。
6. 所有结果区域都能通过按钮快速打开对应本地目录。
7. 整体结构可支持后续 `电商运营 Agent 助手` 接入批量任务能力。

## Open Questions

1. 工作台左栏里，项目参数是直接展开在卡片里，还是“选中项目后在详情区编辑”更合适。
2. 视频在工作台首版里是否默认开启，还是先作为可选步骤。
3. 历史运行记录是否需要支持“基于旧结果再生成一次”。
4. 右侧 Agent 助手预留区首版是否只放占位，还是加一个简单任务队列面板。
