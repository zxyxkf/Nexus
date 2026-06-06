const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "微软雅黑", size: 24 }
      }
    }
  },
  sections: [{
    children: [
      // ========== 标题 ==========
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "个人技能与项目经验", bold: true, size: 36, font: "微软雅黑" })]
      }),

      // ========== 一、个人技能 ==========
      new Paragraph({
        spacing: { before: 300, after: 200 },
        children: [new TextRun({ text: "一、个人技能", bold: true, size: 32, font: "微软雅黑" })]
      }),

      makeSkill("编程语言", "JavaScript / ES6+、Node.js、HTML5、CSS3、SQL"),
      makeSkill("前端框架", "Vue 3（Composition API + Pinia 状态管理 + Vue Router）、Element Plus UI 组件库、Vite 构建工具"),
      makeSkill("桌面端开发", "Electron 跨平台桌面应用开发，Electron Builder 打包与 NSIS 安装器制作，Electron Updater 自动更新系统"),
      makeSkill("后端开发", "Express.js 框架，RESTful API 设计，JWT 鉴权与 RBAC 角色权限控制，Socket.IO 实时通信"),
      makeSkill("数据库", "MySQL 关系型数据库设计与优化，SQLite 嵌入式数据库，双引擎兼容方案"),
      makeSkill("数据可视化", "ECharts 图表库，动态仪表盘与多维度数据统计"),
      makeSkill("工程化", "Git 版本控制，前后端分离架构，模块化设计，Nginx 反向代理配置，PM2 进程管理"),
      makeSkill("软件设计", "MVC 分层架构，DAO/Service/Route 三层解耦，中间件模式，组件化开发思想"),

      // ========== 二、项目经验 ==========
      new Paragraph({
        spacing: { before: 500, after: 200 },
        children: [new TextRun({ text: "二、项目经验", bold: true, size: 32, font: "微软雅黑" })]
      }),

      // ---- 项目一 ----
      new Paragraph({
        spacing: { before: 300, after: 100 },
        children: [new TextRun({ text: "项目一：Nexus 企业级多角色任务管理系统", bold: true, size: 28, font: "微软雅黑" })]
      }),

      makeItem("项目周期", "2024.06 – 2026.05（持续迭代至 v15.0.5）"),
      makeItem("项目角色", "全栈独立开发"),
      makeItem("技术栈", "Vue 3 + Element Plus + Pinia + Electron + Express.js + MySQL + SQLite + Socket.IO + ECharts"),

      new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }),

      makeSubTitle("项目概述"),
      makeBody("Nexus 是一款面向电商设计团队的桌面端任务管理系统，基于 Electron 构建跨平台桌面应用，服务端采用 Express + MySQL/SQLite 双引擎架构。系统覆盖超级管理员、子管理员、运营、运营助理、美工、基础美工、客服共 7 个角色，实现了从任务发布、接单、提交审核到积分统计的完整业务闭环。"),

      new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }),

      makeSubTitle("核心职责与成果"),

      makeBody("1. 全栈架构设计：独立完成前后端技术选型与架构设计，采用 MVC 分层模式（Route → Service → DAO），实现业务逻辑与数据访问解耦。数据库支持 MySQL 和 SQLite 双引擎自动切换，确保生产环境和本地离线场景兼容运行。"),
      makeBody("2. 权限系统设计：基于 JWT 实现无状态鉴权，结合角色白名单中间件实现细粒度 RBAC 权限控制，覆盖 7 种角色共 30+ 页面路由的权限隔离，设计数据归属校验中间件防止越权操作。"),
      makeBody("3. 任务工作流引擎：设计并实现任务全生命周期管理（草稿 → 待接单 → 已接单 → 进行中 → 待审核 → 已完成/已驳回），支持任务发布、指派、接单、转交、撤回编辑再发布、批量审核等操作，覆盖三种任务组（设计/客服/运营）。"),
      makeBody("4. 多维度数据统计：利用 ECharts 构建数据仪表盘，实现个人/管理员双视角的积分统计、月度趋势、排名看板与明细导出。针对三类任务组设计独立积分项目体系，支持管理员动态配置工作项目与分值。"),
      makeBody("5. 文件管理模块：集成 Multer 实现多文件上传，支持图片预览（Element Plus 图片预览组件）、拖拽下载（HTML5 Drag API）、附件分类管理（参考图/完成凭证），并解决 Electron 环境下文件路径编码兼容问题。"),
      makeBody("6. 实时通知系统：基于 Socket.IO 实现 WebSocket 长连接推送，任务状态变更、审核结果、催办等事件实时触达相关人员，支持按用户/按任务组精准推送。"),
      makeBody("7. 桌面端工程化：配置 Electron Builder 生成 NSIS 安装包，集成 Electron Updater 实现客户端自动检测与静默更新，通过 latest.yml + blockmap 实现增量更新，降低分发带宽成本。"),
      makeBody("8. 生产部署运维：编写自动化数据库迁移脚本（ALTER TABLE 与双引擎适配），配置 Nginx 反向代理 + PM2 进程守护，实现代码覆盖式平滑升级，累计稳定运行支撑团队日常任务管理。"),

      // ---- 项目二 ----
      new Paragraph({
        spacing: { before: 400, after: 100 },
        children: [new TextRun({ text: "项目二：Nexus 客户端自动更新与分发系统", bold: true, size: 28, font: "微软雅黑" })]
      }),

      makeItem("项目角色", "独立开发"),
      makeItem("技术栈", "Electron Builder + NSIS + Generic Provider + 版本语义化"),

      new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }),

      makeSubTitle("项目概述"),
      makeBody("为 Nexus 客户端搭建完整的自动更新体系，实现版本打包、增量分发到客户端静默升级的一体化流程。通过 NSIS 安装脚本定制安装行为，配置 Generic Provider 更新源，利用版本描述文件与增量包实现客户端平滑升级。"),

      new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }),

      makeSubTitle("主要成果"),
      makeBody("  - 配置 NSIS 安装器（installer.nsh），支持自定义安装路径、桌面快捷方式、安装卸载图标等定制化安装体验。"),
      makeBody("  - 搭建 Generic Provider 自动更新服务，生成 latest.yml 版本描述与 .blockmap 增量文件，客户端启动即自动检测并提示更新。"),
      makeBody("  - 版本管理遵循语义化规范，累计迭代发布至 v15.0.5，支撑功能持续交付。"),
    ]
  }]
});

function makeSkill(title, content) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `【${title}】`, bold: true, size: 24, font: "微软雅黑" }),
      new TextRun({ text: content, size: 24, font: "微软雅黑" }),
    ]
  });
}

function makeSubTitle(text) {
  return new Paragraph({
    spacing: { before: 80, after: 60 },
    children: [new TextRun({ text, bold: true, size: 24, font: "微软雅黑" })]
  });
}

function makeBody(text) {
  return new Paragraph({
    spacing: { after: 60 },
    indent: text.startsWith("  -") ? { left: 480 } : text.match(/^\d+\./) ? { left: 240 } : undefined,
    children: [new TextRun({ text, size: 24, font: "微软雅黑" })]
  });
}

function makeItem(label, value) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `【${label}】`, bold: true, size: 24, font: "微软雅黑" }),
      new TextRun({ text: value, size: 24, font: "微软雅黑" }),
    ]
  });
}

Packer.toBuffer(doc).then(buffer => {
  const outPath = "C:\\Users\\26239\\Desktop\\项目优化流程\\个人简历-技能与项目经验.docx";
  fs.mkdirSync("C:\\Users\\26239\\Desktop\\项目优化流程", { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log("已生成: " + outPath);
}).catch(err => {
  console.error("生成失败:", err);
  process.exit(1);
});
