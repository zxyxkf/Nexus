# Nexus 任务管理系统 — 技术白皮书

> 版本：v15.0.3 | 文档日期：2026-05-26 | 密级：内部

---

## 一、项目概述

Nexus（原名 D-Design）是一款面向电商公司的任务管理桌面客户端，覆盖"运营发布任务 → 美工接单作业 → 管理员全局管控"等的完整业务流程。系统采用 **Electron + Vue3 + Express + MySQL/SQLite** 双层引擎架构，支持 Windows 桌面安装包与 Docker 容器化两种部署模式。

### 核心能力

| 能力 | 说明 |
|------|------|
| 七角色权限体系 | admin / sub_admin / operator / cs_agent / designer / basic_designer / operator_assistant，严格数据隔离 |
| 任务全生命周期管理 | 发布→接单→作业→提交→审核→ 通过/驳回，完整状态流转 |
| 双数据库引擎 | MySQL 8.0（生产）与 SQLite（零配置开发），启动自动检测与建表 |
| 文件安全存储 | 按分组 + 日期分子目录存储，UUID 重命名防覆盖，防路径穿越 |
| JWT 双令牌认证 | Access Token（10min）+ Refresh Token（7d），支持全设备下线 |
| 实时消息推送 | Socket.IO 推送任务状态变更，桌面原生通知 + Toast 弹窗 |
| 操作审计 | 关键操作全量日志记录，可追溯、可查询 |
| 自动更新 | electron-updater 集成，客户端启动自动检查更新 |

---

## 二、整体系统架构

### 2.1 架构分层图

```
┌────────────────────────────────────────────────────────────────┐
│                    展示层 (Presentation Layer)                    │
│  ┌──────────────────────────────────────┐                       │
│  │  Electron 29 Shell (Windows Desktop)  │                       │
│  │  ┌──────────────────────────────────┐ │                       │
│  │  │   Vue 3 + Element Plus + ECharts │ │                       │
│  │  │   Pinia Store  │  Vue Router    │ │                       │
│  │  └──────────────────────────────────┘ │                       │
│  │  preload.js (安全 IPC 桥接)            │                       │
│  └──────────────────────────────────────┘                       │
├────────────────────────────────────────────────────────────────┤
│                     通信层 (Communication Layer)                 │
│  ┌─────────────────────┐  ┌────────────────────────────────┐   │
│  │  HTTP/HTTPS (Axios) │  │  WebSocket (Socket.IO client)  │   │
│  │  RESTful API        │  │  实时推送任务状态变更通知        │   │
│  └─────────────────────┘  └────────────────────────────────┘   │
├────────────────────────────────────────────────────────────────┤
│                    业务层 (Business Layer)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Express 4 (standalone-server)                 │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │ │
│  │  │ Route    │  │ Service  │  │ DAO      │  │ WebSocket │ │ │
│  │  │ 参数校验  │→ │ 业务逻辑  │→ │ 数据持久化│  │ 实时推送   │ │ │
│  │  │ 响应格式化│  │ 事务编排  │  │ SQL 封装  │  │ io.emit() │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └───────────┘ │ │
│  │                                                           │ │
│  │  Middleware 层: auth(JWT) │ requestId │ errorHandler      │ │
│  │  Utils 层:    mutex │ business-logger │ operLog │ upload  │ │
│  └────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│                    数据层 (Data Layer)                           │
│  ┌──────────────────┐  ┌────────────────────────────────────┐  │
│  │  MySQL 8.0       │  │  SQLite (sql.js WASM)               │  │
│  │  (生产环境)       │  │  (本地单机 / 开发环境)              │  │
│  └──────────────────┘  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  文件存储: 本地目录 / Docker Volume / SMB 共享文件夹       │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 部署模式

| 模式 | 适用场景 | 说明 |
|------|---------|------|
| Electron 桌面客户端 | 最终用户日常使用 | .exe 一键安装，内连独立后端 |
| Docker Compose 部署 | 服务器生产环境 | 包含 Node.js + MySQL 全套服务 |
| 开发模式 (dev:full) | 本地开发调试 | Vite 热更新 + nodemon 后端 |

---

## 三、核心技术栈清单

### 3.1 前端

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| UI 框架 | Vue 3 | ^3.4.0 | 渐进式 JavaScript 框架 |
| 构建工具 | Vite | ^5.2.0 | 前端构建与 HMR |
| UI 组件库 | Element Plus | ^2.7.0 | 企业级桌面端组件库 |
| 图表库 | ECharts | ^5.5.0 | 仪表盘数据可视化 |
| 状态管理 | Pinia | ^2.1.7 | Vue 3 官方状态管理 |
| 路由 | Vue Router | ^4.3.0 | SPA 页面路由 |
| HTTP 客户端 | Axios | ^1.7.2 | API 请求与拦截器 |
| 日期处理 | dayjs | ^1.11.11 | 日期格式化与计算 |
| 图标库 | @element-plus/icons-vue | ^2.3.1 | 界面图标 |

### 3.2 桌面容器

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 桌面框架 | Electron | ^29.1.0 | Windows 桌面容器 |
| 打包工具 | electron-builder | ^24.13.0 | NSIS 安装包生成 |
| 自动更新 | electron-updater | ^6.8.3 | 客户端热更新 |

### 3.3 后端

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| Web 框架 | Express | ^4.19.2 | HTTP API 服务 |
| 认证 | jsonwebtoken | ^9.0.2 | JWT 签发与验证 |
| 密码加密 | bcryptjs | ^2.4.3 | BCrypt 不可逆加密 |
| 文件上传 | multer | ^1.4.5-lts.1 | multipart/form-data 解析 |
| 跨域 | cors | ^2.8.5 | CORS 跨域处理 |
| 实时通信 | Socket.IO | ^4.8.3 | WebSocket 双向通信 |
| 进程管理 | PM2 | latest | 生产环境进程守护 |
| 日志 | winston + rotating-file-stream | ^3.19.0 / ^3.2.9 | 业务日志 + HTTP 日志 |
| 限流 | express-rate-limit | ^8.5.2 | API 频率限制 |
| 环境变量 | dotenv | ^17.4.2 | .env 文件加载 |
| Excel 导出 | exceljs | ^4.4.0 | 报表导出 |

### 3.4 数据库

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 关系数据库 | MySQL | 8.0+ | 生产环境主数据库 |
| 内嵌数据库 | SQL.js (SQLite) | ^1.14.1 | 零配置本地数据库 |
| MySQL 驱动 | mysql2 | ^3.9.0 | Node.js MySQL 连接池 |

### 3.5 容器化与编排

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 容器引擎 | Docker | 24.0+ | 应用容器化运行 |
| 编排 | Docker Compose | v2+ | 多服务编排 (nexus-server + MySQL) |
| 基础镜像 | node:20-slim | - | 轻量 Node.js 运行环境 |
| 数据库镜像 | mysql:8.0 | - | MySQL 官方镜像 |

### 3.6 测试与 CI/CD

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| E2E 测试 | Playwright | ^1.60.0 | 冒烟测试 |
| 集成测试 | Jest + Supertest | ^30.4.2 / ^7.2.2 | API 集成测试 |
| CI/CD | GitHub Actions | - | lint / test / build / deploy |
| 静态检查 | ESLint | - | 代码规范检查 |

---

## 四、项目目录结构说明

```
d-design-art-manager/
│
├── electron/                         # Electron 桌面壳层
│   ├── main.js                       # 主进程：窗口管理、IPC、菜单、自动更新
│   ├── preload.js                    # 预加载脚本：安全 IPC 桥接
│   ├── toast-preload.js              # Toast 通知窗口预加载
│   └── toast.html                    # Toast 通知窗口 UI
│
├── src/                              # Vue 3 前端源码
│   ├── main.js                       # Vue 应用入口
│   ├── App.vue                       # 根组件
│   ├── api/                          # 模块化 API 层
│   │   ├── http.js                   # Axios 实例 + 拦截器 + 重试
│   │   ├── auth.js                   # 认证 API (登录/登出/刷新/改密)
│   │   ├── user.js                   # 用户管理 API
│   │   ├── task.js                   # 任务 CRUD API
│   │   ├── config.js                 # 系统配置 API
│   │   ├── log.js                    # 操作日志 API
│   │   ├── notification.js           # 通知消息 API
│   │   ├── score.js                  # 积分管理 API
│   │   ├── announcement.js           # 公告 API
│   │   ├── shop.js                   # 店铺管理 API
│   │   ├── export.js                 # 数据导出 API
│   │   ├── upload.js                 # 文件上传 + 拖拽缓存 + Electron IPC
│   │   └── index.js                  # Barrel 统一导出
│   ├── components/                   # 通用组件
│   │   ├── TaskDetail.vue            # 任务详情内联面板
│   │   ├── TaskFilter.vue            # 搜索筛选栏
│   │   ├── Pagination.vue            # 分页组件
│   │   ├── PersonSelect.vue          # 人员选择器
│   │   ├── SidebarMenu.vue           # 侧边栏导航
│   │   ├── StatsPanel.vue            # 统计面板
│   │   ├── NotificationToast.vue     # 通知弹窗
│   │   ├── AnnouncementBanner.vue    # 公告横幅
│   │   └── InfiniteGridBg.vue        # 登录页背景动画
│   ├── composables/                  # 组合式逻辑
│   │   ├── useTaskList.js            # 分页 + 筛选 + 排序
│   │   ├── useTaskActions.js         # 任务操作封装
│   │   ├── useFileUpload.js          # 文件上传 + 进度
│   │   ├── useRealtime.js            # Socket.IO 实时监听
│   │   ├── usePolling.js             # 轮询刷新
│   │   ├── useOverdueSort.js         # 逾期排序
│   │   ├── useNotificationToast.js   # 通知弹窗逻辑
│   │   ├── useTaskStatus.js          # 任务状态工具
│   │   ├── useFileHelpers.js         # 文件辅助函数
│   │   └── useConfig.js              # 配置读取
│   ├── router/index.js               # 路由配置 + 权限守卫
│   ├── store/                        # Pinia 状态管理
│   │   ├── index.js                  # 主 Store (用户信息)
│   │   ├── cache.js                  # 请求缓存层
│   │   └── config.js                 # 系统配置缓存
│   ├── utils/                        # 前端工具
│   │   ├── auth.js                   # Token 读写
│   │   ├── format.js                 # 数值/日期格式化
│   │   └── field-label.js            # 字段标签映射
│   ├── config/menus.js               # 侧边栏菜单配置
│   └── views/                        # 页面组件
│       ├── Layout.vue                # 主布局框架
│       ├── login/                    # 登录页 (含动画)
│       ├── admin/                    # 管理员端 (Dashboard/Users/AllTasks/Logs/Config)
│       ├── operator/                 # 运营端 (Publish/MyTasks/Review/Stats)
│       ├── operator-assistant/       # 运营助理端 (MyTasks/Stats)
│       ├── designer/                 # 美工端 (MyTasks/Stats)
│       ├── basic/                    # 基础美工端 (MyTasks/Stats)
│       ├── cs/                       # 客服端 (Stats)
│       └── shared/                   # 跨角色共用页面 (TaskHall/PublishTask/MyTasksPub/Review)
│
├── standalone-server/                # 独立后端服务
│   ├── server.js                     # 启动入口: HTTP Server + Socket.IO + 优雅关闭
│   ├── app.js                        # Express 应用工厂 (createApp)
│   ├── index.js                      # 兼容旧引用 (require('./server'))
│   ├── ecosystem.config.js           # PM2 配置
│   ├── config/
│   │   ├── env.js                    # 集中配置: dotenv 加载 + 敏感配置校验 + frozen export
│   │   ├── database.js               # 数据库连接池 + 双引擎初始化 + 自动建表
│   │   ├── db-config.js              # DB 连接参数构建 (MySQL/SQLite)
│   │   └── db-engine.js              # 引擎适配层 (SQL 方言差异处理)
│   ├── middleware/
│   │   ├── auth.js                   # JWT 鉴权: requireAuth / requireRole / checkDataOwnership
│   │   ├── errorHandler.js           # 全局错误拦截
│   │   └── requestId.js              # AsyncLocalStorage 生成 requestId
│   ├── routes/                       # 路由层 (参数校验 + 响应格式化)
│   │   ├── auth.js                   # 认证: 登录/刷新/登出/强制下线/改密
│   │   ├── user.js                   # 用户管理 CRUD + 重置密码
│   │   ├── config.js                 # 系统配置 CRUD + 上传限制即时生效
│   │   ├── log.js                    # 操作日志查询
│   │   ├── notification.js           # 通知消息推送
│   │   ├── comment.js                # 任务评论
│   │   ├── export.js                 # Excel 导出
│   │   ├── score.js                  # 积分项 + 积分记录管理
│   │   ├── announcement.js           # 系统公告
│   │   ├── shop.js                   # 店铺管理
│   │   └── task/                     # 任务模块 (按职责拆分)
│   │       ├── task-crud.js          # 任务发布/编辑/删除/催促
│   │       ├── task-action.js        # 接单/上传/转移/提交/审核/撤回
│   │       ├── task-query.js         # 任务查询/详情/文件下载/预览
│   │       ├── task-stats.js         # 统计数据
│   │       └── helpers.js            # 路由层辅助函数
│   ├── services/                     # 业务逻辑层
│   │   ├── task.service.js           # 任务核心业务: 状态流转/文件处理/审核/积分
│   │   └── user.service.js           # 用户管理业务: CRUD/密码/角色校验
│   ├── dao/                          # 数据访问层 (纯 SQL)
│   │   ├── task.dao.js               # 任务相关 SQL
│   │   └── user.dao.js               # 用户相关 SQL
│   ├── utils/                        # 工具层
│   │   ├── upload.js                 # 文件上传: multer 配置/编码修复/文件记录
│   │   ├── share.js                  # 存储目录配置/路径解析/图片存取/上传限制
│   │   ├── mutex.js                  # 应用层互斥锁 (FIFO 队列)
│   │   ├── business-logger.js        # 结构化日志 (winston JSON + 按天轮转)
│   │   ├── logger.js                 # HTTP 访问日志 (morgan + rotating-file)
│   │   ├── operLog.js                # 操作审计日志写入
│   │   ├── notification.js           # 通知发送 (Socket.IO)
│   │   ├── shared-folder.js          # SMB 共享文件夹支持
│   │   └── AppError.js               # 自定义错误类
│   ├── scripts/migrate-files.js      # 文件迁移脚本
│   ├── tests/                        # 后端测试
│   └── .env.example                  # 环境变量模板
│
├── shared/types.ts                   # 前后端共享 TypeScript 类型定义
├── database/
│   ├── init.sql                      # MySQL 初始化建表 + 种子数据
│   └── migrations/                   # 数据库迁移记录
│       ├── README.md
│       ├── 001_cleanup_old_tables.sql
│       └── 001_cleanup_old_tables.sqlite.sql
├── scripts/                          # 运维脚本
│   ├── deploy.sh                     # 部署脚本 (健康检查 + 备份 + 回滚)
│   ├── docker-deploy.sh              # Docker 部署
│   ├── docker-update.sh              # Docker 更新
│   ├── backup.bat / backup.sh        # 数据库备份
│   └── update.bat                    # Windows 一键更新
├── tests/smoke.spec.js               # Playwright 冒烟测试
├── docs/部署全流程手册.md             # 部署运维文档
├── build/                            # 构建资源
│   ├── icon.ico / icon.png / icon.svg# 应用图标
│   ├── app-update.yml                # electron-updater 配置
│   └── installer.nsh                 # NSIS 安装脚本扩展
├── docker-compose.yml                # Docker Compose 编排
├── Dockerfile                        # 多阶段构建 (Vue 编译 + Node 运行)
├── vite.config.js                    # Vite 构建配置
├── playwright.config.js              # Playwright 测试配置
├── tsconfig.json                     # TypeScript 配置
├── package.json                      # 前端 + Electron 依赖 + electron-builder 配置
└── README.md                         # 项目说明
```

---

## 五、运行环境要求

### 5.1 硬件要求

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 双核 2.0GHz | 四核 2.5GHz+ |
| 内存 | 4 GB | 8 GB+ |
| 磁盘 | 20 GB 可用 | 50 GB+ SSD |
| 网络 | 局域网 100Mbps | 千兆局域网 |

### 5.2 操作系统

| 系统 | 版本 | 说明 |
|------|------|------|
| Windows 10/11 专业版 | 22H2+ | 主要运行平台 |
| Windows Server | 2019 / 2022 | 服务器部署 |
| Linux | Ubuntu 22.04+ / CentOS 8+ | Docker 部署 (仅后端) |

### 5.3 软件依赖

| 软件 | 版本 | 必需/可选 |
|------|------|----------|
| Node.js | 20 LTS | 必需 (Docker 部署则内置) |
| npm | 9+ | 必需 |
| MySQL | 8.0+ | 可选 (可回退 SQLite) |
| Docker Desktop | 24.0+ | Docker 部署必需 |
| Docker Compose | v2+ | Docker 部署必需 |

### 5.4 网络端口

| 端口 | 协议 | 用途 | 对外开放 |
|------|------|------|---------|
| 18632 | TCP (HTTP/WS) | 后端 API + 前端页面 + WebSocket | 是 |
| 3306 | TCP | MySQL 数据库 (本地安装) | 否 |
| 3307 | TCP | MySQL (Docker 映射端口) | 否 |
| 5173 | TCP | Vite 开发服务器 | 否 |

---

## 六、容器化部署说明

### 6.1 容器架构

```
┌──────────────────────────────────┐
│  Docker Compose Stack             │
│                                   │
│  ┌────────────┐  ┌─────────────┐ │
│  │ nexus-server│  │ nexus-mysql │ │
│  │ (Node.js   │  │ (MySQL 8.0) │ │
│  │  Express + │  │             │ │
│  │  PM2)      │  │             │ │
│  │            │  │             │ │
│  │ port:18632 │  │ port:3306   │ │
│  └─────┬──────┘  └──────┬──────┘ │
│        │                │        │
│        └──── depends ───┘        │
└──────────────────────────────────┘
         │
    ┌────┴──────────────────────────┐
    │  Docker Volumes                │
    │  - nexus-logs → /app/logs     │
    │  - nexus-uploads → /app/upload│
    │  - nexus-data → /app/data     │
    │  - nexus-releases → /app/releases│
    │  - mysql-data → /var/lib/mysql│
    │  - D:/Nexus_BOX → /app/host-uploads (宿主机映射)│
    └───────────────────────────────┘
```

### 6.2 docker-compose.yml 配置说明

```yaml
services:
  nexus-server:
    build: .                          # 使用根目录 Dockerfile 构建
    container_name: nexus-server
    restart: unless-stopped           # 异常退出自动重启
    ports:
      - "${APP_PORT:-18632}:18632"    # 默认 18632，可通过 .env 覆盖
    env_file:
      - ./standalone-server/.env.production
    environment:
      - NODE_ENV=production
    volumes:
      - nexus-logs:/app/logs          # 日志持久化
      - nexus-uploads:/app/upload     # 上传文件持久化
      - nexus-data:/app/data          # SQLite 数据 (回退模式)
      - nexus-releases:/app/releases  # 客户端更新包
      - D:/Nexus_BOX:/app/host-uploads # 宿主机共享文件夹
    depends_on:
      mysql:
        condition: service_healthy    # 等待 MySQL 健康后才启动
    healthcheck:                      # 30s 间隔 HTTP 健康检查

  mysql:
    image: mysql:8.0
    container_name: nexus-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME:-d_design_art}
      MYSQL_USER: ${DB_USER:-d_design}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", ...]
```

### 6.3 Volume 挂载说明

| Volume 名称 | 容器内路径 | 持久化内容 | 备注 |
|------------|-----------|-----------|------|
| nexus-logs | /app/logs | 应用日志 + PM2 日志 | 按天轮转，保留 30 天 |
| nexus-uploads | /app/upload | 用户上传的文件 | 按分组/日期分子目录 |
| nexus-data | /app/data | SQLite 数据库文件 (回退模式) | MySQL 模式下不使用 |
| nexus-releases | /app/releases | 客户端更新包 (latest.yml + .exe) | 供 electron-updater 拉取 |
| mysql-data | /var/lib/mysql | MySQL 数据文件 | 数据库持久化 |
| D:/Nexus_BOX (bind) | /app/host-uploads | 宿主机共享文件夹 | 大型 PSD/AI 文件的推荐存储位置 |

### 6.4 Volume 覆盖文件问题与解决

**问题现象**：Docker Compose 重新构建后，`node_modules` 为空或缺少新版依赖。

**根因**：Docker Compose 的命名 Volume（如 `nexus-logs`、`nexus-uploads`）在容器重建时会保留旧数据。如果 Volume 挂载到了依赖目录，旧 Volume 内容会覆盖镜像中 COPY 的新文件。

**解决方案**：
1. Dockerfile 中 `COPY standalone-server/ ./` 在 `RUN npm ci` 之后执行
2. Volume 只挂载数据目录（logs/upload/data/releases），不挂载源码目录
3. 如果引入新的 Volume 路径，需在 `docker compose down -v` 后重建

### 6.5 BuildKit 缓存问题

**问题现象**：修改了 `package.json` 依赖，但 Docker 构建时仍使用旧的 `node_modules` 缓存。

**根因**：Docker BuildKit 层缓存机制 — 如果 `COPY package*.json ./` 层的 checksum 未变，会复用旧的 `npm ci` 层。

**解决方案**：
```bash
# 方案一：禁用缓存重新构建
docker compose build --no-cache

# 方案二：仅重建 nexus-server 服务
docker compose build --no-cache nexus-server

# 方案三：清理 BuildKit 缓存后重建
docker builder prune -f
docker compose build
```

### 6.6 构建 & 启停 & 重启命令

```bash
# ===== 首次部署 =====
# 1. 修改 standalone-server/.env.production（JWT_SECRET、DB_PASSWORD 等）
# 2. 构建并启动全部服务
docker compose up -d --build

# ===== 日常操作 =====
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f nexus-server      # 后端日志
docker compose logs -f mysql             # 数据库日志

# 停止服务
docker compose down                       # 停止 + 删除容器（保留 Volume）
docker compose down -v                    # 停止 + 删除容器 + 删除 Volume（数据丢失！）

# 重启服务
docker compose restart                    # 重启全部
docker compose restart nexus-server       # 仅重启后端

# ===== 更新部署 =====
# 1. 拉取新代码后
git pull
# 2. 重新构建并启动（复用 Volume 中的数据）
docker compose up -d --build
# 3. 验证
docker compose logs -f nexus-server

# ===== 进入容器调试 =====
docker exec -it nexus-server bash
```

---

## 七、编译与构建流程

### 7.1 前端构建

```bash
# 开发模式 (Vite HMR)
npm run dev

# 生产构建 (Vite build → dist/)
npm run build

# 输出: dist/
#   ├── index.html
#   └── assets/
#       ├── vendor-*.js    (Vue/Pinia/ElementPlus/ECharts 合并)
#       └── *.js, *.css    (业务代码按路由拆分)
```

### 7.2 Electron 打包

```bash
# Electron 开发模式 (Vite + Electron 并行)
npm run electron:dev

# 完整构建并打包为 Windows 安装包
npm run electron:build

# 仅构建到目录（不打包安装包，用于调试）
npm run electron:build:dir

# 输出: release/Nexus-v15.0.3-Setup.exe
```

### 7.3 Docker 多阶段构建

```dockerfile
# Stage 1: 构建 Vue 前端 (node:20-slim)
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY src/ public/ vite.config.js index.html ./
RUN npm run build                  # → /build/dist/

# Stage 2: 生产运行环境 (node:20-slim)
RUN npm install -g pm2
COPY standalone-server/package*.json ./
RUN npm ci --production            # 仅安装生产依赖
COPY standalone-server/ ./
COPY --from=frontend-builder /build/dist/ ./dist/  # 嵌入前端产物
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
```

### 7.4 CI/CD (GitHub Actions)

流程：`Push/PR → lint → test (Playwright) → build (Win electron-builder) → deploy (SSH)`

- **lint**：ESLint 静态检查（当前 continue-on-error）
- **test**：Playwright 冒烟测试（API 全流程）
- **build**：windows-latest 上 npm build + electron-builder 打包
- **deploy**：仅 main 分支触发，上传安装包 + SSH 执行 deploy.sh

---

## 八、常见问题与排错方案

### 8.1 Volume 覆盖导致 node_modules 缺失

**症状**：容器启动报 `Error: Cannot find module 'express'`

**排查**：
```bash
docker exec nexus-server ls /app/node_modules/express
# 如果目录为空或不存在 → Volume 覆盖问题
```

**解决**：检查 `docker-compose.yml` 中是否错误地将 Volume 挂载到 `/app`，应只挂载数据子目录（logs/upload/data/releases）。

### 8.2 BuildKit 缓存导致依赖未更新

**症状**：修改了 package.json 添加新依赖，构建后仍报模块找不到。

**解决**：
```bash
docker compose build --no-cache nexus-server
docker compose up -d
```

### 8.3 中文文件名上传乱码

**症状**：上传包含中文名的文件后，文件名显示为乱码。

**根因**：Node.js HTTP 解析器将 `Content-Disposition` 中的 UTF-8 字节按 Latin-1 解释，多字节汉字被错误解码。

**解决方案**（已集成）：
- `standalone-server/utils/upload.js` 中的 `fixFilenameEncoding()` 函数
- 使用 `Buffer.from(name, 'latin1').toString('utf8')` 模式还原
- 在 4 个上传链路节点均已修复

### 8.4 429 限流导致登录阻塞

**症状**：多个用户同时登录时出现 429 Too Many Requests。

**根因**：Docker 容器通过 Docker 网桥转发，所有请求源 IP 相同（Docker 网关 IP），per-IP 限流误杀。

**解决**（已调整）：
- 登录接口限流从 5 次/分钟 放开至 30 次/分钟
- 全局 API 限流保持 100 次/分钟
- 测试环境设置 `DISABLE_RATE_LIMIT=1` 可完全跳过快限制

### 8.5 管理员配置上传限制不生效

**症状**：在系统配置中修改"上传文件大小上限"或"单次上传最多文件数"后，上传时仍限制旧值。

**根因**：原 multer 配置使用硬编码值，未读取动态配置缓存。

**解决方案**（已修复）：
- `standalone-server/utils/share.js` 的 `initStorageConfig()` 增加了上传限制加载
- `task-action.js` 和 `upload.js` 中的 multer 限制改为调用 `getMaxFileSizeMB()` / `getMaxFileCount()`
- 管理员修改 `upload.max_file_size_mb` / `upload.max_file_count` 配置后即时生效，无需重启

### 8.6 MySQL 连接失败

**症状**：后端日志显示 `ECONNREFUSED` 或 `Access denied`。

**排查步骤**：
1. 检查 MySQL 容器状态：`docker compose ps mysql`
2. 检查 MySQL 日志：`docker compose logs mysql`
3. 验证 `.env.production` 中的 `DB_PASSWORD` 是否与 docker-compose.yml 中 `MYSQL_PASSWORD` 一致
4. 如遇密码不匹配，先 `docker compose down -v` 删除 Volume 再重建

### 8.7 健康检查失败

**症状**：`docker compose ps` 显示 nexus-server 为 unhealthy。

**排查**：
```bash
# 手动测试健康检查端点
curl http://localhost:18632/api/health

# 查看容器日志
docker compose logs nexus-server --tail 50
```

常见原因：MySQL 未就绪、JWT_SECRET 未设置、端口冲突。

### 8.8 客户端自动更新失败

**症状**：Electron 客户端提示更新失败或检查不到新版本。

**排查**：
1. 确认 `build/app-update.yml` 和 `.exe` 安装包已放到 `releases/` 目录
2. 确认 `releases/` 目录通过 Docker Volume 正确挂载
3. 确认客户端可访问 `http://<服务器IP>:18632/releases/latest.yml`
4. 检查版本号是否正确递增

### 8.9 Socket.IO 连接失败

**症状**：实时通知不推送、任务状态不刷新。

**排查**：
1. 检查客户端 `Socket.IO` 连接 URL 是否与 API 地址一致
2. 确认防火墙没有拦截 WebSocket 升级请求（端口 18632）
3. 检查 JWT Token 是否在有效期内

---

## 附录

### A. 环境变量速查表

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| NODE_ENV | development | 运行环境: development / production |
| PORT | 18632 | HTTP 服务端口 |
| HOST | 0.0.0.0 | 绑定地址 |
| JWT_SECRET | (生产必须自定义) | JWT 签名密钥 |
| USE_MYSQL | 0 | 1=MySQL, 0=SQLite |
| DB_HOST | 127.0.0.1 | MySQL 地址 |
| DB_PORT | 3306 | MySQL 端口 |
| DB_USER | d_design | MySQL 用户名 |
| DB_PASSWORD | (生产必须自定义) | MySQL 密码 |
| DB_NAME | d_design_art | MySQL 数据库名 |
| UPLOAD_DIR | ./upload | 上传文件存储目录 |
| LOG_DIR | ./logs | 日志目录 |
| DISABLE_RATE_LIMIT | (空) | 设为 1 跳过频率限制 |

### B. 快速部署检查清单

- [ ] `.env.production` 已修改 JWT_SECRET（>32字符随机串）
- [ ] `.env.production` 已修改 DB_PASSWORD（与 docker-compose.yml 一致）
- [ ] 宿主机 `D:/Nexus_BOX` 目录已创建
- [ ] 防火墙已开放 18632 端口
- [ ] `docker compose up -d --build` 执行成功
- [ ] `curl http://localhost:18632/api/health` 返回 `{"code":0,"msg":"ok"}`
- [ ] 客户端可访问 `http://<服务器IP>:18632` 看到登录页
