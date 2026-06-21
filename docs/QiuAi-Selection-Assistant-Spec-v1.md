# Spec: QiuAi 选品助手客户端集成 v1

## Objective

为 `QiuAi` 客户端新增“选品助手”能力，但不做独立网页壳，不复刻第三方站点页面，而是作为“标题生成前的素材入口”嵌入现有工作台流程。

用户目标：

- 在客户端内查看服务端已整理好的榜单快照
- 从榜单中筛选商品
- 一键把商品信息带入当前工作台项目
- 基于带入的数据继续生成标题、描述、图片、视频

本期范围只覆盖客户端接入、展示、筛选、本地缓存和项目带入，不负责公开展示数据来源站点，不负责官网首页入口。

## Scope

本期客户端只做：

- 工作台内新增“选品助手”入口
- 榜单列表与商品卡片展示
- 平台、榜单、站点、关键词、本地筛选
- 本地快照缓存与版本比对
- 商品一键带入项目
- 与现有 `workspace` 标题生成草稿联动

本期客户端不做：

- 内嵌浏览器访问第三方站点
- 客户端直接抓取第三方页面
- 公开首页入口
- 竞品分析图表
- 图搜同款、评论下载、导出外部榜单
- 用户自定义采集

## User Flow

主流程：

1. 用户进入工作台
2. 点击“选品助手”
3. 选择平台、榜单，必要时选择站点
4. 查看商品列表并筛选
5. 选择某个商品点击“带入项目”
6. 系统将商品信息写入当前项目草稿
7. 用户继续生成标题或后续内容

次流程：

1. 客户端启动时拉取 `manifest`
2. 如本地缓存版本未过期且服务端版本未变化，则直接使用本地缓存
3. 如服务端版本变化，则增量下载当前平台/榜单快照

## Information Architecture

“选品助手”不新增顶层主导航，不作为独立生成器页。

挂载位置：

- 首选：`ProductWorkbench` 左侧项目任务区顶部增加“选品助手”按钮
- 次选：项目卡展开区增加“从选品助手带入”按钮

推荐交互：

- 右侧抽屉或浮层面板
- 不切出当前 `workspace`
- 选择商品后直接回填当前项目

## Data Contract

客户端只消费服务端规范化数据，不消费第三方页面结构。

```ts
type SelectionPlatform =
  | 'temu'
  | 'shein'
  | 'amazon'
  | 'sumaitong'
  | 'tiktok'
  | 'shopee'

type SelectionBoardType =
  | 'hot-sale'
  | 'hot-sale-new'
  | 'new-mall-hot-sale'
  | 'big-sale-new'

interface SelectionSiteOption {
  code: string
  label: string
}

interface SelectionItemSummary {
  id: string
  platform: SelectionPlatform
  boardType: SelectionBoardType
  siteCode: string | null
  title: string
  subtitle: string | null
  categoryText: string | null
  tags: string[]
  priceText: string | null
  salesVolumeText: string | null
  salesAmountText: string | null
  ratingText: string | null
  reviewCountText: string | null
  primaryImageUrl: string
  extractedKeywords: string[]
  capturedAt: string
}

interface SelectionManifestBoard {
  platform: SelectionPlatform
  boardType: SelectionBoardType
  siteCode: string | null
  version: string
  itemCount: number
  capturedAt: string
}

interface SelectionManifest {
  generatedAt: string
  boards: SelectionManifestBoard[]
}
```

## Project Mapping

商品带入项目时，客户端需将选品数据映射为现有 `workspace` 项目草稿。

建议映射：

- `project.baseInfo.productName` <- `item.title`
- `project.platformTarget[0]` <- `platform`
- `project.baseInfo.category` <- `item.categoryText`
- `workspaceDraft.keywordsText` <- `item.extractedKeywords.join(', ')`
- `workspaceDraft.highlightsText` <- 由标题、标签、销量信息拼接摘要
- `project.assets.sourceImages[0]` <- 服务端代理后的主图地址
- `project.metadata.selectionSource` <- 内部来源信息，仅本地/内部使用

新增内部元数据建议：

```ts
interface SelectionSourceMetadata {
  platform: SelectionPlatform
  boardType: SelectionBoardType
  siteCode: string | null
  itemId: string
  capturedAt: string
}
```

该元数据不直接暴露给普通展示 UI，仅用于回溯、重新带入和排障。

## Client Cache Strategy

本地缓存目录建议按现有桌面数据目录扩展：

- `selection-cache/manifest.json`
- `selection-cache/<platform>/<boardType>/<siteCode-or-default>.json`

缓存策略：

- 启动时先拉 `manifest`
- 如果版本一致，直接用本地数据
- 如果版本不一致，按当前查看范围下载快照
- 允许离线查看最近一次缓存
- 本地缓存保留最近 `30d`

客户端不主动按固定时间轮询服务端，只在以下时机刷新：

- 应用启动
- 用户打开选品助手
- 用户点击“刷新数据”

## UI Requirements

基础 UI 元素：

- 平台切换栏
- 榜单切换栏
- Shopee 站点选择器
- 关键词搜索框
- 本地筛选标签
- 商品卡片网格或表格
- “带入当前项目”按钮
- “新建项目并带入”按钮

卡片最少展示字段：

- 主图
- 标题
- 价格
- 销量
- 销售额
- 评分
- 标签
- 数据快照时间

状态要求：

- 加载中
- 空数据
- 缓存可用但服务端暂不可用
- 当前平台数据暂不可用

## Commands

开发：

- `npm.cmd test`
- `npm.cmd run build:renderer`

定向验证：

- `npm.cmd test -- tests/renderer/appSource.test.js`

## Project Structure

预计新增或修改位置：

- `renderer/src/components/ProductWorkbench.vue`
- `renderer/src/components/` 下新增选品助手面板组件
- `renderer/src/services/desktopBridge.js`
- `main/src/ipc/` 下新增选品助手 IPC
- `main/src/services/` 下新增客户端缓存/同步服务
- `shared/` 下新增选品助手契约常量或类型描述

## Testing Strategy

至少覆盖：

- 客户端入口是否只挂载在工作台，不新增顶层导航
- 选品助手面板交互与本地筛选
- manifest 版本一致时命中缓存
- manifest 版本变化时触发快照下载
- 选中商品后正确映射到项目草稿
- Shopee 站点维度切换正确

测试层级：

- renderer source tests
- renderer component tests
- main service tests
- desktop bridge contract tests

## Boundaries

- Always:
  - 只从服务端授权接口读取榜单数据
  - 入口保持在工作台内
  - 商品带入必须复用现有项目草稿结构
  - 客户端缓存必须可离线兜底
- Ask first:
  - 新增桌面端第三方依赖
  - 将选品助手升级为顶层导航
  - 新增复杂分析图表
- Never:
  - 客户端直接抓第三方页面
  - 内嵌第三方网页并改 DOM
  - 在服务端公开首页暴露选品助手功能

## Success Criteria

- 用户可在 `workspace` 内打开选品助手，不离开当前工作流
- 用户可查看至少六个平台、四类榜单的服务端快照
- Shopee 可按站点切换数据
- 选择商品后可一键带入当前项目
- 带入后标题生成草稿中的商品名、平台、关键词、摘要字段自动填充
- 无网络时如本地已有缓存，仍可查看最近一次快照
- 不新增服务端官网首页公开入口

## Open Questions

- 是否允许用户对商品列表做“收藏”或“稍后带入”
- 带入项目时是否支持“覆盖当前字段”与“仅补空字段”两种模式
- 主图是否长期本地缓存，还是只缓存元数据与缩略图
