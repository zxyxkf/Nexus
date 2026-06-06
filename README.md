# D-Design 美工任务管理系统

> 电商公司内部美工任务管理 — 企业级 Windows 桌面客户端

---

## 📦 系统概述

D-Design 是一款面向电商公司的美工任务管理桌面软件，采用 **Electron + Vue3 + Express + MySQL** 架构，提供运营发布任务、美工接单完成、管理员全局管控的完整流程。

### 核心特性

- ✅ 三角色权限体系：超级管理员 / 运营 / 美工，严格数据隔离
- ✅ 本地独立 MySQL 数据库，数据安全可控
- ✅ 一键安装 EXE，内嵌 Express 后端服务，无需额外部署服务器
- ✅ JWT 鉴权 + BCrypt 密码加密 + 操作日志审计
- ✅ 文件上传严格校验（格式/大小/路径安全）
- ✅ 数据库级事务保护，防止脏数据
- ✅ ECharts 数据仪表盘，直观展示运营数据

---

## 🏗 技术架构

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面壳 | Electron 29 | Windows 桌面容器 |
| 前端 | Vue 3 + Vite 5 + Element Plus | 响应式 UI |
| 图表 | ECharts 5 | 仪表盘数据可视化 |
| 后端 | Express 4 (内嵌 Electron) | 轻量 API 服务 |
| 数据库 | MySQL 8.0+ | 本地独立数据库 |
| 认证 | JWT + BCrypt | 安全鉴权 |
| 打包 | electron-builder + NSIS | 一键安装 EXE |

---

## 📁 项目结构

```
d-design-art-manager/
├── electron/
│   ├── main.js                    # Electron 主进程
│   ├── preload.js                 # 安全 IPC 桥接
│   └── server/
│       ├── index.js               # Express 服务入口
│       ├── config/
│       │   └── database.js        # 数据库连接池 + 事务
│       ├── middleware/
│       │   └── auth.js            # JWT 鉴权 + 角色校验
│       ├── routes/
│       │   ├── auth.js            # 登录/修改密码
│       │   ├── user.js            # 用户管理 (admin)
│       │   ├── task.js            # 任务 CRUD + 审核 + 统计
│       │   ├── log.js             # 操作日志 (admin)
│       │   └── config.js          # 系统配置 (admin)
│       └── utils/
│           ├── operLog.js         # 操作日志写入
│           └── upload.js          # 文件上传处理
├── src/
│   ├── main.js                    # Vue 入口
│   ├── App.vue                    # 根组件
│   ├── router/index.js            # 路由 + 权限守卫
│   ├── store/index.js             # Pinia 状态管理
│   ├── api/index.js               # Axios 封装 + API
│   ├── utils/auth.js              # Token 管理
│   └── views/
│       ├── Layout.vue             # 主布局
│       ├── login/Login.vue        # 登录页
│       ├── operator/              # 运营端
│       │   ├── Publish.vue        # 发布任务
│       │   ├── MyTasks.vue        # 我的任务
│       │   ├── Review.vue         # 作品审核
│       │   └── Stats.vue          # 个人统计
│       ├── designer/              # 美工端
│       │   ├── TaskHall.vue       # 任务大厅
│       │   ├── MyTasks.vue        # 我的接单
│       │   └── Stats.vue          # 个人统计
│       └── admin/                 # 管理员端
│           ├── Dashboard.vue      # 数据仪表盘
│           ├── Users.vue          # 用户管理
│           ├── AllTasks.vue       # 全量任务
│           ├── Logs.vue           # 操作日志
│           └── Config.vue         # 系统配置
├── database/
│   └── init.sql                   # MySQL 建表 + 初始化
├── upload/                        # 文件存储目录
│   ├── images/                    # 图片文件
│   └── attachments/               # 附件文件
├── build/
│   └── icon.svg                   # 应用图标源文件
├── package.json                   # 依赖 + electron-builder 配置
├── vite.config.js                 # Vite 构建配置
└── README.md                      # 本文件
```

---

## 🗄 MySQL 部署说明

### 环境要求
- MySQL 8.0 或更高版本
- 推荐使用本机安装或 Docker 运行

### 安装步骤

#### 方式一：本地安装 MySQL

1. 下载 MySQL Community Server 8.0+：https://dev.mysql.com/downloads/mysql/
2. 安装并启动 MySQL 服务
3. 登录 MySQL 创建数据库用户：

```sql
CREATE USER 'd_design'@'127.0.0.1' IDENTIFIED BY 'DDesign@2024!Secure';
GRANT ALL PRIVILEGES ON d_design_art.* TO 'd_design'@'127.0.0.1';
FLUSH PRIVILEGES;
```

4. 执行初始化 SQL：

```bash
mysql -u root -p < database/init.sql
```

5. 或者让软件自动初始化（首次启动时，应用会自动检测并建表）

#### 方式二：Docker 运行 MySQL

```bash
docker run -d \
  --name d-design-mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=d_design_art \
  -e MYSQL_USER=d_design \
  -e MYSQL_PASSWORD=DDesign@2024!Secure \
  -p 3306:3306 \
  mysql:8.0
```

### 连接配置

应用默认的数据库连接配置在 `electron/server/config/database.js` 中：

| 参数 | 默认值 |
|------|--------|
| 主机 | 127.0.0.1 |
| 端口 | 3306 |
| 数据库 | d_design_art |
| 用户 | d_design |
| 密码 | DDesign@2024!Secure |

> ⚠️ 生产环境请务必修改数据库密码！

---

## 🚀 开发与运行

### 环境要求
- Node.js 18+ (推荐 20 LTS)
- npm 8+ 或 yarn
- MySQL 8.0+

### 安装依赖

```bash
cd d-design-art-manager
npm install
```

### 开发模式运行

```bash
# 同时启动 Vite 前端 + Electron 窗口
npm run electron:dev
```

### 生产构建打包

```bash
# 构建 Vue 前端 + 打包 EXE 一键安装包
npm run electron:build
```

打包后的安装包在 `release/` 目录下：
- `D-Design美工任务管理-Setup-1.0.0.exe` — 一键安装包

---

## 📦 EXE 打包配置

electron-builder 配置已集成在 `package.json` 的 `build` 字段中，主要配置：

| 配置项 | 值 |
|--------|-----|
| 应用 ID | com.d-design.art-manager |
| 产品名称 | D-Design美工任务管理 |
| 安装方式 | NSIS 一键安装 |
| 架构 | x64 |
| 允许自定义安装目录 | 是 |
| 创建桌面快捷方式 | 是 |

### 自定义图标

将 `build/icon.svg` 转换为 `build/icon.ico`：

```bash
# 方式1: 使用在线工具转换
# 访问 https://cloudconvert.com/svg-to-ico

# 方式2: 使用 ImageMagick
convert build/icon.svg -resize 256x256 build/icon.ico
```

---

## 🔐 权限体系说明

### 三角色权限矩阵

| 功能模块 | 超级管理员(admin) | 运营(operator) | 美工(designer) |
|----------|:---:|:---:|:---:|
| 登录 | ✅ | ✅ | ✅ |
| 发布任务 | ✅ | ✅ | ❌ |
| 查看自己的任务 | ✅ | ✅ | ❌ |
| 查看所有任务 | ✅ | ❌ | ❌ |
| 任务大厅（待接单） | ✅ | ❌ | ✅ |
| 接单 | ❌ | ❌ | ✅ |
| 上传作品 | ❌ | ❌ | ✅ |
| 审核作品 | ✅ | 仅自己的 | ❌ |
| 用户管理 | ✅ | ❌ | ❌ |
| 系统配置 | ✅ | ❌ | ❌ |
| 操作日志 | ✅ | ❌ | ❌ |
| 数据仪表盘 | ✅ | ❌ | ❌ |
| 个人统计 | ✅ | ✅ | ✅ |

### 默认账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 超级管理员 | admin | admin123 | 首次登录请修改密码 |
| 运营 | oper | oper123 | 需管理员在后台创建 |
| 美工 | des | des123 | 需管理员在后台创建 |

---

## 📋 数据库表结构

### 5 张核心表

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| sys_user | 用户表 | username, password(BCrypt), role, status |
| task_info | 任务表 | task_no, title, status(5种状态), publisher_id, designer_id |
| task_file | 任务文件表 | task_id, file_path(仅存路径), file_type |
| sys_oper_log | 操作日志表 | user_id, operation, request_url, result_code |
| sys_config | 系统配置表 | config_key, config_value, config_group |

### 任务状态流转

```
wait(待接单) → accepted(已接单) → doing(作图中) → finished(已完成)
                                                     ↘ rejected(已驳回)
```

---

## 🛡 安全策略

1. **密码安全**: BCrypt 加密存储，不可逆
2. **接口鉴权**: JWT Token 认证，12小时过期
3. **角色校验**: 前端路由守卫 + 后端中间件双重校验
4. **数据隔离**: 运营只能看自己的任务，美工只能接单/操作自己的任务
5. **事务保护**: 所有状态变更、文件上传、审核操作均使用数据库事务
6. **文件安全**: UUID 重命名防覆盖、格式校验、防路径穿越
7. **日志审计**: 所有关键操作记录日志，可追溯
8. **全局异常**: 统一异常拦截，防止敏感信息泄露

---

## 🧪 初始化测试数据

应用首次启动时会自动：
1. 检查数据库是否存在，不存在则自动创建
2. 检查表是否存在，不存在则自动执行 `database/init.sql`
3. 初始化 admin 账号（密码通过 BCrypt 加密后写入）
4. 写入默认系统配置

---

## ❓ 常见问题

**Q: 应用启动报数据库连接失败？**
A: 请确认 MySQL 服务已启动，且 `d_design` 用户有访问权限。

**Q: 如何修改数据库配置？**
A: 编辑 `electron/server/config/database.js` 中的 `DB_CONFIG` 对象。

**Q: 打包后的 EXE 在哪里？**
A: 执行 `npm run electron:build` 后，在 `release/` 目录下。

**Q: 上传的文件存到哪里了？**
A: 存储在软件安装目录下的 `upload/` 文件夹中，按日期分子目录。

---

## 📄 License

Copyright © 2024 D-Design. All rights reserved.
