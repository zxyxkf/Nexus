const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, VerticalAlign
} = require('docx');

const FONT = "Microsoft YaHei";
const FS = 21;       // 10.5pt body
const FS_SMALL = 19; // 9.5pt
const FS_SEC = 24;   // 12pt section header
const FS_NAME = 36;  // 18pt name

const B = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const CB = { top: B, bottom: B, left: B, right: B };
const GRAY = { type: ShadingType.SOLID, color: "E8E8E8" };
const LIGHT = { type: ShadingType.SOLID, color: "F5F5F5" };
const CD = { borders: CB, verticalAlign: VerticalAlign.MIDDLE };

function labelCell(text, w) {
  return new TableCell({ ...CD, width: { size: w, type: WidthType.PERCENTAGE }, shading: GRAY,
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: FS, font: FONT })] })] });
}
function valCell(text, w, opts) {
  return new TableCell({ ...CD, width: { size: w, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ alignment: opts?.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, size: opts?.small ? FS_SMALL : FS, font: FONT, bold: !!opts?.bold })] })] });
}
function secCell(title) {
  return new TableCell({ ...CD, width: { size: 14, type: WidthType.PERCENTAGE }, shading: GRAY,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title, bold: true, size: FS_SEC, font: FONT })] })] });
}
function contentCell(children) {
  return new TableCell({ ...CD, width: { size: 86, type: WidthType.PERCENTAGE },
    children: Array.isArray(children) ? children : [children] });
}

function txt(text, opts) {
  return new TextRun({ text, size: opts?.small ? FS_SMALL : opts?.big ? FS + 3 : opts?.big2 ? FS + 2 : FS, font: FONT, bold: !!opts?.bold, color: opts?.color });
}
function para(runs, opts) {
  return new Paragraph({ spacing: { after: opts?.after || 60, line: 320 }, indent: opts?.indent ? { left: opts.indent } : undefined,
    alignment: opts?.center ? AlignmentType.CENTER : undefined, children: Array.isArray(runs) ? runs : [runs] });
}
function bp(text, boldPre) {
  const r = [];
  if (boldPre) r.push(txt(boldPre, { bold: true }));
  r.push(txt(text));
  return new Paragraph({ spacing: { after: 50, line: 320 }, indent: { left: 360, hanging: 180 }, children: r, bullet: { level: 0 } });
}
function sp(extra) { return new Paragraph({ spacing: { after: extra || 40 }, children: [] }); }

// TITLE ROW: company | role | date
function titleRow(company, role, date, opts) {
  return new Paragraph({ spacing: { before: opts?.first ? 60 : opts?.before || 80, after: 80 },
    children: [
      txt(company, { bold: true, big: !!opts?.big, big2: !opts?.big }),
      txt("    |    " + role, {}),
      txt("    " + date, { small: true, color: "666666" }),
    ] });
}

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: FS } } } },
  sections: [{
    properties: { page: { margin: { top: 720, bottom: 720, left: 850, right: 850 } } },
    children: [

      // ==================== 个人信息 ====================
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ children: [
          new TableCell({ ...CD, width: { size: 8, type: WidthType.PERCENTAGE }, shading: LIGHT,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "朱想意", bold: true, size: FS_NAME, font: FONT })] })] }),
          labelCell("性 别", 5), valCell("男", 5, { center: true }),
          labelCell("年 龄", 5), valCell("25岁", 5, { center: true }),
          labelCell("联系电话", 7), valCell("15871308201", 11, { center: true }),
          labelCell("电子邮箱", 7), valCell("ZXY15871308201@163.com", 17, { center: true, small: true }),
        ] }),
        new TableRow({ children: [
          labelCell("工作经验", 10), valCell("3年", 8, { center: true }),
          labelCell("求职意向", 10), valCell("实施工程师 / 全栈开发", 20, { center: true, bold: true }),
          labelCell("期望薪资", 10), valCell("6-10K", 8, { center: true }),
          labelCell("期望城市", 10), valCell("武汉", 8, { center: true }),
        ] })
      ] }),

      sp(),

      // ==================== 个人优势 ====================
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ children: [
          secCell("个人优势"),
          contentCell([
            bp("拥有 3 年一线运维实战经验，同时具备独立完成企业级应用从 0 到 1 的全流程交付能力", "全栈开发 × 系统运维复合型人才："),

            sp(20),
            para([txt("核心技术栈", { bold: true })], { indent: 200 }),
            bp("Vue 3 全家桶（Composition API + Pinia + Vue Router）+ Element Plus 组件库 + Vite 工程化构建", "前端："),
            bp("Node.js + Express 框架，RESTful API 设计，JWT 鉴权与 RBAC 多角色权限控制体系", "后端："),
            bp("MySQL 深度应用（表结构设计、复杂 SQL 查询、索引优化）+ SQLite 嵌入式数据库，实现 MySQL/SQLite 双引擎自适应方案", "数据库："),
            bp("Electron 跨平台桌面应用开发，Electron Builder 打包 + NSIS 安装器定制 + Electron Updater 自动增量更新", "桌面端："),
            bp("Socket.IO WebSocket 实时推送，ECharts 多维度数据可视化仪表盘与统计看板", "实时通信与可视化："),
            bp("Linux 系统管理、Nginx 反向代理配置、PM2 进程守护、自动化部署脚本编写", "运维与部署："),
            bp("Git 版本控制、前后端分离架构设计、MVC 三层解耦模式，代码规范意识强", "工程化能力："),

            sp(20),
            para([txt("Java 生态：SSM 框架（Spring + Spring MVC + MyBatis）项目开发经验", {})], { indent: 200 }),
            para([txt("其他：Python 脚本开发、SQL Server 数据库、禅道测试管理工具、软件测试流程", {})], { indent: 200 }),
            para([txt("达梦数据库大赛全国三等奖。学习能力强，对技术有持续热情，抗压能力出色，具备良好的团队协作与跨部门沟通能力。", {})], { indent: 200 }),
          ])
        ] })
      ] }),

      sp(),

      // ==================== 工作经历 ====================
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ children: [
          secCell("工作经历"),
          contentCell([
            titleRow("武汉亿方云科技有限公司", "运维工程师", "2023.12 - 2024.10"),
            bp("负责网络设备、安全设备、监控系统、机房基础设施的全生命周期运维管理，确保客户业务系统高可用运行", "基础设施运维："),
            bp("主导设备定期巡检与健康检查机制，及时发现并消除潜在隐患，制定预防性维护计划", "主动运维："),
            bp("对故障进行根因分析与归类统计，建立故障知识库，推动团队从被动响应向主动预防的运维模式转型", "故障管理："),
            bp("编写标准化运维操作手册、设备保养规程及应急处置预案，规范化日常维护流程，显著提升团队运维效率", "流程标准化："),
            bp("对所管辖区域设备运行数据进行系统性采集、统计与趋势分析，输出周期性运维分析报告辅助管理决策", "数据驱动："),
          ])
        ] })
      ] }),

      sp(),

      // ==================== 实习经历 ====================
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ children: [
          secCell("实习经历"),
          contentCell([
            titleRow("极蕊科技（武汉）有限公司", "运维工程师（实习）", "2023.06 - 2023.12"),
            bp("独立对接多地医疗机构医保系统，完成系统联调、接口测试与上线验收，确保医保结算链路稳定可靠", "系统集成对接："),
            bp("精准编制医疗机构医保定点申报全套材料（资质审核、系统说明、安全评估），保障申报一次性通过", "文档与合规："),
            bp("组织医护人员开展系统操作与医保政策培训，独立制作培训课件与操作手册，累计覆盖多个医疗机构", "培训赋能："),
            bp("指导医保报销全流程落地实施，结合实际场景持续优化操作规范，确保合规高效运行", "流程落地："),
            bp("作为一线技术支持窗口，建立问题分级响应机制，高效处理日常系统及医保业务咨询，持续提升服务满意度", "技术支持："),
          ])
        ] })
      ] }),

      sp(),

      // ==================== 项目经历 ====================
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ children: [
          secCell("项目经历"),
          contentCell([

            // ==== 项目一：Nexus ====
            titleRow("Nexus 企业级多角色任务管理系统", "全栈独立开发", "2024.06 - 2026.05（v15.0.5）", { big: true, first: true }),
            para([txt("技术栈：Vue 3 + Element Plus + Pinia + Electron + Express.js + MySQL + SQLite + Socket.IO + ECharts + JWT + NSIS", {})]),
            para([txt("项目角色：全栈独立开发（需求分析 → 架构设计 → 前后端编码 → 测试 → 打包分发 → 生产部署与运维）", {})]),
            sp(20),
            para([txt("面向电商设计团队的桌面端任务协作平台，基于 Electron 构建跨平台桌面客户端，服务端采用 Express + MySQL/SQLite 双引擎架构。系统覆盖超级管理员、子管理员、运营、运营助理、美工、基础美工、客服共 7 个角色，实现任务发布 → 接单 → 提交审核 → 积分核算的完整业务闭环，持续迭代至 v15.0.5 版本。", {})], { indent: 200 }),

            sp(30),
            para([txt("—— 核心技术实践 ——", { bold: true })], { indent: 200 }),

            bp("独立设计 MVC 三层解耦架构（Route → Service → DAO），各层职责清晰、可测试性强，提升代码复用率与维护效率。数据库采用 MySQL + SQLite 双引擎自适应方案，同一套 SQL 语法同时适配生产环境与离线场景，服务启动时自动执行 DDL 迁移修复。", "全栈架构设计："),
            bp("基于 JWT 实现无状态鉴权体系，自研角色白名单中间件（requireRole）与数据归属校验中间件（checkDataOwnership），覆盖 7 种角色 30+ 页面的细粒度权限隔离，有效防止水平越权与垂直越权攻击。", "安全权限体系："),
            bp("设计任务状态机引擎（草稿 → 待接单 → 已接单 → 进行中 → 待审核 → 已完成/已驳回），管理 6 种状态的流转规则，支持指派、接单、转交、撤回再编辑、批量审核等 10+ 种业务操作。三类任务组（设计/客服/运营）各自独立的积分核算体系，支持管理员动态配置工作项目与分值。", "任务工作流引擎："),
            bp("基于 ECharts 构建多维度数据仪表盘，实现个人/管理员双视角的积分统计、月度趋势图、人员排名看板与 Excel 数据导出。利用 Socket.IO 实现 WebSocket 长连接推送，任务状态变更、审核结果、催办等事件实时触达相关用户。", "数据统计与实时通信："),
            bp("集成 Multer 多文件上传模块，实现参考图与完成凭证的分类管理、图片预览、拖拽下载等功能，并解决 Electron 环境下的文件路径编码兼容问题。", "文件管理："),
            bp("配置 Electron Builder 生成 NSIS 安装包（含定制 installer.nsh 安装脚本），搭建 Generic Provider 自动更新服务，通过 latest.yml + blockmap 实现增量更新，大幅降低客户端升级的带宽成本。服务端配置 Nginx 反向代理 + PM2 进程守护，实现代码覆盖式平滑升级。", "工程化与分发："),

            sp(40),

            // ==== 项目二：学生管理系统 ====
            titleRow("学生管理系统", "主导 UI 设计 + 数据库建模 + 后台业务逻辑", "2022.02"),
            para([txt("涵盖学生信息管理、学籍管理、成绩管理、考勤管理、课程管理、教师管理、统计分析、权限安全、班级管理、通知公告等 11 个功能模块的完整信息管理系统。", {})], { indent: 200 }),
            sp(10),
            para([txt("核心贡献：", { bold: true })], { indent: 200 }),
            bp("独立完成数据库 ER 模型设计，覆盖学生、教师、课程、班级、成绩等核心实体关系的规范化建模，保障数据一致性与查询效率"),
            bp("实现各模块的 CRUD 操作与多表关联查询，支持多维度统计报表生成与 ECharts 图表可视化展示"),
            bp("设计基于角色的用户权限管理体系，包含登录注册、密码加密存储、数据备份恢复、数据加密传输等安全机制"),

            sp(40),

            // ==== 项目三：网上商城 ====
            titleRow("网上商城管理系统", "后端开发 + 数据库设计", "2021.12 - 2022.02"),
            para([txt("技术栈：SSM（Spring + Spring MVC + MyBatis）+ 前后端分离架构", {})]),
            para([txt("面向汽车配件行业的 B2C 在线商城，区分管理员与普通用户角色，涵盖商品浏览、购物车、订单管理、库存管理、用户管理、物流追踪等完整电商功能链。", {})], { indent: 200 }),
            sp(10),
            para([txt("核心贡献：", { bold: true })], { indent: 200 }),
            bp("基于 SSM 框架实现后端三层架构，Controller 接收请求并校验参数 → Service 处理业务逻辑与事务 → DAO 完成数据持久化"),
            bp("设计商品管理、订单流转、库存扣减、购物车状态同步等核心业务模块的数据库表结构与接口契约"),
            bp("后台管理系统支持实时监控用户行为、商品库存预警、订单状态跟踪，实现业务数据的可视化管控"),
          ])
        ] })
      ] }),

      sp(),

      // ==================== 教育经历 ====================
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ children: [
          secCell("教育经历"),
          contentCell([
            titleRow("鄂州职业大学", "大专  |  移动互联应用技术", "2020 - 2023"),
            bp("专业核心课程成绩名列前茅，期中/期末平均分 90 分以上"),
            bp("多次在校内开发类竞赛中获得前三名"),
            bp("荣获国产数据库大赛（达梦）全国三等奖"),
            bp("担任学生会干事，具备良好的组织协调与沟通表达能力"),
          ])
        ] })
      ] }),

      sp(),

      // ==================== 资格证书 ====================
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ children: [
          secCell("资格证书"),
          contentCell([
            para([txt("UI 设计工程师（中级）    |    中级网络安全管理员", {})]),
          ])
        ] })
      ] }),

    ]
  }]
});

// ==========================================
Packer.toBuffer(doc).then(buffer => {
  const outPath = "C:\\Users\\26239\\Desktop\\项目优化流程\\朱想意-个人简历.docx";
  fs.mkdirSync("C:\\Users\\26239\\Desktop\\项目优化流程", { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log("已生成: " + outPath);
}).catch(err => { console.error(err); process.exit(1); });
