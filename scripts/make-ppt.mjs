import PptxGenJS from "pptxgenjs";

const pptx = new PptxGenJS();

// ===== 主题配置 =====
const PRIMARY = "2563EB";
const ACCENT = "F97316";
const BG_DARK = "1E293B";
const TEXT_DARK = "1E293B";
const TEXT_MUTED = "64748B";
const WHITE = "FFFFFF";
const LIGHT_BG = "F8FAFC";

pptx.defineLayout({ name: "CUSTOM", width: "13.333", height: "7.5" });
pptx.layout = "CUSTOM";

// ===== 通用辅助函数 =====
function addFooter(slide, text) {
  slide.addText(text || "Design 美工任务管理系统 — 客服 & 基础美工使用教程", {
    x: 0.5, y: 7.0, w: 12.3, h: 0.35,
    fontSize: 9, color: TEXT_MUTED, align: "center"
  });
}

function addPageNum(slide, num, total) {
  slide.addText(`${num} / ${total}`, {
    x: 11.5, y: 7.0, w: 1.5, h: 0.35,
    fontSize: 9, color: TEXT_MUTED, align: "right"
  });
}

const TOTAL = 11;

// ==========================================
// Slide 1: 封面
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: BG_DARK };
  // 装饰条
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: ACCENT } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 7.42, w: 13.333, h: 0.08, fill: { color: PRIMARY } });

  // Logo区域
  s.addShape(pptx.ShapeType.roundRect, {
    x: 5.2, y: 1.2, w: 2.9, h: 2.9,
    fill: { color: PRIMARY }, rectRadius: 0.3
  });
  s.addText("Design", {
    x: 5.2, y: 1.8, w: 2.9, h: 1.8,
    fontSize: 40, bold: true, color: WHITE, align: "center", valign: "middle",
    fontFace: "Arial"
  });

  s.addText("美工任务管理系统", {
    x: 1, y: 4.3, w: 11.3, h: 0.8,
    fontSize: 32, bold: true, color: WHITE, align: "center"
  });
  s.addText("客服 & 基础美工  使用教程", {
    x: 1, y: 5.1, w: 11.3, h: 0.6,
    fontSize: 20, color: "94A3B8", align: "center"
  });
  s.addText("v12.0.0  |  2026年5月", {
    x: 1, y: 6.0, w: 11.3, h: 0.5,
    fontSize: 13, color: "64748B", align: "center"
  });
})();

// ==========================================
// Slide 2: 软件概述
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: PRIMARY } });

  s.addText("软件概述", {
    x: 0.6, y: 0.3, w: 5, h: 0.7,
    fontSize: 26, bold: true, color: TEXT_DARK
  });

  // 简介
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 1.2, w: 12.1, h: 1.3,
    fill: { color: LIGHT_BG }, rectRadius: 0.15
  });
  s.addText(
    "Design 是一套专为电商美工团队打造的桌面端任务协作系统。它连接「客服」与「基础美工」两个角色，\n实现从任务发布、接单、作品上传到审核确认的完整闭环。",
    { x: 1.0, y: 1.35, w: 11.3, h: 1.0, fontSize: 14, color: TEXT_DARK, lineSpacing: 28 }
  );

  // 两个角色卡片
  const cardY = 2.8;
  // 客服卡片
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: cardY, w: 5.7, h: 3.8,
    fill: { color: LIGHT_BG }, rectRadius: 0.15,
    line: { color: PRIMARY, width: 1.5 }
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: cardY, w: 5.7, h: 0.65,
    fill: { color: PRIMARY }, rectRadius: 0.15
  });
  s.addText("💬  客服 (cs_agent)", {
    x: 0.8, y: cardY + 0.05, w: 5.3, h: 0.55,
    fontSize: 17, bold: true, color: WHITE
  });
  s.addText([
    { text: "发布作图任务\n", options: { bold: true, fontSize: 13 } },
    { text: "填写旺旺ID、款号等关键信息\n上传参考图片\n指定基础美工或发布到大厅\n\n", options: { fontSize: 12 } },
    { text: "跟踪进度\n", options: { bold: true, fontSize: 13 } },
    { text: "查看任务状态、催促美工\n\n", options: { fontSize: 12 } },
    { text: "审核作品\n", options: { bold: true, fontSize: 13 } },
    { text: "查看作品、通过或驳回（附原因）\n支持批量审核", options: { fontSize: 12 } },
  ], { x: 1.0, y: cardY + 0.8, w: 4.9, h: 2.8, fontSize: 12, color: TEXT_DARK, lineSpacing: 20, valign: "top" });

  // 基础美工卡片
  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.0, y: cardY, w: 5.7, h: 3.8,
    fill: { color: LIGHT_BG }, rectRadius: 0.15,
    line: { color: ACCENT, width: 1.5 }
  });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.0, y: cardY, w: 5.7, h: 0.65,
    fill: { color: ACCENT }, rectRadius: 0.15
  });
  s.addText("🎨  基础美工 (basic_designer)", {
    x: 7.2, y: cardY + 0.05, w: 5.3, h: 0.55,
    fontSize: 17, bold: true, color: WHITE
  });
  s.addText([
    { text: "任务大厅接单\n", options: { bold: true, fontSize: 13 } },
    { text: "浏览客服发布的待接任务\n一键接单，查看详情和参考图\n\n", options: { fontSize: 12 } },
    { text: "上传作品\n", options: { bold: true, fontSize: 13 } },
    { text: "支持图片和附件，重新上传时覆盖旧文件\n\n", options: { fontSize: 12 } },
    { text: "转移任务\n", options: { bold: true, fontSize: 13 } },
    { text: "将任务转给其他基础美工同事\n\n", options: { fontSize: 12 } },
  ], { x: 7.4, y: cardY + 0.8, w: 4.9, h: 2.8, fontSize: 12, color: TEXT_DARK, lineSpacing: 20, valign: "top" });

  addFooter(s);
  addPageNum(s, 2, TOTAL);
})();

// ==========================================
// Slide 3: 客服 - 发布任务
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: PRIMARY } });

  s.addText("客服 — 发布任务", {
    x: 0.6, y: 0.3, w: 6, h: 0.7,
    fontSize: 26, bold: true, color: TEXT_DARK
  });
  s.addText("客服登录后默认进入此页面，填写表单即可发布作图需求", {
    x: 0.6, y: 0.95, w: 8, h: 0.4,
    fontSize: 12, color: TEXT_MUTED
  });

  // 表单字段列表
  const fields = [
    ["工作项目", "从下拉列表选择对应的项目名称"],
    ["分值", "选择项目后自动填充，不可手动修改"],
    ["旺旺ID", "客户的旺旺账号ID（原参考路径字段改名）"],
    ["款号", "商品款号，用于美工识别对应产品"],
    ["任务描述", "详细描述作图需求：风格、尺寸、元素等"],
    ["参考图", "上传参考图片，最多10张，单张最大50MB"],
    ["指定基础美工", "可选：选择特定美工则直接分配，不选则进入大厅"],
  ];

  fields.forEach((f, i) => {
    const y = 1.6 + i * 0.7;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.6, y, w: 2.0, h: 0.5,
      fill: { color: PRIMARY }, rectRadius: 0.08
    });
    s.addText(f[0], {
      x: 0.6, y, w: 2.0, h: 0.5,
      fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle"
    });
    s.addText(f[1], {
      x: 2.8, y, w: 7, h: 0.5,
      fontSize: 12, color: TEXT_DARK, valign: "middle"
    });
  });

  // 提示
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 6.4, w: 12.1, h: 0.5,
    fill: { color: "FFF7ED" }, rectRadius: 0.1,
    line: { color: ACCENT, width: 1 }
  });
  s.addText("💡 提示：填写完成后点击「发布任务」，或使用快捷键 Ctrl+Enter 快速发布", {
    x: 0.8, y: 6.4, w: 11.5, h: 0.5,
    fontSize: 12, color: "C2410C", valign: "middle"
  });

  addFooter(s);
  addPageNum(s, 3, TOTAL);
})();

// ==========================================
// Slide 4: 客服 - 我的任务
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: PRIMARY } });

  s.addText("客服 — 我的任务", {
    x: 0.6, y: 0.3, w: 6, h: 0.7,
    fontSize: 26, bold: true, color: TEXT_DARK
  });
  s.addText("查看所有已发布的任务，跟踪进度，催促美工", {
    x: 0.6, y: 0.95, w: 8, h: 0.4,
    fontSize: 12, color: TEXT_MUTED
  });

  // 表格示意
  const headers = ["任务编号", "工作项目", "分值", "旺旺ID", "款号", "状态", "基础美工", "操作"];
  const colW = [1.2, 1.6, 0.7, 1.0, 1.0, 1.2, 1.0, 1.5];
  let xPos = 0.6;

  // 表头
  headers.forEach((h, i) => {
    s.addShape(pptx.ShapeType.rect, {
      x: xPos, y: 1.7, w: colW[i], h: 0.45,
      fill: { color: PRIMARY }
    });
    s.addText(h, {
      x: xPos, y: 1.7, w: colW[i], h: 0.45,
      fontSize: 10, bold: true, color: WHITE, align: "center", valign: "middle"
    });
    xPos += colW[i];
  });

  // 示例行
  const rows = [
    ["CS20260501", "主图制作", "5", "tb888", "K2024", "待接单", "—", "详情 | 催促"],
    ["CS20260502", "详情页", "8", "tm666", "S1024", "待审核", "李四", "详情 | 催促"],
    ["CS20260503", "主图+车图", "12", "jd123", "P568", "已完成", "张三", "详情"],
  ];

  rows.forEach((row, ri) => {
    let rx = 0.6;
    row.forEach((cell, ci) => {
      const bg = ri % 2 === 0 ? LIGHT_BG : WHITE;
      s.addShape(pptx.ShapeType.rect, {
        x: rx, y: 2.15 + ri * 0.4, w: colW[ci], h: 0.4,
        fill: { color: bg }, line: { color: "E2E8F0", width: 0.5 }
      });
      s.addText(cell, {
        x: rx, y: 2.15 + ri * 0.4, w: colW[ci], h: 0.4,
        fontSize: 10, color: TEXT_DARK, align: "center", valign: "middle"
      });
      rx += colW[ci];
    });
  });

  // 功能点
  s.addText([
    { text: "状态筛选：", options: { bold: true } },
    { text: "支持按待接单/已接单/待审核/已完成/已驳回筛选\n", options: {} },
    { text: "详情查看：", options: { bold: true } },
    { text: "点击查看任务详情、参考图、作品文件\n", options: {} },
    { text: "催促功能：", options: { bold: true } },
    { text: "向已接单美工发送催促提醒", options: {} },
  ], {
    x: 0.6, y: 3.6, w: 12, h: 2.2,
    fontSize: 12, color: TEXT_DARK, lineSpacing: 26, valign: "top"
  });

  addFooter(s);
  addPageNum(s, 4, TOTAL);
})();

// ==========================================
// Slide 5: 客服 - 作品审核
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: PRIMARY } });

  s.addText("客服 — 作品审核", {
    x: 0.6, y: 0.3, w: 6, h: 0.7,
    fontSize: 26, bold: true, color: TEXT_DARK
  });
  s.addText("审核基础美工提交的作品，通过或驳回", {
    x: 0.6, y: 0.95, w: 8, h: 0.4,
    fontSize: 12, color: TEXT_MUTED
  });

  // 审核流程示意图
  const steps = [
    { text: "选择任务", desc: "在列表中点击「查看作品」", color: PRIMARY },
    { text: "检查作品", desc: "查看作品图片、附件", color: PRIMARY },
    { text: "审核决定", desc: "通过 or 驳回", color: PRIMARY },
    { text: "结果通知", desc: "美工收到审核结果", color: ACCENT },
  ];

  steps.forEach((st, i) => {
    const sx = 0.8 + i * 3.1;
    s.addShape(pptx.ShapeType.roundRect, {
      x: sx, y: 1.6, w: 2.6, h: 1.2,
      fill: { color: LIGHT_BG }, rectRadius: 0.15,
      line: { color: st.color, width: 2 }
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: sx + 0.9, y: 1.3, w: 0.8, h: 0.45,
      fill: { color: st.color }
    });
    s.addText(`${i + 1}`, {
      x: sx + 0.9, y: 1.3, w: 0.8, h: 0.45,
      fontSize: 16, bold: true, color: WHITE, align: "center", valign: "middle"
    });
    s.addText(st.text, {
      x: sx + 0.2, y: 1.9, w: 2.2, h: 0.4,
      fontSize: 14, bold: true, color: TEXT_DARK, align: "center"
    });
    s.addText(st.desc, {
      x: sx + 0.2, y: 2.3, w: 2.2, h: 0.35,
      fontSize: 10, color: TEXT_MUTED, align: "center"
    });
    // 箭头
    if (i < 3) {
      s.addText("→", {
        x: sx + 2.6, y: 1.85, w: 0.5, h: 0.5,
        fontSize: 22, color: TEXT_MUTED, align: "center"
      });
    }
  });

  // 操作说明
  s.addText("操作详情", {
    x: 0.6, y: 3.2, w: 5, h: 0.5,
    fontSize: 16, bold: true, color: TEXT_DARK
  });

  // 通过
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 3.8, w: 5.7, h: 1.3,
    fill: { color: LIGHT_BG }, rectRadius: 0.12,
    line: { color: "22C55E", width: 1.5 }
  });
  s.addText([
    { text: "✅  审核通过\n", options: { bold: true, fontSize: 14 } },
    { text: "确认作品符合要求后点击「通过」，任务标记为已完成\n支持批量勾选多个任务后一键通过", options: { fontSize: 11 } },
  ], { x: 0.9, y: 3.9, w: 5.1, h: 1.1, fontSize: 11, color: TEXT_DARK, lineSpacing: 22 });

  // 驳回
  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.0, y: 3.8, w: 5.7, h: 1.3,
    fill: { color: LIGHT_BG }, rectRadius: 0.12,
    line: { color: "EF4444", width: 1.5 }
  });
  s.addText([
    { text: "❌  驳回\n", options: { bold: true, fontSize: 14 } },
    { text: "作品不满足要求时点击「驳回」，必须填写驳回原因\n驳回后任务回到美工侧，美工可重新上传作品", options: { fontSize: 11 } },
  ], { x: 7.3, y: 3.9, w: 5.1, h: 1.1, fontSize: 11, color: TEXT_DARK, lineSpacing: 22 });

  // 提示
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 5.4, w: 12.1, h: 0.5,
    fill: { color: "FFF7ED" }, rectRadius: 0.1,
    line: { color: ACCENT, width: 1 }
  });
  s.addText("💡 提示：审核列表每 3 秒自动刷新，确保及时看到新提交的作品", {
    x: 0.8, y: 5.4, w: 11.5, h: 0.5,
    fontSize: 12, color: "C2410C", valign: "middle"
  });

  addFooter(s);
  addPageNum(s, 5, TOTAL);
})();

// ==========================================
// Slide 6: 基础美工 - 功能概述
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: ACCENT } });

  s.addText("基础美工 — 功能概述", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 26, bold: true, color: TEXT_DARK
  });
  s.addText("基础美工登录后默认进入任务大厅，左侧菜单包含三大模块", {
    x: 0.6, y: 0.95, w: 8, h: 0.4,
    fontSize: 12, color: TEXT_MUTED
  });

  // 三大模块卡片
  const cards = [
    { title: "📋  任务大厅", desc: "浏览客服发布的所有待接任务\n查看任务详情和参考图\n一键接单开始制作", color: PRIMARY },
    { title: "📝  我的任务", desc: "查看已接的全部任务\n上传/重新上传作品文件\n将任务转移给其他同事", color: ACCENT },
    { title: "📊  个人统计", desc: "累计分值、总接单量\n已完成数量、当月分值\n今日/昨日分值、完成率", color: "22C55E" },
  ];

  cards.forEach((c, i) => {
    const cx = 0.6 + i * 4.2;
    s.addShape(pptx.ShapeType.roundRect, {
      x: cx, y: 1.6, w: 3.8, h: 2.2,
      fill: { color: LIGHT_BG }, rectRadius: 0.15,
      line: { color: c.color, width: 2 }
    });
    s.addShape(pptx.ShapeType.rect, {
      x: cx, y: 1.6, w: 3.8, h: 0.06,
      fill: { color: c.color }
    });
    s.addText(c.title, {
      x: cx + 0.3, y: 1.8, w: 3.2, h: 0.5,
      fontSize: 15, bold: true, color: TEXT_DARK
    });
    s.addText(c.desc, {
      x: cx + 0.3, y: 2.4, w: 3.2, h: 1.2,
      fontSize: 11, color: TEXT_DARK, lineSpacing: 24
    });
  });

  // 核心流程图
  s.addText("📌  核心工作流程", {
    x: 0.6, y: 4.2, w: 5, h: 0.5,
    fontSize: 16, bold: true, color: TEXT_DARK
  });

  const flowSteps = ["进入大厅", "接单", "查看需求 & 参考图", "制作作品", "上传作品", "等待审核结果"];
  flowSteps.forEach((fs, i) => {
    const fx = 0.6 + i * 2.1;
    s.addShape(pptx.ShapeType.roundRect, {
      x: fx, y: 4.8, w: 1.8, h: 0.6,
      fill: { color: i === 4 ? ACCENT : PRIMARY }, rectRadius: 0.1
    });
    s.addText(fs, {
      x: fx, y: 4.8, w: 1.8, h: 0.6,
      fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle"
    });
    if (i < 5) {
      s.addText("→", {
        x: fx + 1.7, y: 4.8, w: 0.4, h: 0.6,
        fontSize: 18, color: TEXT_MUTED, align: "center", valign: "middle"
      });
    }
  });

  addFooter(s);
  addPageNum(s, 6, TOTAL);
})();

// ==========================================
// Slide 7: 基础美工 - 任务大厅
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: ACCENT } });

  s.addText("基础美工 — 任务大厅", {
    x: 0.6, y: 0.3, w: 6, h: 0.7,
    fontSize: 26, bold: true, color: TEXT_DARK
  });
  s.addText("浏览所有待接任务，查看详情，一键接单", {
    x: 0.6, y: 0.95, w: 8, h: 0.4,
    fontSize: 12, color: TEXT_MUTED
  });

  // 表格示意
  const headers = ["编号", "工作项目", "分值", "旺旺ID", "款号", "参考图", "发布人", "操作"];
  const colW = [1.4, 1.8, 0.7, 1.1, 1.1, 1.2, 1.0, 1.2];
  let xPos = 0.6;

  headers.forEach((h, i) => {
    s.addShape(pptx.ShapeType.rect, {
      x: xPos, y: 1.7, w: colW[i], h: 0.45,
      fill: { color: ACCENT }
    });
    s.addText(h, {
      x: xPos, y: 1.7, w: colW[i], h: 0.45,
      fontSize: 10, bold: true, color: WHITE, align: "center", valign: "middle"
    });
    xPos += colW[i];
  });

  const rows = [
    ["CS20260501", "主图制作", "5", "tb888", "K2024", "有", "客服A", "详情 | 接单"],
    ["CS20260502", "详情页设计", "8", "tm666", "S1024", "无", "客服B", "详情 | 接单"],
    ["CS20260503", "车图+海报", "12", "jd123", "P568", "有", "客服A", "详情 | 接单"],
  ];

  rows.forEach((row, ri) => {
    let rx = 0.6;
    row.forEach((cell, ci) => {
      const bg = ri % 2 === 0 ? LIGHT_BG : WHITE;
      s.addShape(pptx.ShapeType.rect, {
        x: rx, y: 2.15 + ri * 0.4, w: colW[ci], h: 0.4,
        fill: { color: bg }, line: { color: "E2E8F0", width: 0.5 }
      });
      s.addText(cell, {
        x: rx, y: 2.15 + ri * 0.4, w: colW[ci], h: 0.4,
        fontSize: 10, color: TEXT_DARK, align: "center", valign: "middle"
      });
      rx += colW[ci];
    });
  });

  // 要点
  s.addText([
    { text: "搜索：", options: { bold: true } },
    { text: "支持按任务标题/编号搜索\n", options: {} },
    { text: "接单：", options: { bold: true } },
    { text: "点击「接单」后确认，任务即刻进入「我的任务」列表\n", options: {} },
    { text: "详情：", options: { bold: true } },
    { text: "接单前先查看任务详情，了解需求、参考图和附件\n", options: {} },
    { text: "实时刷新：", options: { bold: true } },
    { text: "列表每 3 秒自动刷新，新任务不会错过", options: {} },
  ], {
    x: 0.6, y: 3.6, w: 12, h: 2.5,
    fontSize: 12, color: TEXT_DARK, lineSpacing: 28, valign: "top"
  });

  addFooter(s);
  addPageNum(s, 7, TOTAL);
})();

// ==========================================
// Slide 8: 基础美工 - 我的任务
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: ACCENT } });

  s.addText("基础美工 — 我的任务", {
    x: 0.6, y: 0.3, w: 6, h: 0.7,
    fontSize: 26, bold: true, color: TEXT_DARK
  });
  s.addText("管理已接任务：上传作品、查看详情、转移任务", {
    x: 0.6, y: 0.95, w: 8, h: 0.4,
    fontSize: 12, color: TEXT_MUTED
  });

  // 状态说明
  const statuses = [
    { label: "已接单", desc: "已接但未上传作品", color: "EAB308" },
    { label: "待审核", desc: "已上传作品，等待客服审核", color: PRIMARY },
    { label: "已完成", desc: "客服审核通过", color: "22C55E" },
    { label: "已驳回", desc: "客服驳回，需重新上传", color: "EF4444" },
  ];

  s.addText("任务状态说明", {
    x: 0.6, y: 1.6, w: 4, h: 0.45,
    fontSize: 15, bold: true, color: TEXT_DARK
  });

  statuses.forEach((st, i) => {
    const sy = 2.1 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.6, y: sy, w: 1.3, h: 0.38,
      fill: { color: st.color }, rectRadius: 0.08
    });
    s.addText(st.label, {
      x: 0.6, y: sy, w: 1.3, h: 0.38,
      fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle"
    });
    s.addText(st.desc, {
      x: 2.1, y: sy, w: 5, h: 0.38,
      fontSize: 12, color: TEXT_DARK, valign: "middle"
    });
  });

  // 操作按钮说明
  s.addText("可用操作", {
    x: 7.5, y: 1.6, w: 5, h: 0.45,
    fontSize: 15, bold: true, color: TEXT_DARK
  });

  const ops = [
    ["详情", "查看任务完整信息（需求、参考图、作品）", PRIMARY],
    ["上传作品", "状态为「已接单」时上传新作品", ACCENT],
    ["重新上传", "状态为「已驳回」时重新上传（覆盖旧文件）", "EF4444"],
    ["转移", "将任务转给其他基础美工同事", "8B5CF6"],
  ];

  ops.forEach((op, i) => {
    const oy = 2.1 + i * 0.5;
    s.addShape(pptx.ShapeType.roundRect, {
      x: 7.5, y: oy, w: 1.5, h: 0.38,
      fill: { color: op[2] }, rectRadius: 0.08
    });
    s.addText(op[0], {
      x: 7.5, y: oy, w: 1.5, h: 0.38,
      fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle"
    });
    s.addText(op[1], {
      x: 9.2, y: oy, w: 4, h: 0.38,
      fontSize: 12, color: TEXT_DARK, valign: "middle"
    });
  });

  // 逾期提醒
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 4.5, w: 12.1, h: 0.6,
    fill: { color: "FEF2F2" }, rectRadius: 0.1,
    line: { color: "EF4444", width: 1 }
  });
  s.addText("⚠️  逾期任务会在列表中置顶并以红色高亮显示，请优先处理", {
    x: 0.8, y: 4.5, w: 11.5, h: 0.6,
    fontSize: 13, color: "DC2626", valign: "middle"
  });

  addFooter(s);
  addPageNum(s, 8, TOTAL);
})();

// ==========================================
// Slide 9: 基础美工 — 上传作品 & 转移任务
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: ACCENT } });

  s.addText("上传作品 & 转移任务", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 26, bold: true, color: TEXT_DARK
  });

  // 上传区域
  s.addText("📤  上传作品", {
    x: 0.6, y: 1.3, w: 5.5, h: 0.5,
    fontSize: 18, bold: true, color: TEXT_DARK
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 1.9, w: 5.7, h: 3.0,
    fill: { color: LIGHT_BG }, rectRadius: 0.15,
    line: { color: ACCENT, width: 1.5 }
  });
  s.addText([
    { text: "操作入口：\n", options: { bold: true, fontSize: 13 } },
    { text: "「我的任务」列表中点击\n「上传作品」或「重新上传」\n\n", options: { fontSize: 11 } },
    { text: "支持格式：\n", options: { bold: true, fontSize: 13 } },
    { text: "所有文件格式（图片 + 附件）\n\n", options: { fontSize: 11 } },
    { text: "大小限制：\n", options: { bold: true, fontSize: 13 } },
    { text: "单个文件最大 50MB\n每次最多上传 10 个文件\n\n", options: { fontSize: 11 } },
    { text: "重要规则：\n", options: { bold: true, fontSize: 13, color: "EF4444" } },
    { text: "重新上传会覆盖之前上传的所有作品文件\n只保留最新上传的内容", options: { fontSize: 11, color: "DC2626" } },
  ], { x: 0.9, y: 2.0, w: 5.1, h: 2.8, fontSize: 11, lineSpacing: 22, valign: "top" });

  // 转移区域
  s.addText("🔄  转移任务", {
    x: 7.0, y: 1.3, w: 5.5, h: 0.5,
    fontSize: 18, bold: true, color: TEXT_DARK
  });

  s.addShape(pptx.ShapeType.roundRect, {
    x: 7.0, y: 1.9, w: 5.7, h: 3.0,
    fill: { color: LIGHT_BG }, rectRadius: 0.15,
    line: { color: "8B5CF6", width: 1.5 }
  });
  s.addText([
    { text: "操作入口：\n", options: { bold: true, fontSize: 13 } },
    { text: "「我的任务」列表中点击「转移」\n（已完成的任务不可转移）\n\n", options: { fontSize: 11 } },
    { text: "操作步骤：\n", options: { bold: true, fontSize: 13 } },
    { text: "1. 点击「转移」按钮\n2. 在下拉列表中选择接收人\n3. 确认转移\n\n", options: { fontSize: 11 } },
    { text: "转移后：\n", options: { bold: true, fontSize: 13 } },
    { text: "任务从你的列表中消失\n出现在接收人的「我的任务」中\n任务状态和文件保持不变", options: { fontSize: 11 } },
  ], { x: 7.3, y: 2.0, w: 5.1, h: 2.8, fontSize: 11, lineSpacing: 22, valign: "top" });

  // 上传方式示意
  s.addText("上传方式：支持拖拽文件到上传区域或点击选择，操作简单直观", {
    x: 0.6, y: 5.2, w: 12, h: 0.4,
    fontSize: 12, color: TEXT_MUTED
  });

  addFooter(s);
  addPageNum(s, 9, TOTAL);
})();

// ==========================================
// Slide 10: 完整工作流程
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: PRIMARY } });

  s.addText("完整工作流程", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 26, bold: true, color: TEXT_DARK
  });
  s.addText("客服与基础美工的协作流程全景", {
    x: 0.6, y: 0.95, w: 8, h: 0.4,
    fontSize: 12, color: TEXT_MUTED
  });

  // 主流程图
  const mainFlow = [
    { role: "💬 客服", step: "发布任务", desc: "填写需求\n指定美工" },
    { role: "", step: "→", desc: "" },
    { role: "🎨 基础美工", step: "接单", desc: "任务大厅\n一键接单" },
    { role: "", step: "→", desc: "" },
    { role: "🎨 基础美工", step: "上传作品", desc: "支持图片\n和附件" },
    { role: "", step: "→", desc: "" },
    { role: "💬 客服", step: "审核", desc: "通过或驳回\n附驳回原因" },
  ];

  mainFlow.forEach((mf, i) => {
    const mx = 0.3 + i * 1.9;
    if (mf.role) {
      s.addShape(pptx.ShapeType.roundRect, {
        x: mx, y: 1.6, w: 1.6, h: 1.5,
        fill: { color: mf.role.includes("客服") ? PRIMARY : ACCENT }, rectRadius: 0.15
      });
      s.addText(mf.role, {
        x: mx, y: 1.65, w: 1.6, h: 0.4,
        fontSize: 10, color: "CBD5E1", align: "center"
      });
      s.addText(mf.step, {
        x: mx, y: 2.0, w: 1.6, h: 0.45,
        fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle"
      });
      s.addText(mf.desc, {
        x: mx + 0.1, y: 2.5, w: 1.4, h: 0.55,
        fontSize: 9, color: "CBD5E1", align: "center", lineSpacing: 14
      });
    } else {
      s.addText(mf.step, {
        x: mx, y: 2.0, w: 1.9, h: 0.5,
        fontSize: 24, color: "94A3B8", align: "center", valign: "middle"
      });
    }
  });

  // 驳回分支
  s.addShape(pptx.ShapeType.roundRect, {
    x: 9.5, y: 3.5, w: 3.2, h: 0.55,
    fill: { color: "FEF2F2" }, rectRadius: 0.1,
    line: { color: "EF4444", width: 1.5 }
  });
  s.addText("❌ 驳回 → 美工重新上传", {
    x: 9.5, y: 3.5, w: 3.2, h: 0.55,
    fontSize: 12, bold: true, color: "DC2626", align: "center", valign: "middle"
  });
  // 驳回箭头
  s.addText("↩", {
    x: 9.5, y: 4.0, w: 3.2, h: 0.4,
    fontSize: 16, color: "EF4444", align: "center"
  });

  // 通过分支
  s.addShape(pptx.ShapeType.roundRect, {
    x: 9.5, y: 4.6, w: 3.2, h: 0.55,
    fill: { color: "F0FDF4" }, rectRadius: 0.1,
    line: { color: "22C55E", width: 1.5 }
  });
  s.addText("✅ 通过 → 任务完成", {
    x: 9.5, y: 4.6, w: 3.2, h: 0.55,
    fontSize: 12, bold: true, color: "16A34A", align: "center", valign: "middle"
  });

  // 转移分支
  s.addShape(pptx.ShapeType.roundRect, {
    x: 9.5, y: 5.4, w: 3.2, h: 0.55,
    fill: { color: "F5F3FF" }, rectRadius: 0.1,
    line: { color: "8B5CF6", width: 1.5 }
  });
  s.addText("🔄 转移 → 其他美工接手", {
    x: 9.5, y: 5.4, w: 3.2, h: 0.55,
    fontSize: 12, bold: true, color: "7C3AED", align: "center", valign: "middle"
  });

  // 客服侧检查点
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.6, y: 3.8, w: 8.5, h: 2.8,
    fill: { color: LIGHT_BG }, rectRadius: 0.15
  });
  s.addText([
    { text: "📌 流程要点\n\n", options: { bold: true, fontSize: 14 } },
    { text: "• 客服发布任务时可选择「指定基础美工」直接分配，或留空发布到大厅\n", options: { fontSize: 11 } },
    { text: "• 基础美工接单后在「我的任务」中查看，制作完成后上传作品\n", options: { fontSize: 11 } },
    { text: "• 上传作品后任务状态变为「待审核」，客服在「作品审核」中看到\n", options: { fontSize: 11 } },
    { text: "• 客服通过 → 任务完成；客服驳回 → 美工重新上传 → 再次审核\n", options: { fontSize: 11 } },
    { text: "• 基础美工可将任务转移给同事，保持工作灵活性\n", options: { fontSize: 11 } },
    { text: "• 两套任务线（design & cs）完全隔离，互不可见", options: { fontSize: 11 } },
  ], { x: 0.9, y: 3.9, w: 7.9, h: 2.6, fontSize: 11, lineSpacing: 22, valign: "top" });

  addFooter(s);
  addPageNum(s, 10, TOTAL);
})();

// ==========================================
// Slide 11: 注意事项 & 小贴士
// ==========================================
(() => {
  const s = pptx.addSlide();
  s.background = { fill: BG_DARK };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.06, fill: { color: ACCENT } });

  s.addText("注意事项 & 快捷操作", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 26, bold: true, color: WHITE
  });

  // 左侧注意事项
  s.addText("⚠️  注意事项", {
    x: 0.6, y: 1.3, w: 5.5, h: 0.5,
    fontSize: 18, bold: true, color: ACCENT
  });

  const tips = [
    "关闭页面前确保已保存/提交表单内容",
    "参考图仅作参考，不替代需求描述",
    "上传作品前确认文件完整性",
    "驳回必须填写具体原因，便于美工修改",
    "任务转移后不可撤销，请谨慎操作",
    "文件上传限制：单文件最大 50MB，每次最多 10 个",
    "登录凭证请妥善保管，勿与他人共享账号",
  ];

  tips.forEach((t, i) => {
    s.addText(`• ${t}`, {
      x: 0.8, y: 1.9 + i * 0.45, w: 6, h: 0.4,
      fontSize: 12, color: "CBD5E1", valign: "middle"
    });
  });

  // 右侧快捷操作
  s.addText("⌨️  快捷操作 & 小技巧", {
    x: 7.5, y: 1.3, w: 5.5, h: 0.5,
    fontSize: 18, bold: true, color: "60A5FA"
  });

  const shortcuts = [
    ["Ctrl + Enter", "快速发布任务"],
    ["3 秒自动刷新", "任务列表实时更新，无需手动刷新"],
    ["拖拽上传", "支持拖拽文件到上传区域"],
    ["Ctrl+Q", "退出应用程序"],
    ["F12", "打开开发者工具（管理员）"],
    ["主题切换", "点击右上角按钮切换亮色/暗色模式"],
    ["接单确认", "接单前先查看详情，了解全部需求"],
  ];

  shortcuts.forEach((sc, i) => {
    s.addShape(pptx.ShapeType.roundRect, {
      x: 7.5, y: 1.9 + i * 0.45, w: 2.0, h: 0.35,
      fill: { color: "1E40AF" }, rectRadius: 0.06
    });
    s.addText(sc[0], {
      x: 7.5, y: 1.9 + i * 0.45, w: 2.0, h: 0.35,
      fontSize: 10, bold: true, color: "93C5FD", align: "center", valign: "middle"
    });
    s.addText(sc[1], {
      x: 9.7, y: 1.9 + i * 0.45, w: 3.3, h: 0.35,
      fontSize: 12, color: "CBD5E1", valign: "middle"
    });
  });

  // 底部
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 6.2, w: 13.333, h: 0.5, fill: { color: "0F172A" } });
  s.addText("如有问题，请联系系统管理员", {
    x: 0, y: 6.2, w: 13.333, h: 0.5,
    fontSize: 13, color: "64748B", align: "center", valign: "middle"
  });

  addFooter(s, "Design 美工任务管理系统 — 教程完");
  addPageNum(s, 11, TOTAL);
})();

// ===== 生成文件 =====
const outPath = "C:\\Users\\26239\\Desktop\\项目优化流程\\Design-客服与基础美工使用教程.pptx";
await pptx.writeFile({ fileName: outPath });
console.log("PPT 已生成:", outPath);
