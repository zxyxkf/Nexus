$outPath = "C:\Users\26239\Desktop\项目优化流程\个人简历-技能与项目经验.docx"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()

# ---- 页面设置 ----
$doc.PageSetup.TopMargin    = 72   # 2.54cm
$doc.PageSetup.BottomMargin = 72
$doc.PageSetup.LeftMargin   = 90   # 3.17cm
$doc.PageSetup.RightMargin  = 90

# ---- 定义样式 ----
$normalFontSize = 12
$titleFontSize  = 16
$headingFontSize = 14
$subHeadingFontSize = 12

# ==============================================
#  标题
# ==============================================
$range = $doc.Content
$range.Text = "个人技能与项目经验"
$range.Font.Name = "微软雅黑"
$range.Font.Size = 18
$range.Font.Bold = $true
$range.ParagraphFormat.Alignment = 1  # 居中
$range.ParagraphFormat.SpaceAfter = 12
$range.InsertParagraphAfter()

# ==============================================
#  一、个人技能
# ==============================================
$range = $doc.Content
$range.InsertParagraphAfter()
$range.InsertAfter("一、个人技能")
$range.Font.Name = "微软雅黑"
$range.Font.Size = 16
$range.Font.Bold = $true
$range.ParagraphFormat.SpaceBefore = 6
$range.ParagraphFormat.SpaceAfter = 6
$range.InsertParagraphAfter()

# 技能条目
$skills = @(
    @{Title="编程语言"; Content="JavaScript / ES6+、Node.js、HTML5、CSS3、SQL"},
    @{Title="前端框架"; Content="Vue 3（Composition API + Pinia 状态管理 + Vue Router）、Element Plus UI 组件库、Vite 构建工具"},
    @{Title="桌面端开发"; Content="Electron 跨平台桌面应用开发，Electron Builder 打包与 NSIS 安装器制作，Electron Updater 自动更新系统"},
    @{Title="后端开发"; Content="Express.js 框架，RESTful API 设计，JWT 鉴权与 RBAC 角色权限控制，Socket.IO 实时通信"},
    @{Title="数据库"; Content="MySQL 关系型数据库设计与优化，SQLite 嵌入式数据库，双引擎兼容方案"},
    @{Title="数据可视化"; Content="ECharts 图表库，动态仪表盘与多维度数据统计"},
    @{Title="工程化"; Content="Git 版本控制，前后端分离架构，模块化设计，Nginx 反向代理配置，PM2 进程管理"},
    @{Title="软件设计"; Content="MVC 分层架构，DAO/Service/Route 三层解耦，中间件模式，组件化开发思想"}
)

foreach ($skill in $skills) {
    $range.InsertAfter("【$($skill.Title)】$($skill.Content)")
    $range.Font.Name = "微软雅黑"
    $range.Font.Size = 12
    $range.Font.Bold = $false
    $range.ParagraphFormat.SpaceAfter = 3
    $range.InsertParagraphAfter()
}

# ==============================================
#  二、项目经验
# ==============================================
$range.InsertAfter("二、项目经验")
$range.Font.Name = "微软雅黑"
$range.Font.Size = 16
$range.Font.Bold = $true
$range.ParagraphFormat.SpaceBefore = 12
$range.ParagraphFormat.SpaceAfter = 6
$range.InsertParagraphAfter()

# ---- 项目一 ----
$range.InsertAfter("项目一：Nexus 企业级多角色任务管理系统")
$range.Font.Name = "微软雅黑"
$range.Font.Size = 14
$range.Font.Bold = $true
$range.ParagraphFormat.SpaceBefore = 8
$range.ParagraphFormat.SpaceAfter = 4
$range.InsertParagraphAfter()

$proj1Lines = @(
    "【项目周期】2024.06 – 2026.05（持续迭代至 v15.0.5）",
    "【项目角色】全栈独立开发",
    "【技术栈】Vue 3 + Element Plus + Pinia + Electron + Express.js + MySQL + SQLite + Socket.IO + ECharts",
    "",
    "【项目概述】",
    "Nexus 是一款面向电商设计团队的桌面端任务管理系统，基于 Electron 构建跨平台桌面应用，服务端采用 Express + MySQL/SQLite 双引擎架构。系统覆盖超级管理员、子管理员、运营、运营助理、美工、基础美工、客服共 7 个角色，实现了从任务发布、接单、提交审核到积分统计的完整业务闭环。",
    "",
    "【核心职责与成果】",
    "1. 全栈架构设计：独立完成前后端技术选型与架构设计，采用 MVC 分层模式（Route → Service → DAO），实现业务逻辑与数据访问解耦，代码可维护性强。数据库支持 MySQL 和 SQLite 双引擎自动切换，确保生产环境和本地离线场景兼容运行。",
    "2. 权限系统设计：基于 JWT 实现无状态鉴权，结合角色白名单中间件实现细粒度 RBAC 权限控制，覆盖 7 种角色共 30+ 页面路由的权限隔离。",
    "3. 任务工作流引擎：设计并实现任务全生命周期管理（草稿 → 待接单 → 已接单 → 进行中 → 待审核 → 已完成/已驳回），支持任务发布、指派、接单、转交、撤回编辑再发布、批量审核等操作。",
    "4. 多维度数据统计：利用 ECharts 构建数据仪表盘，实现个人/管理员双视角的积分统计、月度趋势、排名看板。针对三类任务组（设计/客服/运营）设计独立积分项目体系，支持灵活配置。",
    "5. 文件管理模块：实现多文件上传、图片预览、拖拽下载、附件分类管理（参考图/完成凭证），集成 Element Plus 图片预览组件。",
    "6. 实时通知系统：基于 Socket.IO 实现 WebSocket 长连接推送，任务状态变更、审核结果等事件实时触达相关人员。",
    "7. 桌面端工程化：配置 Electron Builder 生成 NSIS 安装包，集成 Electron Updater 实现客户端自动检测更新，支持增量更新分发。",
    "8. 生产部署运维：配置 Nginx 反向代理 + PM2 进程守护，编写自动化数据库迁移脚本，实现平滑升级。"
)

foreach ($line in $proj1Lines) {
    $range.InsertAfter($line)
    $range.Font.Name = "微软雅黑"
    $range.Font.Size = 12
    $range.Font.Bold = ($line -eq "" -eq $false -and ($line.StartsWith("【") -or $line.EndsWith("】")))
    $range.ParagraphFormat.SpaceAfter = if ($line -eq "") { 2 } else { 3 }
    $range.InsertParagraphAfter()
}

# ---- 项目二（简要） ----
$range.InsertAfter("项目二：Nexus 客户端自动更新与分发系统")
$range.Font.Name = "微软雅黑"
$range.Font.Size = 14
$range.Font.Bold = $true
$range.ParagraphFormat.SpaceBefore = 8
$range.ParagraphFormat.SpaceAfter = 4
$range.InsertParagraphAfter()

$proj2Lines = @(
    "【项目角色】独立开发",
    "【技术栈】Electron Builder + NSIS + Generic Provider + 版本语义化",
    "",
    "【项目概述】",
    "为 Nexus 客户端搭建完整的自动更新体系，实现版本打包、增量分发、客户端静默升级的一体化流程。通过 NSIS 安装脚本定制安装行为，配置 Generic Provider 更新源，利用 latest.yml + blockmap 实现增量更新，大幅降低客户端更新带宽成本。",
    "",
    "【主要成果】",
    "  - 配置 NSIS 安装器，支持自定义安装路径、桌面快捷方式，编写 installer.nsh 自定义安装逻辑。",
    "  - 搭建 Generic Provider 更新服务，生成 latest.yml 和 .blockmap 增量文件，客户端启动自动检测新版本。",
    "  - 版本管理遵循语义化规范，累计迭代发布至 v15.0.5。"
)

foreach ($line in $proj2Lines) {
    $range.InsertAfter($line)
    $range.Font.Name = "微软雅黑"
    $range.Font.Size = 12
    $range.Font.Bold = ($line.StartsWith("【"))
    $range.ParagraphFormat.SpaceAfter = 3
    $range.InsertParagraphAfter()
}

# ==============================================
#  保存
# ==============================================
$doc.SaveAs($outPath, 16)  # 16 = wdFormatDocumentDefault (docx)
$doc.Close()
$word.Quit()

[System.Runtime.InteropServices.Marshal]::ReleaseComObject($range) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
[System.GC]::Collect()

Write-Host "简历文档已生成: $outPath"
