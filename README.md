# Nexus

Nexus 是一套面向电商设计、运营、客服协作场景的任务管理系统。系统覆盖从任务发布、接单、上传、审核、驳回、留存、统计到权限分配的完整流程，支持 Web 端、Windows 桌面客户端和独立后端服务部署。

当前版本：`15.2.3`

## 项目定位

Nexus 解决的是多角色、多任务类型、多审核链路下的协同管理问题。系统核心不是单纯的任务列表，而是围绕三条业务线建立可追踪、可统计、可授权的闭环：

| 业务线 | 发布方 | 执行方 | 审核方 | 典型结果 |
| --- | --- | --- | --- | --- |
| 运营 & 美工设计师 | 运营 | 美工设计师 | 运营 | 作品审核通过后进入运营我的任务留存 |
| 运营 & 运营助理 | 运营 | 运营助理 | 运营 | 任务审核通过后进入我的运营任务留存 |
| 客服 & 基础美工 | 客服 | 基础美工 | 客服 / 基础美工组长 | 客服审核通过后最终计分和留存 |

系统同时支持管理员按页面和功能给任意角色分配额外权限。例如可以给运营角色分配客服发布任务权限，也可以给美工设计师分配某个全量任务分区的查看权限。

## 核心能力

- 多角色协作：超级管理员、子管理员、运营、客服、美工设计师、基础美工、运营助理。
- 任务全流程：发布、接单、待做、待审核、审核通过、驳回、撤回、重开、留存。
- 动态权限：按页面、功能、全量任务分区、仪表盘分区配置权限。
- 全量任务：按业务线拆分为运营美工全量任务、运营助理全量任务、客服基础美工全量任务。
- 数据仪表盘：高级美工、运营助理、基础美工三类仪表盘，支持日统计、月统计、人员统计和导出。
- 文件处理：参考图、作品、完成凭证、附件上传，支持截图粘贴、拖入、下载和拖出到本地应用。
- 基础美工计分：支持申请分数、组长分数审核、客服最终审核，最终分值以客服审核通过为准。
- 实时体验：Socket.IO 推送任务状态变化，桌面通知、通知音效、通知中心。
- 表格效率：列设置、列宽拖动保存、发布时间排序、发布人/日期/工作项目筛选。
- 审计与配置：操作日志、系统配置、上传目录、上传限制、店铺管理、公告管理。
- 多部署形态：本地开发、Windows 服务器、Docker Compose、Electron 安装包。

## 技术架构

```text
┌──────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  Vue 3 SPA / Element Plus / ECharts / Electron Windows Shell │
└───────────────────────────────┬──────────────────────────────┘
                                │ HTTP + WebSocket
┌───────────────────────────────▼──────────────────────────────┐
│                      standalone-server                       │
│  Express Routes → Service Layer → DAO → MySQL / SQLite       │
│  JWT Auth / Permission Engine / File Storage / Socket.IO     │
└───────────────────────────────┬──────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────┐
│                         Data Layer                           │
│  MySQL production database / SQLite local fallback           │
│  task_info, task_file, sys_user, sys_permission, logs, etc.   │
└──────────────────────────────────────────────────────────────┘
```

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3, Vite, Vue Router, Element Plus, ECharts, Axios |
| 桌面端 | Electron, electron-builder, electron-updater |
| 后端 | Node.js, Express, Socket.IO, JWT, Multer, ExcelJS |
| 数据库 | MySQL 8.0+, SQLite/sql.js fallback |
| 测试 | Jest, Supertest, Playwright |
| 部署 | Windows service/batch, PM2, Docker Compose |

## 目录结构

```text
d-design-art-manager/
├─ src/                         # Vue 前端源码
│  ├─ api/                      # Axios API 封装
│  ├─ components/               # 通用组件
│  ├─ composables/              # 复用逻辑
│  ├─ config/menus.js           # 侧边栏菜单配置
│  ├─ router/index.js           # 路由与前端权限守卫
│  ├─ utils/permissions.js      # 前端权限推导
│  └─ views/                    # 各角色页面
├─ electron/                    # Electron 主进程、预加载和桌面通知
├─ standalone-server/           # 独立后端服务
│  ├─ app.js                    # Express 应用工厂
│  ├─ server.js                 # HTTP + Socket.IO 启动入口
│  ├─ config/                   # 环境、数据库、权限配置
│  ├─ dao/                      # SQL 数据访问层
│  ├─ routes/                   # API 路由
│  ├─ services/                 # 业务逻辑层
│  ├─ utils/                    # 文件、通知、日志、权限等工具
│  └─ tests/                    # Jest/Supertest 测试
├─ database/                    # 初始化 SQL 与迁移说明
├─ build/                       # 图标、更新配置、NSIS 脚本
├─ dist/                        # 前端构建产物
├─ release/                     # Electron 打包产物
├─ docker-compose.yml           # Docker 编排
├─ Dockerfile                   # 前端构建 + 后端运行多阶段镜像
└─ package.json                 # 前端和 Electron 脚本
```

## 角色与默认入口

| 角色 | 默认职责 |
| --- | --- |
| 超级管理员 | 用户管理、权限配置、系统配置、全量任务、仪表盘、日志 |
| 子管理员 | 仪表盘、全量任务、分数审核等管理能力，具体以权限配置为准 |
| 运营 | 发布美工任务、发布运营助理任务、审核自己发布的作品/任务、查看同店铺记录 |
| 客服 | 发布基础美工任务、审核基础美工作品、修改/重开客服基础美工任务 |
| 美工设计师 | 任务大厅接单、待做任务、待审核任务、上传作品、个人统计 |
| 运营助理 | 任务大厅接单、提交完成凭证或完成次数、个人统计 |
| 基础美工 | 任务大厅接单、上传作品、申请分数、转移任务、个人统计 |

## 权限模型

权限分为两类：

- 页面权限：决定侧边栏入口和路由访问，例如 `admin.tasks.design`、`dashboard.cs`。
- 操作权限：决定具体动作能力，例如 `task.upload.work`、`task.export`、`cs.task_no.update`。

后端以 `standalone-server/config/permissions.js` 为权限目录，登录后下发有效权限。前端以 `src/utils/permissions.js` 做菜单和路由判断。关键业务接口仍在后端二次校验，不能只依赖前端隐藏按钮。

重要规则：

- 超级管理员可以配置自己的权限，但不能取消自己的用户管理权限。
- 全量任务权限按分区生效：`admin.tasks.design`、`admin.tasks.operator`、`admin.tasks.cs`。
- 单个全量任务分区权限不等于全局 `task.view.all`。
- 分区权限会影响全量任务列表、详情、筛选下拉、导出、批量下载和搜索可见范围。

## 任务状态流

```text
wait       待接单
accepted   已接单 / 待做
doing      已提交 / 待审核
finished   审核通过 / 留存
rejected   驳回 / 待重新提交
draft      发布方撤回后的草稿状态
```

典型流程：

1. 发布方创建任务，可指定接单人，也可进入任务大厅等待接单。
2. 接单方在待做任务中上传作品、凭证或填写完成次数。
3. 提交后进入待审核任务，发布方在审核界面处理。
4. 审核通过后进入发布方我的任务或我的运营任务留存。
5. 驳回后回到接单方待做任务，接单方可重新上传提交。

客服基础美工分值规则：

- 基础美工上传时可填写申请分数。
- 申请分数大于 1 时，基础美工组长可审核申请分数。
- 最终计分以客服审核通过为准。
- 客服驳回时，本次分数申请不计入最终统计。

## 本地开发

环境要求：

- Node.js 20 LTS
- npm 9+
- Windows 10/11 或 Windows Server
- MySQL 可选，默认可使用 SQLite fallback

安装依赖：

```bash
npm install
cd standalone-server
npm install
```

启动前端开发服务：

```bash
npm run dev
```

启动后端：

```bash
cd standalone-server
npm start
```

同时启动前后端：

```bash
npm run dev:full
```

默认端口：

| 服务 | 地址 |
| --- | --- |
| Vite 开发服务 | `http://127.0.0.1:5173` |
| 后端 API / 生产网页端 | `http://127.0.0.1:18632` |
| 服务器默认地址 | `http://192.168.101.78:18632` |

## 环境变量

后端环境文件位于 `standalone-server/.env.development` 和 `standalone-server/.env.production`。可参考 `standalone-server/.env.example`。

常用变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `development` | 运行环境 |
| `PORT` | `18632` | HTTP 和 WebSocket 服务端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `JWT_SECRET` | 开发默认值 | 生产环境必须替换 |
| `USE_MYSQL` | `0` | `1` 使用 MySQL，`0` 使用 SQLite |
| `DB_HOST` | `127.0.0.1` | MySQL 地址 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_USER` | `d_design` | MySQL 用户 |
| `DB_PASSWORD` | 开发默认值 | 生产环境必须替换 |
| `DB_NAME` | `d_design_art` | 数据库名 |
| `UPLOAD_DIR` | `standalone-server/upload` | 上传文件目录 |
| `LOG_DIR` | `standalone-server/logs` | 日志目录 |

生产环境不要提交真实密码、JWT 密钥或服务器敏感配置。

## 构建与打包

构建前端：

```bash
npm run build
```

产物输出到 `dist/`。生产后端会自动托管该目录，浏览器可直接访问后端地址打开系统。

运行 Electron 开发模式：

```bash
npm run electron:dev
```

打包 Windows 安装包：

```bash
npm run electron:build
```

产物输出到 `release/`，文件名格式为：

```text
Nexus-v<version>-Setup.exe
Nexus-v<version>-Setup.exe.blockmap
latest.yml
```

自动更新地址由 `package.json` 和 `build/app-update.yml` 配置，当前默认指向：

```text
http://192.168.101.78:18632/releases
```

## 服务器部署

### Windows 服务器手动部署

常规覆盖内容：

```text
dist/                                      # 前端构建产物
standalone-server/                        # 后端代码，按变更覆盖
standalone-server/package.json
standalone-server/package-lock.json       # 依赖变化时覆盖
standalone-server/.env.production         # 只在首次部署或配置变化时处理
```

覆盖后重启后端服务。

如果只是前端或业务代码变化，不一定需要重新打包 Electron 安装包。只有需要分发新的桌面客户端、Electron 主进程变化、更新配置变化或版本号发布时，才需要重新打包。

### Docker Compose 部署

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
docker compose logs -f nexus-server
```

停止服务：

```bash
docker compose down
```

注意：不要随意执行 `docker compose down -v`，它会删除数据库和文件 Volume。

## 数据库与迁移

后端启动时会执行数据库初始化和兼容性迁移：

- `CREATE TABLE IF NOT EXISTS` 创建缺失表。
- 对历史库执行必要的 `ALTER TABLE ADD COLUMN`。
- 兼容 MySQL 和 SQLite。
- 任务编号允许重复，用于适配多个任务对应同一业务方的场景。

生产环境使用 MySQL 时，升级前仍建议备份：

```bash
mysqldump -u <user> -p <database> > nexus_backup.sql
```

## 文件存储

系统文件分为参考文件、作品文件、完成凭证等类型，记录保存在 `task_file` 表，真实文件存储在配置目录中。

默认生产共享目录约定：

```text
D:/Nexus_BOX/
├─ design/
├─ operator/
└─ cs/
```

实际目录可通过系统配置和环境变量调整。上传文件会进行路径解析和类型处理，避免直接暴露任意本地路径。

## 测试

后端完整测试：

```bash
cd standalone-server
npm test -- --runInBand
```

指定测试文件：

```bash
cd standalone-server
npm test -- --runInBand tests/api/task.test.js
```

前端构建验证：

```bash
npm run build
```

Playwright 冒烟测试：

```bash
npx playwright test
```

当前 15.2.3 后端验证结果：

```text
12 test suites passed
135 tests passed
```

## 版本发布流程

建议发布流程：

1. 完成开发并通过后端测试。
2. 执行 `npm run build` 生成最新 `dist/`。
3. 如需要桌面客户端分发，更新 `package.json` 版本号并执行 `npm run electron:build`。
4. 确认 `latest.yml`、`.blockmap`、安装包版本一致。
5. 将源码提交并推送远程仓库。
6. 服务器覆盖后端变更文件和 `dist/`。
7. 重启后端。
8. 浏览器访问 `http://服务器IP:18632` 验证。

## 15.2.3 重点更新

相对 15.2.2，15.2.3 是一次中大型功能更新，重点包括：

- 权限体系升级为页面和功能级动态分配。
- 修复普通角色额外权限保存后菜单不生效的问题。
- 全量任务分区权限覆盖列表、详情、导出、下载、搜索和筛选。
- 优化高级美工、运营助理、基础美工仪表盘和导出逻辑。
- 优化任务详情页结构，增加时间线、分数审核、转移记录等信息。
- 美工和运营助理待做任务支持表格内暂存上传，点击提交后正式提交。
- 客服基础美工流程支持已完成任务重开、编号修改、分数最终以客服审核为准。
- 催促任务在接单方待做任务中置顶并高亮。
- 表格支持列设置、列宽拖动和持久化。
- 修复侧边栏重复、图标闪烁、详情被操作列覆盖、仪表盘跳转筛选异常等问题。

## 安全与运维建议

- 生产环境必须替换 `JWT_SECRET` 和数据库密码。
- 服务器升级前备份 MySQL 数据库和上传文件目录。
- 不要将 `.env.production` 中的真实密钥提交到公共仓库。
- 普通全量任务分区权限不应替代 `task.view.all`；确需全局查看时再单独授予。
- 定期清理日志和旧安装包，但不要误删上传文件和数据库文件。
- 如果权限变更后用户侧未立即生效，要求用户重新登录。

## 常用地址

| 用途 | 地址 |
| --- | --- |
| 服务器网页端 | `http://192.168.101.78:18632` |
| 健康检查 | `http://192.168.101.78:18632/api/health` |
| 更新包目录 | `http://192.168.101.78:18632/releases` |

## 维护原则

本项目已经进入高频业务使用阶段。后续改动建议遵循以下原则：

- 权限判断必须前后端一致，但以后端校验为准。
- 所有任务状态流转必须考虑三条业务线差异。
- 数据库升级只做兼容性新增，避免破坏历史任务记录。
- 高频页面的交互改动必须验证普通角色和管理员角色。
- 发布前至少执行后端测试和前端构建。
