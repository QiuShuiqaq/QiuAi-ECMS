---
version: alpha
name: QiuAi-desktop-design-system
description: |
  QiuAi 阶段一升级后的桌面设计语言是一套“电商内容控制台”系统：整体气质参考 Linear 的秩序感、Raycast 的工具型暗色工作台和 Notion 的信息分区能力，但最终落点是适合高频生产场景的桌面应用，而不是营销官网。画面采用深石墨黑工作台、低饱和中性色层级、少量冷青色作为主强调色，并用暖琥珀色作为流程与提醒辅助色。界面要让用户清楚感知“商品项目、内容步骤、生成状态、最终导出”四类信息。重点不是炫技，而是让复杂流程看起来稳、快、可控。

colors:
  primary: "#3ecf8e"
  primary-pressed: "#2fb271"
  primary-soft: "rgba(62,207,142,0.14)"
  accent-cyan: "#53b7ff"
  accent-cyan-soft: "rgba(83,183,255,0.16)"
  accent-amber: "#f2b35b"
  accent-amber-soft: "rgba(242,179,91,0.16)"
  accent-red: "#ff6b6b"
  accent-red-soft: "rgba(255,107,107,0.14)"
  canvas: "#0b0f12"
  surface-1: "#12181d"
  surface-2: "#171f25"
  surface-3: "#1d2630"
  surface-4: "#24303a"
  surface-glass: "rgba(18,24,29,0.78)"
  hairline: "#25303a"
  hairline-strong: "#33414d"
  hairline-soft: "rgba(255,255,255,0.08)"
  ink: "#eef4f8"
  ink-muted: "#c3d0d9"
  ink-subtle: "#8fa0ad"
  ink-tertiary: "#6f7f8b"
  on-primary: "#07110b"
  semantic-success: "#3ecf8e"
  semantic-warning: "#f2b35b"
  semantic-error: "#ff6b6b"

typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -1.1px
  display-md:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: -0.6px
  heading-xl:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.3px
  heading-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.25
  heading-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.35
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.3px
  mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5

rounded:
  xs: 6px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 40px
  section: 56px
---

## Overview

QiuAi 不应该再长得像“几个生成页拼在一起的工具”，而要长得像一套稳定的电商内容生产控制台。用户要一眼看出：

- 当前正在做哪个商品项目
- 当前处在标题 / 描述 / 图片 / 视频的哪一步
- 哪些结果已经可用，哪些还在排队
- 最终能不能导出并交付

因此界面结构要从“功能页切换”逐步转向“项目工作流 + 结果工作台”。

## Design Intent

### Core Mood

- 稳定、专业、偏生产工具，而不是营销站
- 暗色但不压抑，要有清晰的信息层级
- 让用户在高密度任务场景下仍然能快速扫读

### Reference Blend

- 吸收 Linear：结构克制、边界清晰、强调色稀缺
- 吸收 Raycast：工具型暗色工作台、面板像系统控制台
- 吸收 Notion：信息块清晰，长文本和结果区可读性好

### Product-Specific Direction

- “商品项目”是一级对象
- “生成步骤”是二级导航
- “结果与导出”是常驻心智
- 用户应始终看到状态，而不是到处点进去找状态

## Layout Principles

### Shell Structure

桌面端使用三段式布局：

1. 左侧为稳定导航区
2. 中间为主工作区
3. 右侧为任务 / 导出 / 状态辅助区

主工作区内部再按“输入区 + 结果区”双栏组织。不要把所有配置项垂直堆成超长表单。

### Panel Hierarchy

- `surface-1`：主容器、页面背景板
- `surface-2`：常规卡片、表单区
- `surface-3`：结果区、高亮工作块
- `surface-4`：焦点状态、选中态或悬停后的提升层

靠色阶和细边框做层级，不依赖大阴影。

### Information Density

- 允许高信息密度，但必须可扫描
- 每个卡片只承载一种主任务
- 每个卡片顶部都要有清晰标题和操作入口

### Workflow Visibility

对“标题 / 描述 / 图片 / 视频”这些步骤，要做成可见的流程片段或状态分组，而不是埋在下拉框里。

## Color Rules

### Primary Color

`{colors.primary}` 只用于：

- 主按钮
- 当前步骤高亮
- 成功状态核心提示
- 关键数据确认

不要把绿色铺成大面积背景。

### Accent Usage

- `accent-cyan`：信息、分析、系统反馈
- `accent-amber`：提醒、待处理、流程警示
- `accent-red`：失败、删除、风险

每个屏幕同一时刻最多只允许一个主强调色占主导。

## Typography Rules

- 标题用 Inter 600/700，紧凑但不压缩
- 正文统一 Inter 14px/16px，保证长文本可读
- 数值、任务编号、路径、模型名可使用 `mono`
- 不使用过于花哨的展示字体

## Component Guidance

### Navigation

- 左侧导航必须有“当前所在位置”强反馈
- 当前项使用 `primary-soft` 背景 + 左侧色条或内发光
- 导航图标与文字对齐，不能漂

### Buttons

- 主按钮：实色 `primary`
- 次按钮：`surface-3` + `hairline`
- 危险按钮：透明背景 + 红色文字，确认态再填充

### Forms

- 表单输入区使用统一 44px 左右高度
- 长文本输入采用更大的内边距和独立说明文案
- 关键字段旁边可有字数建议、用途说明、示例

### Result Cards

- 文本结果卡要支持“候选结果列表 + 选中稿”
- 图片结果卡要支持缩略图、任务来源、下载/加入项目动作
- 状态信息永远显示在卡片顶部右侧，不要藏

### Status

- 队列中：`accent-cyan-soft`
- 处理中：`accent-amber-soft`
- 已完成：`primary-soft`
- 失败：`accent-red-soft`

状态标签要统一、短小、颜色明确。

## Interaction Rules

### Desktop-First

这是桌面工作流产品，不要用移动端思维把操作藏得太深。常用动作应该始终在视口内可见。

### Progressive Disclosure

默认只显示必要输入；高级参数收进次级区块或折叠区，避免首屏过载。

### Selection Feedback

用户选中了某个项目、某个标题、某组图片、某个导出项时，必须有明显选中态，不能只靠复选框变化。

### Motion

- 只用轻量过渡
- 重点用在步骤切换、结果插入、状态刷新
- 不做花哨的页面漂浮动画

## Do

- 把界面当“生产台”而不是“展示页”
- 保持面板结构稳定，减少视线跳跃
- 用有限的强调色做明确反馈
- 让任务状态、步骤状态、导出状态长期可见
- 优先照顾长时间工作的可读性和疲劳感

## Don't

- 不要堆太多纯黑和高对比白，容易疲劳
- 不要全屏大渐变
- 不要同时出现多个抢眼强调色
- 不要把核心动作埋进二级弹窗
- 不要把长表单做成没有分区的滚动墙

## Suggested First UI Upgrade

阶段一前端改造建议先落三件事：

1. 把工作区首页改成“商品项目工作台”
2. 把标题 / 描述 / 图片结果放进同一结果视图
3. 把任务队列与导出结果做成持续可见的右侧控制区

这样后续接视频和平台适配时，版式不需要再推翻重做。
