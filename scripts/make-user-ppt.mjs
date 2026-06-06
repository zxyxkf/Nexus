import PptxGenJS from "pptxgenjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pptx = new PptxGenJS();

// ===== 主题配色 =====
const PRI = "2563EB";     // 主色 蓝
const ACC = "F97316";     // 强调 橙
const GRN = "16A34A";     // 绿色 通过
const RED = "DC2626";     // 红色 驳回
const BG_D = "1E293B";    // 深色背景
const TXT_D = "1E293B";   // 深色文字
const TXT_M = "64748B";   // 辅助文字
const WHT = "FFFFFF";     // 白色
const BG_L = "F8FAFC";    // 浅灰背景
const BG_B = "EFF6FF";    // 浅蓝

pptx.defineLayout({ name: "CUSTOM", width: 13.333, height: 7.5 });
pptx.layout = "CUSTOM";

const TOTAL = 25;

// ===== 辅助函数 =====
function footer(s, text) {
  s.addText(text || "Nexus 美工任务管理系统 — 用户使用教程", {
    x: 0.5, y: 7.05, w: 12.3, h: 0.35,
    fontSize: 9, color: TXT_M, align: "center"
  });
}
function pn(s, n) {
  s.addText(`${n} / ${TOTAL}`, {
    x: 11.5, y: 7.05, w: 1.5, h: 0.35,
    fontSize: 9, color: TXT_M, align: "right"
  });
}
function titleBar(s, title, subtitle) {
  s.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: PRI } });
  s.addText(title, { x: 0.6, y: 0.25, w: 10, h: 0.65, fontSize: 26, bold: true, color: TXT_D });
  if (subtitle) s.addText(subtitle, { x: 0.6, y: 0.85, w: 10, h: 0.35, fontSize: 12, color: TXT_M });
}
function cardBox(s, x, y, w, h, color) {
  s.addShape("roundRect", { x, y, w, h, fill: { color: BG_L }, rectRadius: 0.12, line: { color, width: 1.5 } });
}
function cardHeader(s, x, y, w, h, color, text) {
  s.addShape("roundRect", { x, y, w, h, fill: { color }, rectRadius: 0.12 });
  s.addText(text, { x: x + 0.2, y, w: w - 0.4, h, fontSize: 15, bold: true, color: WHT, valign: "middle" });
}
function tipBox(s, text, y) {
  s.addShape("roundRect", { x: 0.6, y: y || 6.4, w: 12.1, h: 0.5, fill: { color: "FFF7ED" }, rectRadius: 0.1, line: { color: ACC, width: 0.8 } });
  s.addText(text, { x: 0.8, y: y || 6.4, w: 11.5, h: 0.5, fontSize: 12, color: "C2410C", valign: "middle" });
}
function bulletList(s, items, x, y, w, h) {
  const textObj = items.map((item, i) => ({
    text: `${item}\n`,
    options: { fontSize: 12, color: TXT_D, lineSpacing: 24, paraSpaceAfter: 4 }
  }));
  s.addText(textObj, { x, y, w, h, valign: "top" });
}

// ==========================================
// Slide 1: 封面
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: BG_D };
  s.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: ACC } });
  s.addShape("rect", { x: 0, y: 7.42, w: 13.333, h: 0.08, fill: { color: PRI } });

  s.addShape("roundRect", { x: 4.8, y: 1.0, w: 3.7, h: 3.3, fill: { color: PRI }, rectRadius: 0.35 });
  s.addText("Nexus", {
    x: 4.8, y: 1.6, w: 3.7, h: 2.1,
    fontSize: 48, bold: true, color: WHT, align: "center", valign: "middle",
    fontFace: "Arial"
  });

  s.addText("美工任务管理系统", {
    x: 1, y: 4.5, w: 11.3, h: 0.9,
    fontSize: 34, bold: true, color: WHT, align: "center"
  });
  s.addText("用户使用教程  |  全角色操作指南", {
    x: 1, y: 5.3, w: 11.3, h: 0.6,
    fontSize: 18, color: "94A3B8", align: "center"
  });
  s.addText("v15.0.3  |  2026年5月", {
    x: 1, y: 6.1, w: 11.3, h: 0.5,
    fontSize: 13, color: "64748B", align: "center"
  });
})();

// ==========================================
// Slide 2: 目录
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "目录", "本教程涵盖以下内容");

  const toc = [
    { num: "01", title: "系统概述", desc: "了解 Nexus 是什么、有哪些角色" },
    { num: "02", title: "登录与界面", desc: "如何登录、界面布局介绍" },
    { num: "03", title: "管理员操作", desc: "仪表盘 / 用户管理 / 全量任务 / 日志 / 配置" },
    { num: "04", title: "运营操作", desc: "发布任务 / 我的任务 / 作品审核 / 运营任务 / 统计" },
    { num: "05", title: "客服操作", desc: "发布任务 / 我的任务 / 作品审核 / 统计" },
    { num: "06", title: "美工操作", desc: "任务大厅接单 / 上传作品 / 提交完成" },
    { num: "07", title: "通用功能", desc: "文件预览下载 / 修改密码 / 通知 / 搜索筛选" },
    { num: "08", title: "常见问题", desc: "登录失败 / 文件太大 / 任务驳回 等" },
  ];

  toc.forEach((t, i) => {
    const y = 1.5 + i * 0.68;
    s.addShape("roundRect", { x: 0.6, y, w: 0.7, h: 0.5, fill: { color: PRI }, rectRadius: 0.08 });
    s.addText(t.num, { x: 0.6, y, w: 0.7, h: 0.5, fontSize: 14, bold: true, color: WHT, align: "center", valign: "middle" });
    s.addText(t.title, { x: 1.5, y: y - 0.02, w: 3.5, h: 0.3, fontSize: 14, bold: true, color: TXT_D });
    s.addText(t.desc, { x: 1.5, y: y + 0.26, w: 8, h: 0.25, fontSize: 11, color: TXT_M });
  });

  footer(s); pn(s, 2);
})();

// ==========================================
// Slide 3: 系统概述
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "系统概述", "Nexus 是什么？谁在使用？");

  s.addShape("roundRect", { x: 0.6, y: 1.4, w: 12.1, h: 1.2, fill: { color: BG_B }, rectRadius: 0.12 });
  s.addText(
    "Nexus 是一款专为电商团队打造的美工任务协作系统。它连接「运营/客服」与「美工/基础美工/运营助理」，\n实现从任务发布 → 接单 → 作品上传 → 审核确认的完整闭环。",
    { x: 1.0, y: 1.5, w: 11.3, h: 1.0, fontSize: 13, color: TXT_D, lineSpacing: 26 }
  );

  // 7 roles in two rows
  const roles = [
    { role: "超级管理员", icon: "👑", desc: "全局管控\n用户管理·配置·日志", color: PRI },
    { role: "副管理员", icon: "🔑", desc: "协助管理\n查看任务·数据", color: "4F46E5" },
    { role: "运营", icon: "📋", desc: "发布美工+运营任务\n审核作品", color: ACC },
    { role: "客服", icon: "💬", desc: "发布任务给基础美工\n审核作品", color: "0891B2" },
    { role: "美工", icon: "🎨", desc: "接运营单\n完成设计·提交", color: GRN },
    { role: "基础美工", icon: "✏️", desc: "接客服单\n完成设计·提交", color: "CA8A04" },
    { role: "运营助理", icon: "📎", desc: "接运营内部任务\n完成·提交", color: "7C3AED" },
  ];

  roles.forEach((r, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.6 + col * 3.1;
    const y = 2.9 + row * 2.0;
    cardBox(s, x, y, 2.9, 1.75, r.color);
    s.addText(`${r.icon}  ${r.role}`, { x: x + 0.15, y: y + 0.15, w: 2.6, h: 0.5, fontSize: 14, bold: true, color: TXT_D });
    s.addText(r.desc, { x: x + 0.15, y: y + 0.7, w: 2.6, h: 0.9, fontSize: 11, color: TXT_M, lineSpacing: 18 });
  });

  footer(s); pn(s, 3);
})();

// ==========================================
// Slide 4: 登录
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "系统登录", "打开客户端 → 输入账号密码 → 进入系统");

  // steps
  const steps = [
    { num: "1", title: "打开客户端", desc: "双击桌面 Nexus 图标\n或从开始菜单启动" },
    { num: "2", title: "输入账号密码", desc: "在登录页输入用户名和密码\n点击「登录」按钮" },
    { num: "3", title: "进入工作台", desc: "系统根据您的角色\n自动显示对应功能菜单" },
    { num: "4", title: "修改初始密码", desc: "首次登录后点击右上角头像\n选择「修改密码」" },
  ];

  steps.forEach((st, i) => {
    const x = 0.6 + i * 3.15;
    cardBox(s, x, 1.4, 2.9, 2.8, PRI);
    s.addShape("roundRect", { x: x + 0.3, y: 1.6, w: 0.65, h: 0.65, fill: { color: PRI }, rectRadius: 0.33 });
    s.addText(st.num, { x: x + 0.3, y: 1.6, w: 0.65, h: 0.65, fontSize: 20, bold: true, color: WHT, align: "center", valign: "middle" });
    s.addText(st.title, { x: x + 0.2, y: 2.45, w: 2.5, h: 0.45, fontSize: 15, bold: true, color: TXT_D });
    s.addText(st.desc, { x: x + 0.2, y: 2.95, w: 2.5, h: 0.9, fontSize: 11, color: TXT_M, lineSpacing: 18 });
  });

  // password note
  tipBox(s, "💡 初始密码由管理员设定（通常为 123456），忘记密码请联系管理员重置", 4.6);
  tipBox(s, "⚠️ 登录限制：同一账号 1 分钟内最多尝试 30 次，超限后需等待 1 分钟", 5.3);

  // default accounts
  s.addText("默认演示账号", { x: 0.6, y: 5.9, w: 4, h: 0.4, fontSize: 14, bold: true, color: TXT_D });
  const accts = [
    ["超级管理员", "admin", "拥有全部权限"],
    ["运营", "由管理员创建", "发布任务、审核"],
    ["美工", "由管理员创建", "接单、提交作品"],
  ];
  const acctHeaders = ["角色", "用户名", "说明"];
  [acctHeaders, ...accts].forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const cx = 0.6 + ci * 3.8;
      const cy = 6.3 + ri * 0.26;
      s.addText(cell, {
        x: cx, y: cy, w: ci === 2 ? 4 : 3.8, h: 0.26,
        fontSize: ri === 0 ? 10 : 10,
        bold: ri === 0,
        color: ri === 0 ? TXT_M : TXT_D
      });
    });
  });

  footer(s); pn(s, 4);
})();

// ==========================================
// Slide 5: 界面介绍
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "整体界面介绍", "登录后的主界面分为四大区域");

  const areas = [
    { title: "左侧 — 导航菜单", desc: "显示当前角色可用的所有功能\n点击菜单项切换工作页面\n不同角色看到的菜单不同", color: PRI },
    { title: "顶部 — 信息栏", desc: "显示系统名称和当前页面标题\n面包屑导航：当前位置一目了然", color: "4F46E5" },
    { title: "右侧主体 — 工作区", desc: "核心操作区域\n表格、表单、图表均在此展示\n占据界面最大面积", color: ACC },
    { title: "右上角 — 操作区", desc: "🔔 铃铛图标：查看实时通知\n👤 用户头像：修改密码、退出登录", color: GRN },
  ];

  areas.forEach((a, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.6 + col * 6.2;
    const y = 1.4 + row * 2.8;
    cardBox(s, x, y, 5.9, 2.5, a.color);
    s.addShape("roundRect", { x, y, w: 5.9, h: 0.55, fill: { color: a.color }, rectRadius: 0.12 });
    s.addText(a.title, { x: x + 0.2, y, w: 5.5, h: 0.55, fontSize: 15, bold: true, color: WHT, valign: "middle" });
    s.addText(a.desc, { x: x + 0.2, y: y + 0.7, w: 5.5, h: 1.6, fontSize: 12, color: TXT_D, lineSpacing: 22 });
  });

  footer(s); pn(s, 5);
})();

// ==========================================
// Slide 6: 管理员 - 仪表盘
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "管理员 — 数据仪表盘", "登录后默认进入，以图表形式展示系统整体运行数据");

  bulletList(s, [
    "✅ 顶部数据卡片：总任务数、待处理数、今日完成数、活跃用户数",
    "✅ 任务趋势图：按日期展示任务发布与完成的趋势变化",
    "✅ 角色分布图：各角色任务数量和完成占比",
    "✅ 状态统计：待接单 / 作图中 / 已完成 / 已驳回 各状态数量",
    "✅ 支持日期筛选器：可按时间段查看不同范围的数据",
  ], 0.8, 1.5, 11.5, 3.5);

  tipBox(s, "💡 仪表盘数据为实时统计，每次进入页面自动刷新", 5.2);

  s.addText("如何使用仪表盘", { x: 0.6, y: 5.8, w: 5, h: 0.35, fontSize: 14, bold: true, color: TXT_D });
  s.addText("1. 登录后自动进入仪表盘  2. 鼠标悬停在图表上查看具体数值  3. 使用顶部筛选器切换时间范围  4. 点击数据卡片可跳转到对应任务列表", {
    x: 0.6, y: 6.2, w: 12, h: 0.6, fontSize: 12, color: TXT_M, lineSpacing: 20
  });

  footer(s, "Nexus 美工任务管理系统 — 管理员操作指南"); pn(s, 6);
})();

// ==========================================
// Slide 7: 管理员 - 用户管理
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "管理员 — 用户管理", "管理所有登录账号：新增、编辑、禁用/启用、重置密码");

  const ops = [
    { title: "新增用户", steps: ["点击右上角「新增用户」", "填写用户名、真实姓名", "选择正确角色", "确定：初始密码为 123456"] },
    { title: "编辑用户", steps: ["找到目标用户", "点击操作列「编辑」", "修改信息（用户名不可改）", "确定保存"] },
    { title: "禁用/启用", steps: ["找到目标用户", "点击操作列开关", "禁用后用户无法登录"] },
    { title: "重置密码", steps: ["找到目标用户", "点击「重置密码」", "确认后密码变为 123456"] },
  ];

  ops.forEach((op, i) => {
    const x = 0.6 + i * 3.15;
    cardBox(s, x, 1.4, 2.9, 4.6, PRI);
    s.addShape("roundRect", { x, y: 1.4, w: 2.9, h: 0.55, fill: { color: PRI }, rectRadius: 0.12 });
    s.addText(op.title, { x: x + 0.15, y: 1.4, w: 2.6, h: 0.55, fontSize: 14, bold: true, color: WHT, valign: "middle" });
    op.steps.forEach((st, si) => {
      s.addText(`${si + 1}. ${st}`, { x: x + 0.15, y: 2.15 + si * 0.7, w: 2.6, h: 0.6, fontSize: 11, color: TXT_D, lineSpacing: 16 });
    });
  });

  tipBox(s, "⚠️ 注意：密码重置不会影响用户的角色、状态等其它信息", 6.4);

  footer(s, "Nexus 美工任务管理系统 — 管理员操作指南"); pn(s, 7);
})();

// ==========================================
// Slide 8: 管理员 - 全量任务 + 日志 + 配置
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "管理员 — 全量任务 / 日志 / 配置", "管理员独有的全局管控功能");

  // 3 cards
  const cards = [
    { title: "全量任务管理", color: PRI, items: ["查看系统中所有任务", "支持搜索、筛选、分页", "可编辑、删除任务", "催促：提醒美工尽快完成", "点击任务查看详情面板"] },
    { title: "操作日志", color: "4F46E5", items: ["记录所有关键操作", "谁在什么时间做了什么", "登录/发布/接单/审核/删除", "支持按用户、类型、时间筛选", "用于审计追溯"] },
    { title: "系统配置", color: ACC, items: ["管理系统各项配置参数", "上传文件大小上限", "单次上传文件数量上限", "存储目录配置", "修改后即时生效，无需重启"] },
  ];

  cards.forEach((c, i) => {
    const x = 0.6 + i * 4.15;
    cardBox(s, x, 1.4, 3.9, 3.6, c.color);
    s.addShape("roundRect", { x, y: 1.4, w: 3.9, h: 0.55, fill: { color: c.color }, rectRadius: 0.12 });
    s.addText(c.title, { x: x + 0.15, y: 1.4, w: 3.6, h: 0.55, fontSize: 15, bold: true, color: WHT, valign: "middle" });
    bulletList(s, c.items, x + 0.15, 2.1, 3.6, 2.7);
  });

  tipBox(s, "💡 管理员点击「系统配置」修改上传限制后立即生效，无需重启服务端", 5.3);
  tipBox(s, "💡 操作日志中可点击单条记录查看请求参数、返回结果等详细信息", 6.0);

  footer(s, "Nexus 美工任务管理系统 — 管理员操作指南"); pn(s, 8);
})();

// ==========================================
// Slide 9: 运营 - 发布美工任务
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "运营 — 发布美工任务", "填写表单发布设计需求，美工在任务大厅接单");

  const fields = [
    ["任务标题 *", "用简短文字描述要做的设计内容（必填）"],
    ["优先级 *", "选择 普通 / 紧急 / 加急（必填）"],
    ["数量 *", "需要完成的设计图数量（必填）"],
    ["截止日期", "希望美工在什么时间前完成"],
    ["指定美工", "如需指定某人完成，从下拉列表选择；不选则进入任务大厅"],
    ["店铺/旺旺/款号", "电商设计相关参考信息，帮助美工了解上下文"],
    ["参考图 / 附件", "上传参考文件（PSD、AI、图片等），支持拖拽上传"],
    ["详细描述", "补充设计要求和注意事项"],
    ["积分项 / 积分值", "该任务完成后美工可获得的积分"],
  ];

  fields.forEach((f, i) => {
    const y = 1.3 + i * 0.58;
    s.addShape("roundRect", { x: 0.6, y, w: 2.2, h: 0.42, fill: { color: ACC }, rectRadius: 0.06 });
    s.addText(f[0], { x: 0.6, y, w: 2.2, h: 0.42, fontSize: 11, bold: true, color: WHT, align: "center", valign: "middle" });
    s.addText(f[1], { x: 3.0, y, w: 8, h: 0.42, fontSize: 11, color: TXT_D, valign: "middle" });
  });

  tipBox(s, "💡 填写完成后点击「发布任务」按钮，或使用快捷键 Ctrl+Enter 快速发布", 6.75);
  tipBox(s, "💡 不指定美工 = 任务进入大厅供所有美工自由接单；指定美工 = 直接分配给该美工", 7.05);

  footer(s, "Nexus 美工任务管理系统 — 运营操作指南"); pn(s, 9);
})();

// ==========================================
// Slide 10: 运营 - 我的任务 + 审核
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "运营 — 我的任务 & 作品审核", "跟踪任务进度，审核美工提交的作品");

  // left: my tasks
  cardBox(s, 0.6, 1.3, 5.9, 5.3, PRI);
  s.addShape("roundRect", { x: 0.6, y: 1.3, w: 5.9, h: 0.6, fill: { color: PRI }, rectRadius: 0.12 });
  s.addText("📋 我的任务（美工任务）", { x: 0.8, y: 1.3, w: 5.5, h: 0.6, fontSize: 15, bold: true, color: WHT, valign: "middle" });
  bulletList(s, [
    "查看您发布的所有美工任务",
    "每条任务显示当前状态：",
    "  待接单 → 已接单 → 作图中 → 已完成 / 已驳回",
    "点击任务查看详情和进度",
    "支持搜索、按状态筛选、分页",
    "",
    "运营任务管理（运营 → 运营助理）：",
    "  · 发布运营任务：分配给运营助理",
    "  · 我的运营任务：跟踪运营任务进度",
    "  · 任务审核：审核运营助理的提交",
  ], 0.9, 2.1, 5.3, 4.3);

  // right: review
  cardBox(s, 6.8, 1.3, 5.9, 5.3, GRN);
  s.addShape("roundRect", { x: 6.8, y: 1.3, w: 5.9, h: 0.6, fill: { color: GRN }, rectRadius: 0.12 });
  s.addText("✅ 作品审核", { x: 7.0, y: 1.3, w: 5.5, h: 0.6, fontSize: 15, bold: true, color: WHT, valign: "middle" });
  bulletList(s, [
    "审核美工提交的已完成作品",
    "",
    "审核通过：",
    "  1. 查看美工上传的设计文件",
    "  2. 核对完成数量",
    "  3. 点击「审核通过」",
    "  4. 任务完成，美工获得积分",
    "",
    "驳回：",
    "  1. 设计不达标或需要修改",
    "  2. 点击「驳回」按钮",
    "  3. 填写驳回原因（必填）",
    "  4. 任务退回美工列表，可重新修改提交",
  ], 7.1, 2.1, 5.3, 4.3);

  footer(s, "Nexus 美工任务管理系统 — 运营操作指南"); pn(s, 10);
})();

// ==========================================
// Slide 11: 客服操作
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "客服 — 操作全流程", "客服发布任务给基础美工，审核作品");

  const flows = [
    { step: "Step 1", title: "发布任务", desc: "填写任务信息\n上传参考图\n发布到任务大厅", color: PRI },
    { step: "Step 2", title: "跟踪进度", desc: "在「我的任务」\n查看任务状态\n等待基础美工接单", color: "4F46E5" },
    { step: "Step 3", title: "审核作品", desc: "基础美工提交后\n在「作品审核」\n通过或驳回作品", color: GRN },
    { step: "Step 4", title: "个人统计", desc: "在「个人统计」\n查看发布和完成\n数据汇总", color: ACC },
  ];

  flows.forEach((f, i) => {
    const x = 0.6 + i * 3.15;
    cardBox(s, x, 1.4, 2.9, 3.2, f.color);
    s.addShape("roundRect", { x: x + 0.5, y: 1.6, w: 1.9, h: 0.45, fill: { color: f.color }, rectRadius: 0.22 });
    s.addText(f.step, { x: x + 0.5, y: 1.6, w: 1.9, h: 0.45, fontSize: 13, bold: true, color: WHT, align: "center", valign: "middle" });
    s.addText(f.title, { x: x + 0.1, y: 2.2, w: 2.7, h: 0.45, fontSize: 15, bold: true, color: TXT_D, align: "center" });
    s.addText(f.desc, { x: x + 0.1, y: 2.7, w: 2.7, h: 1.6, fontSize: 12, color: TXT_M, align: "center", lineSpacing: 20 });
  });

  tipBox(s, "💡 客服操作与运营基本相同，主要区别：客服任务由「基础美工」接单，归属于 cs 组", 5.0);

  // comparison table
  s.addText("运营 VS 客服 对比", { x: 0.6, y: 5.5, w: 5, h: 0.35, fontSize: 14, bold: true, color: TXT_D });
  const compRows = [
    ["对比项", "运营 (operator)", "客服 (cs_agent)"],
    ["任务分组", "design 组（美工任务）", "cs 组（客服任务）"],
    ["对接执行者", "美工 (designer)", "基础美工 (basic_designer)"],
    ["额外功能", "还有运营任务（对接运营助理）", "无"],
  ];
  compRows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      s.addText(cell, {
        x: 0.6 + ci * 3.5, y: 5.9 + ri * 0.3, w: ci === 0 ? 2.2 : 3.5, h: 0.3,
        fontSize: 10, bold: ri === 0, color: ri === 0 ? TXT_M : TXT_D
      });
    });
  });

  footer(s, "Nexus 美工任务管理系统 — 客服操作指南"); pn(s, 11);
})();

// ==========================================
// Slide 12: 美工 - 任务大厅接单
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "美工 — 任务大厅（接单）", "浏览待接任务，一键接单");

  bulletList(s, [
    "📍 位置：左侧菜单 → 美工 → 任务大厅",
    "",
    "任务大厅显示所有运营发布的、尚未被接取的美工任务（design 组）",
    "",
    "每条任务显示以下信息：",
    "  · 任务标题 — 了解要做什么",
    "  · 优先级 — 普通 / 紧急 / 加急",
    "  · 截止日期 — 需要在什么时间前完成",
    "  · 数量 — 需要设计几张图",
    "  · 积分 — 完成后可获得多少积分",
    "  · 发布者 — 哪位运营发布的",
    "",
    "接单步骤：",
    "  1. 浏览任务列表，找到想做的任务",
    "  2. 点击任务行的「接单」按钮",
    "  3. 弹出确认提示，点击「确定」",
    "  4. 任务进入「我的任务」列表，状态变为「已接单」",
  ], 0.8, 1.4, 11.5, 5.4);

  tipBox(s, "⚠️ 已有人接的任务不会在任务大厅出现；指定给特定美工的任务也不会出现在大厅", 6.9);

  footer(s, "Nexus 美工任务管理系统 — 美工操作指南"); pn(s, 12);
})();

// ==========================================
// Slide 13: 美工 - 我的任务（作业）
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "美工 — 我的任务（作业）", "上传设计文件、提交完成、转移任务");

  // 3 cards for 3 actions
  const acts = [
    { title: "📤 上传设计文件", color: PRI, items: ["1. 在「我的任务」找到任务", "2. 点击上传区域或拖入文件", "3. 选择文件分类（作品/参考/附件）", "4. 支持同时上传多个文件", "5. 上传后可预览或删除"] },
    { title: "✅ 提交完成", color: GRN, items: ["1. 确认所有文件已上传", "2. 填写实际完成数量", "3. 点击「提交完成」", "4. 状态变为「已提交」", "5. 等待运营审核"] },
    { title: "🔄 转移 & 撤回", color: ACC, items: ["转移任务：", "  · 点击「转移」按钮", "  · 选择其他美工", "  · 确定完成转移", "", "撤回提交：", "  · 审核前可撤回", "  · 修改后重新提交"] },
  ];

  acts.forEach((a, i) => {
    const x = 0.6 + i * 4.15;
    cardBox(s, x, 1.4, 3.9, 4.9, a.color);
    s.addShape("roundRect", { x, y: 1.4, w: 3.9, h: 0.55, fill: { color: a.color }, rectRadius: 0.12 });
    s.addText(a.title, { x: x + 0.15, y: 1.4, w: 3.6, h: 0.55, fontSize: 14, bold: true, color: WHT, valign: "middle" });
    bulletList(s, a.items, x + 0.15, 2.1, 3.6, 4.0);
  });

  tipBox(s, "⚠️ 提交后任务无法修改，需等运营审核。被驳回后可根据驳回原因修改后重新提交", 6.6);

  footer(s, "Nexus 美工任务管理系统 — 美工操作指南"); pn(s, 13);
})();

// ==========================================
// Slide 14: 任务状态流转
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "任务状态流转", "从发布到完成，任务经历 6 种状态");

  const states = [
    { name: "待接单\nwait", color: "94A3B8", x: 0.6 },
    { name: "已接单\naccepted", color: "3B82F6", x: 2.4 },
    { name: "作图中\ndoing", color: "8B5CF6", x: 4.2 },
    { name: "已提交\nsubmitted", color: ACC, x: 6.0 },
    { name: "已完成\nfinished", color: GRN, x: 8.2 },
    { name: "已驳回\nrejected", color: RED, x: 10.0 },
  ];

  states.forEach((st) => {
    s.addShape("roundRect", { x: st.x, y: 1.5, w: 1.6, h: 1.4, fill: { color: st.color }, rectRadius: 0.15 });
    s.addText(st.name, { x: st.x, y: 1.5, w: 1.6, h: 1.4, fontSize: 14, bold: true, color: WHT, align: "center", valign: "middle" });
  });

  // arrows (text)
  for (let i = 0; i < 4; i++) {
    s.addText("→", { x: 2.2 + i * 1.8, y: 1.7, w: 0.4, h: 0.8, fontSize: 22, bold: true, color: TXT_M, align: "center", valign: "middle" });
  }
  // rejected arrow
  s.addText("← 驳回", { x: 8.0, y: 3.3, w: 2.2, h: 0.5, fontSize: 11, bold: true, color: RED, align: "center" });

  // flow description
  const flows = [
    { title: "发布任务", desc: "运营/客服填写表单发布\n状态：待接单 (wait)", who: "运营 / 客服" },
    { title: "接单", desc: "美工在任务大厅点击接单\n状态：已接单 (accepted)", who: "美工 / 基础美工" },
    { title: "作图中", desc: "美工开始设计工作\n状态：作图中 (doing)", who: "美工 / 基础美工" },
    { title: "提交作品", desc: "上传设计文件后提交\n状态：已提交 (submitted)", who: "美工 / 基础美工" },
    { title: "审核通过", desc: "运营/客服审核通过\n状态：已完成 (finished) ✅", who: "运营 / 客服" },
    { title: "驳回", desc: "不达标被退回修改\n状态：已驳回 (rejected) ❌", who: "运营 / 客服" },
  ];

  flows.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.6 + col * 4.15;
    const y = 4.0 + row * 1.55;
    s.addShape("roundRect", { x, y, w: 3.9, h: 1.3, fill: { color: BG_L }, rectRadius: 0.1 });
    s.addText(f.title, { x: x + 0.15, y: y + 0.05, w: 2.0, h: 0.35, fontSize: 13, bold: true, color: TXT_D });
    s.addText(f.who, { x: x + 2.3, y: y + 0.08, w: 1.4, h: 0.28, fontSize: 9, color: TXT_M, align: "right" });
    s.addText(f.desc, { x: x + 0.15, y: y + 0.45, w: 3.6, h: 0.75, fontSize: 11, color: TXT_M, lineSpacing: 18 });
  });

  footer(s); pn(s, 14);
})();

// ==========================================
// Slide 15: 基础美工操作
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "基础美工 — 操作指南", "接客服组 (cs) 任务，操作流程与美工相同");

  bulletList(s, [
    "基础美工与美工的操作流程完全一致，唯一区别：",
    "",
    "  美工 (designer)           → 接运营发布的 design 组任务",
    "  基础美工 (basic_designer)  → 接客服发布的 cs 组任务",
    "",
    "操作页面（左侧菜单）：",
    "  · 任务大厅 — 浏览并接取客服发布的待接任务",
    "  · 我的任务 — 上传作品、提交完成、转移任务",
    "  · 个人统计 — 查看完成数量和积分汇总",
    "",
    "详细操作步骤请参考：",
    "  → 任务大厅接单（第 12 页）",
    "  → 我的任务作业（第 13 页）",
    "  → 任务状态流转（第 14 页）",
  ], 0.8, 1.5, 11, 4.8);

  tipBox(s, "💡 基础美工和运营助理共用「任务大厅」组件，但各自看到不同分组（cs / operator）的任务", 6.5);

  footer(s, "Nexus 美工任务管理系统 — 基础美工操作指南"); pn(s, 15);
})();

// ==========================================
// Slide 16: 运营助理操作
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "运营助理 — 操作指南", "接运营发布的内部运营任务 (operator 组)");

  bulletList(s, [
    "运营助理的定位：协助运营处理内部工作",
    "",
    "任务来源：运营通过「运营任务管理 → 发布运营任务」发布",
    "",
    "操作流程：",
    "  1. 任务大厅 — 浏览并接取运营发布的 operator 组任务",
    "  2. 我的任务 — 上传文件、填写完成量、提交",
    "  3. 等待运营在「运营任务管理 → 任务审核」中审核",
    "  4. 个人统计 — 查看完成数据和积分",
    "",
    "与美工的区别：",
    "  · 美工接 design 组任务（运营 → 美工）",
    "  · 运营助理接 operator 组任务（运营 → 运营助理）",
    "  · 操作方式完全相同",
  ], 0.8, 1.5, 11, 5.2);

  footer(s, "Nexus 美工任务管理系统 — 运营助理操作指南"); pn(s, 16);
})();

// ==========================================
// Slide 17: 文件预览与下载
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "通用功能 — 文件预览与下载", "在任务详情中查看、预览、下载和拖拽文件");

  const funcs = [
    { title: "图片预览", desc: "在任务详情面板的文件列表中\n点击图片缩略图\n大图弹出显示\n按 ESC 或点击遮罩关闭", color: PRI },
    { title: "文件下载", desc: "在文件列表中\n点击文件旁的下载按钮\n选择保存位置\n点击保存", color: "4F46E5" },
    { title: "拖拽到桌面", desc: "在任务详情面板中\n鼠标按住文件\n直接拖拽到桌面或文件夹\n松开鼠标自动保存", color: ACC },
    { title: "文件分类", desc: "上传时选择正确分类：\n作品文件 — 设计成果\n参考文件 — 运营提供的参考\n附件 — 其他辅助文件", color: GRN },
  ];

  funcs.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.6 + col * 6.2;
    const y = 1.4 + row * 2.8;
    cardBox(s, x, y, 5.9, 2.5, f.color);
    s.addShape("roundRect", { x, y, w: 5.9, h: 0.55, fill: { color: f.color }, rectRadius: 0.12 });
    s.addText(f.title, { x: x + 0.2, y, w: 5.5, h: 0.55, fontSize: 15, bold: true, color: WHT, valign: "middle" });
    s.addText(f.desc, { x: x + 0.2, y: y + 0.7, w: 5.5, h: 1.6, fontSize: 12, color: TXT_D, lineSpacing: 20 });
  });

  footer(s); pn(s, 17);
})();

// ==========================================
// Slide 18: 修改密码 & 通知
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "通用功能 — 修改密码 & 实时通知", "保障账号安全，及时获取任务动态");

  // left: password
  cardBox(s, 0.6, 1.3, 5.9, 4.6, PRI);
  s.addShape("roundRect", { x: 0.6, y: 1.3, w: 5.9, h: 0.6, fill: { color: PRI }, rectRadius: 0.12 });
  s.addText("🔐 修改密码", { x: 0.8, y: 1.3, w: 5.5, h: 0.6, fontSize: 15, bold: true, color: WHT, valign: "middle" });
  bulletList(s, [
    "操作步骤：",
    "1. 点击右上角用户头像/姓名",
    "2. 选择「修改密码」",
    "3. 输入旧密码",
    "4. 输入新密码（至少 6 位）",
    "5. 再次输入新密码确认",
    "6. 点击确定",
    "",
    "⚠️ 密码修改成功后需重新登录",
    "",
    "忘记密码 → 联系管理员重置",
    "重置后密码为 123456",
  ], 0.9, 2.1, 5.3, 3.6);

  // right: notification
  cardBox(s, 6.8, 1.3, 5.9, 4.6, ACC);
  s.addShape("roundRect", { x: 6.8, y: 1.3, w: 5.9, h: 0.6, fill: { color: ACC }, rectRadius: 0.12 });
  s.addText("🔔 实时通知", { x: 7.0, y: 1.3, w: 5.5, h: 0.6, fontSize: 15, bold: true, color: WHT, valign: "middle" });
  bulletList(s, [
    "通知触发场景：",
    "  · 您发布的任务被美工接单",
    "  · 您提交的作品被审核通过/驳回",
    "  · 任务逾期未完成提醒",
    "  · 收到任务催促",
    "",
    "查看通知：",
    "  · 点击右上角铃铛图标",
    "  · 弹出通知列表（带未读标记）",
    "  · 点击通知可跳转到相关任务",
    "",
    "桌面通知：",
    "  重要通知以 Windows 弹窗提醒",
  ], 7.1, 2.1, 5.3, 3.6);

  // bottom tip
  tipBox(s, "💡 建议首次登录后立即修改初始密码，保障账号安全", 6.2);

  footer(s); pn(s, 18);
})();

// ==========================================
// Slide 19: 搜索筛选 & 分页
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "通用功能 — 搜索、筛选与分页", "快速定位目标任务，高效管理大量数据");

  // Search
  cardBox(s, 0.6, 1.3, 5.9, 2.2, PRI);
  s.addShape("roundRect", { x: 0.6, y: 1.3, w: 5.9, h: 0.55, fill: { color: PRI }, rectRadius: 0.12 });
  s.addText("🔍 关键词搜索", { x: 0.8, y: 1.3, w: 5.5, h: 0.55, fontSize: 14, bold: true, color: WHT, valign: "middle" });
  bulletList(s, [
    "在搜索框输入关键词（任务编号/标题）",
    "支持模糊搜索：输入部分文字即可匹配",
    "按 Enter 键或点击搜索图标执行",
  ], 0.9, 2.0, 5.3, 1.3);

  // Filter
  cardBox(s, 6.8, 1.3, 5.9, 2.2, ACC);
  s.addShape("roundRect", { x: 6.8, y: 1.3, w: 5.9, h: 0.55, fill: { color: ACC }, rectRadius: 0.12 });
  s.addText("📌 条件筛选", { x: 7.0, y: 1.3, w: 5.5, h: 0.55, fontSize: 14, bold: true, color: WHT, valign: "middle" });
  bulletList(s, [
    "使用筛选栏下拉框选择条件",
    "任务状态 / 优先级 / 时间范围 / 角色分组",
    "点击「重置」清空所有筛选条件",
  ], 7.1, 2.0, 5.3, 1.3);

  // Pagination
  cardBox(s, 0.6, 3.8, 12.1, 1.3, "4F46E5");
  s.addShape("roundRect", { x: 0.6, y: 3.8, w: 12.1, h: 0.55, fill: { color: "4F46E5" }, rectRadius: 0.12 });
  s.addText("📄 分页浏览", { x: 0.8, y: 3.8, w: 11.5, h: 0.55, fontSize: 14, bold: true, color: WHT, valign: "middle" });
  bulletList(s, [
    "底部显示分页控件：页码切换 / 每页条数选择（10/20/50/100）/ 总数统计",
    "超出默认数量自动分页，可点击页码或使用前后翻页按钮切换",
  ], 0.9, 4.5, 11.5, 0.5);

  // task detail
  s.addText("📋 任务详情", { x: 0.6, y: 5.3, w: 4, h: 0.35, fontSize: 14, bold: true, color: TXT_D });
  bulletList(s, [
    "点击任务行或「详情」按钮 → 右侧弹出详情面板",
    "面板包含：基本信息 / 人员信息 / 业务信息 / 文件列表 / 操作时间线",
  ], 0.8, 5.65, 11, 1.2);

  footer(s); pn(s, 19);
})();

// ==========================================
// Slide 20-25: FAQ (6 slides, compact on 2)
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "常见问题（一）", "日常使用中可能遇到的问题和解决方法");

  const faqs = [
    { q: "Q1: 登录时提示「用户名或密码错误」", a: "① 检查输入法是否导致输入错误 ② 确认密码大小写 ③ 联系管理员确认账号状态" },
    { q: "Q2: 登录时提示「请求过于频繁」", a: "安全保护机制触发，请等待 1 分钟后再尝试登录" },
    { q: "Q3: 忘记密码怎么办？", a: "联系管理员重置密码，重置后为 123456，请登录后第一时间修改" },
    { q: "Q4: 接单后在哪里找到任务？", a: "点击左侧菜单「我的任务」，所有已接任务都在那里" },
    { q: "Q5: 上传文件时提示「文件太大」", a: "① 将大文件压缩后重新上传 ② 或联系管理员在系统配置中调整上传大小上限" },
    { q: "Q6: 提交完成后还能修改吗？", a: "审核前可点击「撤回提交」恢复编辑；审核后无法撤回；被驳回可修改后重新提交" },
  ];

  faqs.forEach((faq, i) => {
    const y = 1.3 + i * 0.95;
    s.addShape("roundRect", { x: 0.6, y, w: 12.1, h: 0.8, fill: { color: i % 2 === 0 ? BG_L : BG_B }, rectRadius: 0.1 });
    s.addText(faq.q, { x: 0.8, y: y + 0.02, w: 11.5, h: 0.3, fontSize: 12, bold: true, color: TXT_D });
    s.addText(faq.a, { x: 0.8, y: y + 0.35, w: 11.5, h: 0.4, fontSize: 11, color: TXT_M });
  });

  footer(s); pn(s, 20);
})();

(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "常见问题（二）", "更多常见疑问解答");

  const faqs = [
    { q: "Q7: 我的任务被驳回了怎么办？", a: "① 在「我的任务」中找到被驳回任务 ② 查看驳回原因 ③ 根据原因修改设计文件 ④ 重新上传并提交" },
    { q: "Q8: 为什么任务大厅看不到新任务？", a: "① 当前没有待接单任务 ② 任务归属分组不对应（design/cs/operator） ③ 任务已被指定给特定人员" },
    { q: "Q9: 系统没反应或卡住了？", a: "① 按 F5 刷新 ② 按 Ctrl+R 重新加载 ③ 关闭程序重新打开 ④ 仍无法解决联系管理员" },
    { q: "Q10: 文件上传后文件名变成乱码？", a: "系统已修复中文文件名编码问题。如仍遇到问题，尝试将文件名改为纯英文后重新上传，并反馈给管理员" },
    { q: "Q11: 如何查看我总共完成了多少任务？", a: "点击左侧菜单「个人统计」，页面展示您的任务完成总数、积分汇总等" },
    { q: "Q12: 管理员能看到我的任务吗？", a: "是的。超级管理员和副管理员可查看系统所有人任务。普通用户之间数据隔离：运营只看自己发布、美工只看自己接取" },
  ];

  faqs.forEach((faq, i) => {
    const y = 1.3 + i * 0.95;
    s.addShape("roundRect", { x: 0.6, y, w: 12.1, h: 0.8, fill: { color: i % 2 === 0 ? BG_L : BG_B }, rectRadius: 0.1 });
    s.addText(faq.q, { x: 0.8, y: y + 0.02, w: 11.5, h: 0.3, fontSize: 12, bold: true, color: TXT_D });
    s.addText(faq.a, { x: 0.8, y: y + 0.35, w: 11.5, h: 0.4, fontSize: 11, color: TXT_M });
  });

  footer(s); pn(s, 21);
})();

// ==========================================
// Slide 22: 快捷键 & 技巧
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "操作技巧与快捷键", "提升日常使用效率");

  // tips
  const tips = [
    { title: "快捷键", items: ["Ctrl+Enter：快速发布任务", "Ctrl+S：保存编辑中的表单", "ESC：关闭弹窗/图片预览", "F5：刷新当前页面数据"] },
    { title: "上传技巧", items: ["支持拖拽文件到上传区域", "支持多文件同时选中上传", "上传前检查文件大小是否超限", "图片文件自动生成缩略图预览"] },
    { title: "效率建议", items: ["定期查看通知，避免遗漏审核", "善用筛选功能快速定位任务", "任务详情中可直接拖拽文件到桌面", "个人统计页面可切换时间范围"] },
    { title: "注意事项", items: ["密码不要与同事共用", "提交前仔细检查文件完整性", "驳回原因要写清楚方便美工修改", "重要数据定期请管理员备份"] },
  ];

  tips.forEach((t, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.6 + col * 6.2;
    const y = 1.3 + row * 2.9;
    cardBox(s, x, y, 5.9, 2.6, PRI);
    s.addShape("roundRect", { x, y, w: 5.9, h: 0.55, fill: { color: PRI }, rectRadius: 0.12 });
    s.addText(t.title, { x: x + 0.2, y, w: 5.5, h: 0.55, fontSize: 15, bold: true, color: WHT, valign: "middle" });
    bulletList(s, t.items, x + 0.2, y + 0.7, 5.5, 1.7);
  });

  footer(s); pn(s, 22);
})();

// ==========================================
// Slide 23: 权限矩阵总览
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "七角色权限矩阵", "不同角色能做什么一目了然");

  const headers = ["功能", "管理员", "副管理", "运营", "客服", "美工", "基础美工", "运营助理"];
  const rows = [
    ["登录系统", "✅", "✅", "✅", "✅", "✅", "✅", "✅"],
    ["数据仪表盘", "✅", "✅", "-", "-", "-", "-", "-"],
    ["用户管理", "✅", "-", "-", "-", "-", "-", "-"],
    ["查看全量任务", "✅", "✅", "-", "-", "-", "-", "-"],
    ["操作日志", "✅", "-", "-", "-", "-", "-", "-"],
    ["系统配置", "✅", "-", "-", "-", "-", "-", "-"],
    ["发布任务", "✅", "-", "✅", "✅", "-", "-", "-"],
    ["作品审核", "✅", "-", "✅", "✅", "-", "-", "-"],
    ["任务大厅(接单)", "-", "-", "-", "-", "✅", "✅", "✅"],
    ["上传作品", "-", "-", "-", "-", "✅", "✅", "✅"],
    ["提交完成", "-", "-", "-", "-", "✅", "✅", "✅"],
    ["个人统计", "-", "-", "✅", "✅", "✅", "✅", "✅"],
  ];

  const colW = [2.0, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35, 1.35];
  const startX = 0.8;
  const startY = 1.4;
  const rowH = 0.4;

  // header row
  let cx = startX;
  headers.forEach((h, hi) => {
    s.addShape("roundRect", { x: cx, y: startY, w: colW[hi], h: rowH, fill: { color: PRI }, rectRadius: 0.04 });
    s.addText(h, { x: cx, y: startY, w: colW[hi], h: rowH, fontSize: 9, bold: true, color: WHT, align: "center", valign: "middle" });
    cx += colW[hi];
  });

  rows.forEach((row, ri) => {
    let rx = startX;
    row.forEach((cell, ci) => {
      const isCheck = cell === "✅";
      s.addShape("roundRect", { x: rx, y: startY + (ri + 1) * rowH, w: colW[ci], h: rowH, fill: { color: ri % 2 === 0 ? WHT : BG_L }, rectRadius: 0.04 });
      s.addText(cell, { x: rx, y: startY + (ri + 1) * rowH, w: colW[ci], h: rowH, fontSize: 9, color: isCheck ? GRN : cell === "-" ? "CBD5E1" : TXT_D, align: "center", valign: "middle" });
      rx += colW[ci];
    });
  });

  footer(s); pn(s, 23);
})();

// ==========================================
// Slide 24: 获取帮助
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHT };
  titleBar(s, "获取帮助", "遇到问题时如何获得支持");

  const helps = [
    { title: "查看在线帮助", desc: "点击右上角帮助菜单\n查看「关于 Nexus」获取版本信息\n确认当前运行的是最新版本", color: PRI },
    { title: "联系管理员", desc: "账号问题（登录/禁用/密码）\n权限问题（无法访问某功能）\n系统配置修改建议", color: "4F46E5" },
    { title: "反馈问题", desc: "操作异常或报错时：\n截图保存错误提示\n描述操作步骤\n告知管理员复现方式", color: ACC },
    { title: "查看文档", desc: "《用户使用手册》— 详细操作指南\n《技术白皮书》— 技术人员参考\n本 PPT — 快速入门教程", color: GRN },
  ];

  helps.forEach((h, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.6 + col * 6.2;
    const y = 1.4 + row * 2.8;
    cardBox(s, x, y, 5.9, 2.5, h.color);
    s.addShape("roundRect", { x, y, w: 5.9, h: 0.55, fill: { color: h.color }, rectRadius: 0.12 });
    s.addText(h.title, { x: x + 0.2, y, w: 5.5, h: 0.55, fontSize: 15, bold: true, color: WHT, valign: "middle" });
    s.addText(h.desc, { x: x + 0.2, y: y + 0.7, w: 5.5, h: 1.6, fontSize: 12, color: TXT_D, lineSpacing: 22 });
  });

  footer(s); pn(s, 24);
})();

// ==========================================
// Slide 25: 结束页
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: BG_D };
  s.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: ACC } });
  s.addShape("rect", { x: 0, y: 7.42, w: 13.333, h: 0.08, fill: { color: PRI } });

  s.addText("谢谢！", {
    x: 1, y: 1.5, w: 11.3, h: 1.2,
    fontSize: 48, bold: true, color: WHT, align: "center"
  });
  s.addText("Nexus 美工任务管理系统", {
    x: 1, y: 2.8, w: 11.3, h: 0.7,
    fontSize: 22, color: "94A3B8", align: "center"
  });
  s.addText([
    { text: "版本：v15.0.3\n", options: { fontSize: 14 } },
    { text: "文档日期：2026年5月\n", options: { fontSize: 14 } },
    { text: "\n如有疑问请联系系统管理员", options: { fontSize: 13, color: "64748B" } },
  ], {
    x: 1, y: 3.8, w: 11.3, h: 2.0,
    fontSize: 14, color: "94A3B8", align: "center", lineSpacing: 28
  });

  // centered logo
  s.addShape("roundRect", {
    x: 5.5, y: 5.6, w: 2.3, h: 1.0,
    fill: { color: PRI }, rectRadius: 0.2
  });
  s.addText("Nexus", {
    x: 5.5, y: 5.6, w: 2.3, h: 1.0,
    fontSize: 22, bold: true, color: WHT, align: "center", valign: "middle"
  });
})();

// ===== 生成文件 =====
const outPath = "C:/Users/26239/Desktop/项目优化流程/Nexus_用户使用教程.pptx";
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log("✅ PPT 生成成功:", outPath);
}).catch(err => {
  console.error("❌ PPT 生成失败:", err);
  process.exit(1);
});
