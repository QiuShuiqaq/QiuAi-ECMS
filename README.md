# QiuAi

QiuAi 是一个基于 `Electron + Vue 3` 的本地桌面 AI 生图工具，当前聚焦电商图片生产场景，支持单图测试、单图设计、套图设计、套图生成、提示词模板管理、结果导出与本地任务管理。

GitHub: [QiuShuiqaq/QiuAi](https://github.com/QiuShuiqaq/QiuAi)

![QiuAi Desktop Screenshot](./qiuai-desktop-screenshot.png)

## v1.2.7

本次版本主要包含以下更新：

- 优化套图生成提示词链路，支持反向提示词模板直接带入输入框后再编辑
- 调整正向/全局/反向提示词拼接逻辑，提升电商生图稳定性
- 增加默认空白模板与默认反向提示词模板，减少误操作
- 优化任务失败反馈，对审核限制、长时间无进展、配置异常等情况给出更明确提示
- 修复多处中文乱码与工作台文案异常
- 修复工作台“网络监控”展示异常与部分布局溢出问题
- 调整模型价格页充值文案显示

## 功能概览

- 单图测试：同图多模型对比出图效果
- 单图设计：围绕单个商品主体快速生成电商图
- 套图设计：批量输入多张图片并统一风格生成
- 套图生成：围绕单主体批量生成多张电商图
- 提示词库：管理正向提示词与反向提示词模板
- 模型价格：查看模型积分消耗与充值档位
- 任务与导出：查看任务状态、下载结果、清理导出目录

## 技术栈

- Electron 30
- Vue 3
- Vite 5
- electron-store
- axios
- archiver
- electron-builder
- Vitest
- ESLint

## 开发环境

- Node.js 18+
- npm
- Windows

## 安装依赖

```bash
npm.cmd install
```

## 启动开发环境

```bash
npm.cmd run dev
```

启动后会同时拉起：

- Renderer 开发服务：`http://127.0.0.1:5173`
- Electron 主进程与桌面窗口

如果 `5173` 端口被其他本地项目占用，请先结束占用进程后再启动。
在当前 Windows PowerShell 环境下，如果执行策略拦截 `npm.ps1`，请统一使用 `npm.cmd`。

## 测试与检查

```bash
npm.cmd test
```

```bash
npm.cmd run lint
```

## Windows 打包

```bash
npm.cmd run package:win
```

默认输出目录：

```text
../package/QiuAi1.2.7-win
```

## 项目结构

```text
QiuAi/
├─ main/             # Electron 主进程
├─ renderer/         # Vue 渲染层
├─ shared/           # 主渲染共享常量
├─ scripts/          # 启动辅助脚本
├─ tests/            # Vitest 测试
├─ DATA/             # 本地开发数据目录
├─ docs/             # 产品与技术文档
└─ package.json
```

## 数据目录

开发环境默认目录：

```text
QiuAi/DATA
```

打包后默认目录：

```text
%APPDATA%/QiuAi/DATA
```

常见内容包括：

- `DATA/input/`：输入素材
- `DATA/output/`：生成结果
- `DATA/message.txt`：接口消息记录
- `DATA/log.txt`：运行日志
- `DATA/taskmanager.json`：任务持久化数据

## 使用说明

- 首次使用前请先导入授权文件
- 生图能力依赖可用的上游 API-Key
- 建议先在“单图测试”中确认模型效果，再进入批量任务
- 套图生成涉及更高积分消耗，建议先用小批量验证提示词

## 文档入口

- [产品使用文档](./docs/QiuAi-Product-Guide.md)
- [技术文档](./docs/QiuAi-Technical-Guide.md)
- [产品使用指导说明书](./docs/QiuAi-%E4%BA%A7%E5%93%81%E4%BD%BF%E7%94%A8%E6%8C%87%E5%AF%BC%E8%AF%B4%E6%98%8E%E4%B9%A6.md)

## 常见问题

- 如果 `5173` 端口被占用，请先结束占用进程后再执行 `npm.cmd run dev`
- 如果 Electron 未正常弹出，请优先检查终端输出与残留 `node` / `electron` 进程
- 如果出现“图片内容触发平台审核限制”，请调整提示词、主体表达或图片素材后重试

## 说明

- 当前仓库是桌面端应用，不是纯网页项目
- 授权生成器不在本仓库中运行
- 后续版本将继续围绕电商 AI 内容生产工作流扩展
