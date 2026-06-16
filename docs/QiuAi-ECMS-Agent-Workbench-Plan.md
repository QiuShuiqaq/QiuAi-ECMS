# Plan: QiuAi 电商 Agent 工作台升级

## Status Snapshot

- 已完成：Task 1、Task 2、Task 3、Task 4、Task 6、Task 7、Task 8、Task 9、Task 10、Task 11、Task 12。
- 进行中：Task 5，当前结果仓库已经能展示最新项目结果，但历史运行入口与结果来源映射还在继续补强。
- 待继续：Task 13，当前已有 `tasks`、`projectRuns`、步骤状态等基础结构，但还没有正式收敛成后续 Agent 批量执行日志接口。
- 当前重点：继续稳固“工作台项目任务 <-> 单工具页 <-> 结果仓库”的往返体验，优先保证稳定。

## Overview

本计划围绕“稳定优先”展开，目标不是一次性把所有页面做大，而是先把工作台从界面集合升级成真正的项目任务系统，再把四个独立工具页纳入统一底层能力。

## Architecture Decisions

- 继续以 `studioWorkspaceService` 为主工作区编排核心，不起第二套平行工作区系统。
- 工作台和四个独立工具页共享底层生成能力，但使用独立的结果存储结构。
- 采用“项目 + 运行记录”的双层结果模型，保证结果可追踪、可回看、可导出。
- 一键生成必须实现为可追踪流水线，而不是黑盒大任务。
- `电商运营 Agent 助手` 本阶段只做预留，不做真正多任务自治。

## Delivery Order

### Phase 1: Data Foundation

先把项目模型、运行记录模型、目录结构和导出结构统一下来。

### Phase 2: Workbench Pipeline

再把工作台升级成“项目任务仓库 + 结果仓库 + 预留 Agent 区”的稳定主流程。

### Phase 3: Standalone Generator Alignment

最后让标题、描述、套图、视频四个独立页面接入统一底层能力和独立存储。

### Phase 4: Future Agent Readiness

补充右侧 Agent 助手的预留结构、任务状态接口和后续扩展点。

## Task List

### Phase 1: Foundation

- [ ] Task 1: 定义项目任务和运行记录数据模型
  - Acceptance: 存在统一的 `project` 和 `run` normalize 结构，并可稳定持久化。
  - Verify: 新增后端测试验证默认值、字段归档、状态结构。
  - Files: `main/src/services/studioWorkspaceService.js`, `tests/backend/*`
  - Estimated scope: Medium

- [ ] Task 2: 统一工作台与单工具页的存储目录规范
  - Acceptance: 项目结果与单工具结果目录结构明确，目录路径可稳定生成。
  - Verify: 测试导出路径和目录创建逻辑。
  - Files: `main/src/services/dataPathsService.js`, `main/src/services/studioWorkspaceService.js`, `tests/backend/*`
  - Estimated scope: Medium

- [ ] Task 3: 扩展结果导出模型，支持文本 / 图片 / 视频统一映射
  - Acceptance: 一个运行记录可以同时关联标题、描述、图片、视频的真实存储位置。
  - Verify: 导出结构测试通过。
  - Files: `main/src/services/studioWorkspaceService.js`, `main/src/services/taskExportService.js`, `tests/backend/*`
  - Estimated scope: Medium

### Checkpoint: Foundation

- [ ] 项目和运行记录结构稳定
- [ ] 存储目录结构稳定
- [ ] 基础测试通过

### Phase 2: Workbench Pipeline

- [ ] Task 4: 把工作台左侧升级为项目任务仓库
  - Acceptance: 左侧默认显示 `+ 新建项目`，用户可创建完整项目任务。
  - Verify: 渲染层结构测试 + 手动检查。
  - Files: `renderer/src/components/ProductWorkbench.vue`, `renderer/src/App.vue`, `tests/renderer/*`
  - Estimated scope: Medium

- [ ] Task 5: 工作台中间升级为结果仓库
  - Acceptance: 能显示当前项目最新运行结果，并保留历史运行记录入口。
  - Verify: 渲染层结构测试 + 手动检查。
  - Files: `renderer/src/components/ProductWorkbench.vue`, `renderer/src/components/ResultExportPanel.vue`, `tests/renderer/*`
  - Estimated scope: Medium

- [ ] Task 6: 引入一键生成流水线
  - Acceptance: 点击一次生成后，系统按顺序执行标题、描述、套图、视频步骤，并逐步写入结果。
  - Verify: 后端流水线测试。
  - Files: `main/src/services/studioTaskManagerService.js`, `main/src/services/studioWorkspaceService.js`, `tests/backend/*`
  - Estimated scope: Large

- [ ] Task 7: 工作台结果补充打开目录 / 复制 / 打包导出
  - Acceptance: 标题、描述支持复制，套图、视频支持打开目录，项目支持打包下载。
  - Verify: 渲染层测试 + 手动检查。
  - Files: `renderer/src/components/ProductWorkbench.vue`, `renderer/src/App.vue`, `tests/renderer/*`
  - Estimated scope: Medium

### Checkpoint: Workbench

- [ ] 可创建项目
- [ ] 可一键生成
- [ ] 可看到结果
- [ ] 可打开目录和导出

### Phase 3: Standalone Generator Alignment

- [ ] Task 8: 标题生成页接入独立结果存储
  - Acceptance: 标题生成结果独立落盘，并可从结果导出区打开目录。
  - Verify: 后端测试 + 渲染层测试。
  - Files: `main/src/services/studioWorkspaceService.js`, `renderer/src/components/GeneratorStudioPage.vue`, `tests/*`
  - Estimated scope: Medium

- [ ] Task 9: 描述生成页接入独立结果存储
  - Acceptance: 描述生成结果独立落盘，并可从结果导出区打开目录。
  - Verify: 后端测试 + 渲染层测试。
  - Files: `main/src/services/studioWorkspaceService.js`, `renderer/src/components/GeneratorStudioPage.vue`, `tests/*`
  - Estimated scope: Medium

- [ ] Task 10: 套图生成页接入独立图片目录导出
  - Acceptance: 套图生成结果按文件夹落盘，结果导出可直接定位到图片目录。
  - Verify: 后端测试 + 手动检查。
  - Files: `main/src/services/studioImageGenerationService.js`, `renderer/src/components/GeneratorStudioPage.vue`, `tests/*`
  - Estimated scope: Medium

- [ ] Task 11: 视频生成页接入独立视频目录导出
  - Acceptance: 视频生成结果按文件夹落盘，结果导出可直接定位到视频目录。
  - Verify: 后端测试 + 手动检查。
  - Files: `main/src/services/studioVideoGenerationService.js`, `renderer/src/components/GeneratorStudioPage.vue`, `tests/*`
  - Estimated scope: Medium

### Checkpoint: Standalone Tools

- [ ] 四个独立工具页均可单独使用
- [ ] 四类结果均有独立目录
- [ ] 四类结果均可快速定位

### Phase 4: Agent Readiness

- [ ] Task 12: 预留右侧 Agent 助手区域
  - Acceptance: 工作台右侧存在稳定的结构预留区，不影响当前主流程。
  - Verify: 渲染层结构测试。
  - Files: `renderer/src/components/ProductWorkbench.vue`, `tests/renderer/*`
  - Estimated scope: Small

- [ ] Task 13: 预留批量任务和执行日志接口
  - Acceptance: 存在后续可扩展的任务队列 / 执行日志结构，但不影响当前工作台。
  - Verify: 后端结构测试。
  - Files: `main/src/services/studioTaskManagerService.js`, `main/src/services/studioWorkspaceService.js`, `tests/backend/*`
  - Estimated scope: Medium

### Checkpoint: Ready for Next Stage

- [ ] 工作台主流程稳定
- [ ] 单工具页独立能力稳定
- [ ] 右侧 Agent 区已具备后续接入空间

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 工作台一次性做得过重，导致交互复杂化 | High | 先做标准项目流，右侧 Agent 区只预留，不塞额外逻辑 |
| 一键生成黑盒化，失败后难排查 | High | 采用步骤级状态记录和运行记录结构 |
| 工作台结果和单工具结果混在一起 | High | 一开始就拆分项目目录和工具目录 |
| 视频步骤拖慢整个工作台体验 | Medium | 设计为可选步骤，并支持异步状态推进 |
| 历史数据结构变化导致旧数据异常 | Medium | 增加 normalize 和兼容层，不直接硬切旧结构 |

## Immediate Recommendation

下一步开发应从 `Phase 1 / Task 1` 开始，也就是先重构 `项目任务模型 + 运行记录模型`。  
这是整套电商 Agent 工作台最关键的地基，地基稳了，工作台 UI 和一键生成流水线才能真正稳定。
