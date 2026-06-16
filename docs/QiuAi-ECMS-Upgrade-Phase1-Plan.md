# Plan: QiuAi 电商内容工作流升级（阶段一）

## Implementation Goal

在不破坏当前图片工作流的前提下，把系统升级为“商品项目驱动”的电商内容生产桌面应用，并完成标题、描述、图片的一体化生产与导出。

## Recommended Delivery Order

### Phase A: Stabilize the Existing Base

先修掉当前已暴露的基础问题，再进入升级开发。

- 修复开发启动入口问题
- 清理 `npm run dev` 依赖的本地端口冲突说明
- 明确开发环境启动约束

### Phase B: Introduce the Product Project Model

先让系统认识“商品项目”，不要一开始就直接堆新按钮。

- 新增商品项目数据结构
- 扩展 `studioWorkspaceService` 的默认草稿、结果、导出结构
- 让一个项目能关联标题、描述、图片任务结果

### Phase C: Restore and Upgrade Text Generation

把仓库里已存在但当前被隐藏的文案能力接回主流程。

- 抽象标题生成
- 抽象描述生成
- 把结果写回项目内容区
- 允许多候选 + 人工选择

### Phase D: Reframe Image Generation Around the Project

保留现有生图引擎，但把入口从“图片模式”转成“项目内容生成步骤”。

- 项目内继续调用现有图片能力
- 将生成结果回写到当前项目
- 保留现有图片模板、负向提示词、批量生成优势

### Phase E: Export a Listing Package

阶段一的最小闭环不是“生成成功”，而是“可交付”。

- 导出 `project.json`
- 导出 `title.txt`
- 导出 `description.txt`
- 导出图片目录
- 为后续平台映射预留 `platformDrafts`

### Phase F: Prepare Video and Platform Adapter Interfaces

阶段一先铺接口，不抢首版复杂度。

- 预留视频任务类型
- 预留平台适配器接口
- 预留平台校验入口

## Major Components

1. 项目模型层
2. 项目任务编排层
3. 文本生成服务层
4. 图片生成适配层
5. 项目结果视图层
6. 项目导出层
7. 平台适配预留层

## File-Level Direction

- `main/src/services/studioWorkspaceService.js`
  阶段一的主改造点，负责状态结构、任务归档、结果汇总、导出编排。

- `main/src/services/copywritingGenerationService.js`
  吸收为项目文本生成基础能力，后续可拆成标题/描述专用策略。

- `main/src/services/chatCompletionService.js`
  继续保留为底层文本请求封装。

- `main/src/ipc/studioIpc.js`
  新增项目级文案任务和项目导出相关入口。

- `renderer/src/App.vue`
  调整页面状态编排，从“图片菜单中心”转向“商品项目中心”。

- `renderer/src/components/DesignWorkspace.vue`
  重新定义项目工作区布局。

- `renderer/src/components/ParameterSettingsPanel.vue`
  新增商品信息、标题、描述相关录入区。

- `renderer/src/components/ResultDisplayPanel.vue`
  新增文本结果展示和项目结果聚合展示。

- `tests/backend/`
  补项目模型、文本任务、项目导出测试。

- `tests/renderer/`
  补菜单、工作区、结果区结构测试。

## Risks and Mitigations

### Risk 1: UI 改造过大，容易把现有图片用户路径打断

Mitigation:

- 第一版保留现有图片能力入口
- 先新增“商品项目工作区”，再逐步收敛旧菜单

### Risk 2: 文案与图片结果无法归并到统一导出结构

Mitigation:

- 先定义 `project` 数据模型
- 所有生成动作都必须回写到项目对象

### Risk 3: 视频能力拖慢首版

Mitigation:

- 视频只做接口和结果结构预留
- 首版不把视频设为关键路径

### Risk 4: 第二阶段平台适配返工

Mitigation:

- 第一阶段就保留 `platformDrafts`
- 用平台无关字段做核心数据模型

## Verification Checkpoints

### Checkpoint 1

商品项目模型完成后，能在本地持久化、刷新恢复、导出基础结构。

### Checkpoint 2

标题和描述生成完成后，结果能进入统一结果区，并支持用户选择最终稿。

### Checkpoint 3

图片生成挂入项目后，项目能同时包含文本和图片结果。

### Checkpoint 4

项目导出包完成后，导出目录结构稳定，能被后续平台适配器消费。

## Task Breakdown

- [ ] Task: 修复开发入口与环境说明
  - Acceptance: `npm.cmd run dev` 不因主进程入口代码直接报错；文档注明 `5173` 端口占用处理方式。
  - Verify: 手动启动开发环境；运行 `npm.cmd test`、`npm.cmd run lint`
  - Files: `main/main.js`, `README.md` or `START.txt`

- [ ] Task: 定义商品项目核心数据结构
  - Acceptance: `studioWorkspaceService` 内存在统一的项目草稿/结果结构，支持默认值、normalize、持久化。
  - Verify: 新增 backend tests
  - Files: `main/src/services/studioWorkspaceService.js`, `tests/backend/test_studio_workspace_service.test.js`

- [ ] Task: 接入标题生成任务
  - Acceptance: 用户可在项目内生成标题候选，结果持久化到当前项目。
  - Verify: backend tests + renderer source tests
  - Files: `main/src/services/copywritingGenerationService.js`, `main/src/services/studioWorkspaceService.js`, `renderer/src/components/*`, `tests/backend/*`, `tests/renderer/*`

- [ ] Task: 接入描述生成任务
  - Acceptance: 用户可在项目内生成描述候选，支持最终选中稿。
  - Verify: backend tests + renderer source tests
  - Files: `main/src/services/copywritingGenerationService.js`, `main/src/services/studioWorkspaceService.js`, `renderer/src/components/*`, `tests/backend/*`, `tests/renderer/*`

- [ ] Task: 把图片生成结果绑定到商品项目
  - Acceptance: 图片任务结果能关联到当前项目，不再只是孤立的图片输出。
  - Verify: backend tests + existing image tests pass
  - Files: `main/src/services/studioWorkspaceService.js`, `main/src/services/studioImageGenerationService.js`, `tests/backend/*`

- [ ] Task: 升级结果展示区为项目聚合视图
  - Acceptance: 界面能同时展示标题、描述、图片结果。
  - Verify: renderer source tests + manual UI check
  - Files: `renderer/src/components/ResultDisplayPanel.vue`, `renderer/src/components/DesignWorkspace.vue`, `renderer/src/App.vue`, `tests/renderer/*`

- [ ] Task: 实现项目导出包
  - Acceptance: 导出包含标题、描述、图片、结构化项目文件。
  - Verify: backend export tests
  - Files: `main/src/services/studioWorkspaceService.js`, related export helpers, `tests/backend/*`

- [ ] Task: 为视频与平台适配器预留扩展接口
  - Acceptance: 核心模型和服务层存在清晰扩展点，但不影响首版主流程。
  - Verify: source review + targeted tests
  - Files: `main/src/services/*`, `docs/*`, optional renderer placeholders

## Immediate Recommendation

进入开发前，先做两件事：

1. 修复 `main/main.js` 的启动入口问题。
2. 在不破坏现有生图链路的前提下，先把“商品项目模型”落进 `studioWorkspaceService`。

这两步完成后，后续标题、描述、图片能力才能自然接进同一条流水线。
