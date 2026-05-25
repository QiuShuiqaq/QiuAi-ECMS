# QiuAi

本项目是一个基于 Electron + Vue 3 的本地桌面生图工具，面向电商图片制作、套图设计、批量生成与本地任务管理场景。

GitHub: [QiuShuiqaq/QiuAi](https://github.com/QiuShuiqaq/QiuAi)

![QiuAi Desktop Screenshot](./qiuai-desktop-screenshot.png)

## 项目简介

QiuAi 的定位不是单纯的网页前端，而是一个本地优先的桌面工作台。它把图片生成、批量任务、结果导出、提示词模板、授权校验和本地数据落盘整合到了一个 Electron 应用中，适合希望在本机完成完整出图流程的用户。

当前项目主要覆盖这些使用场景：

- 单图测试与模型效果对比
- 单图设计
- 套图设计
- 套图生成
- 批量任务编排与导出
- 本地提示词模板管理
- 本地授权与设备激活

## 功能特性

- 本地桌面应用，核心操作流程不依赖浏览器
- 支持多种图片生成工作模式
- 支持任务队列、结果预览、结果导出
- 支持提示词模板与反向提示词模板管理
- 支持本地 `DATA` 目录保存输入、输出、日志和任务记录
- 支持设备激活与本地授权文件导入
- 支持 Windows 打包为安装版和便携版

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

## 快速开始

### 环境要求

- Node.js 18+ 或 20+
- npm
- Windows 开发环境为主

### 安装依赖

```bash
npm install
```

### 开发启动

```bash
npm run dev
```

启动后会发生两件事：

- Vite 开发服务启动在 `http://127.0.0.1:5173`
- Electron 桌面窗口自动打开

### 运行测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
```

### Windows 打包

```bash
npm run package:win
```

打包输出目录默认位于：

```text
../package/QiuAi1.2.5-win
```

## 项目结构

```text
QiuAi/
├─ main/           # Electron 主进程
├─ renderer/       # Vue 渲染层
├─ shared/         # 主进程与渲染层共享常量
├─ scripts/        # 启动辅助脚本
├─ tests/          # Vitest 测试
├─ DATA/           # 本地开发数据目录
├─ docs/           # 产品与技术文档
└─ package.json
```

其中几个关键目录的职责：

- `main/main.js`：Electron 启动入口
- `main/preload.js`：预加载桥接层
- `main/src/ipc/`：IPC 处理器
- `main/src/services/`：核心业务服务
- `renderer/src/App.vue`：前端主入口
- `renderer/src/components/`：界面组件
- `shared/ipcChannels.js`：IPC 通道常量

## 数据目录说明

开发环境下，默认数据目录位于：

```text
QiuAi/DATA
```

打包环境下，默认数据目录位于：

```text
%APPDATA%/QiuAi/DATA
```

常见本地数据包括：

- `DATA/input/`：输入素材
- `DATA/output/`：生成结果
- `DATA/message.txt`：接口消息记录
- `DATA/log.txt`：运行日志
- `DATA/taskmanager.json`：任务队列持久化文件

## 授权与使用说明

- 项目带有本地设备激活流程
- 首次使用通常需要先导入授权文件
- 图片生成依赖上游 API，需要正确配置可用的 API Key
- 日常使用入口、功能流程和界面说明可参考 `docs/` 目录

文档入口：

- [产品使用文档](./docs/QiuAi-Product-Guide.md)
- [技术文档](./docs/QiuAi-Technical-Guide.md)
- [产品使用指导说明书](./docs/QiuAi-%E4%BA%A7%E5%93%81%E4%BD%BF%E7%94%A8%E6%8C%87%E5%AF%BC%E8%AF%B4%E6%98%8E%E4%B9%A6.md)

## 常见问题

- 如果 `5173` 端口被占用，请先关闭占用进程后再执行 `npm run dev`
- 如果 Electron 被本机环境变量 `ELECTRON_RUN_AS_NODE=1` 干扰，项目已通过 `scripts/launch-electron.cjs` 在开发启动时自动兜底处理
- 如果窗口没有正常弹出，优先检查终端输出、依赖是否完整安装，以及是否有残留的 `node` 或 `electron` 进程

## 说明

- 当前仓库是一个桌面端工程，不是纯网页项目
- 项目中的授权生成器不在本仓库内运行
- 如需继续完善 README，可以后续补充安装包下载、版本记录、演示 GIF 或更多截图
