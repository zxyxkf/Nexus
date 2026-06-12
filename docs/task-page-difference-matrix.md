# 任务页差异矩阵

本矩阵用于指导后续任务页高内聚、低耦合迁移。迁移前必须先补对应特征测试；只有“相同行为”进入共享抽象，页面专有流程保留在页面内。

## 页面差异

| 页面 | 路由 | 数据接口 | 主要筛选 | 表格/展示重点 | 页面专有动作 |
| --- | --- | --- | --- | --- | --- |
| 设计师我的任务 | `/designer/tasks`, `/designer/tasks/todo`, `/designer/tasks/pending` | `getMyAcceptedApi(taskGroup=design)` | 款号、状态、日期、发布人、工作项目 | 款号、颜色、参考路径、参考图、作品预览、上传路径 | 内联作品上传、内联上传路径保存、提交、上传作品、重新上传、撤回 |
| 基础美工我的任务 | `/basic/tasks`, `/basic/tasks/todo`, `/basic/tasks/pending` | `getMyAcceptedApi(taskGroup=cs)` | 旺旺/款号、发布人、任务日期、状态 | 旺旺ID、款号、参考图、作品预览、转移记录 | 上传作品、重新上传、撤回、转移、申请分数 |
| 运营助理我的任务 | `/operator-assistant/tasks`, `/operator-assistant/tasks/todo`, `/operator-assistant/tasks/pending` | `getMyAcceptedApi(taskGroup=operator)` | 状态、日期、发布人、店铺 | 店铺、文件地址、完成凭证、完成次数 | 内联凭证上传、完成次数编辑、提交、上传、重新上传、撤回 |
| 发布方我的任务 | `/operator/tasks`, `/cs/tasks` | `getMyPublishedApi(taskGroup=design/cs)` | 款号/旺旺、任务编号、接单人、发布人、状态、日期 | 状态进度、接单人、参考图、作品预览 | 撤回、编辑、催促；客服侧另有重开、改编号 |
| 运营发布的运营任务 | `/operator/op-tasks` | `getMyPublishedApi(taskGroup=operator)` | 状态、运营助理、发布人、日期 | 店铺、文件地址、完成次数、完成凭证 | 撤回、编辑、催促 |
| 作品审核 | `/operator/review`, `/cs/review` | `getMyPublishedApi(status=doing)` | 无显式筛选，支持排序/分页 | 选择列、参考图、作品预览、待审核状态 | 批量通过、单条通过、驳回、驳回附件 |
| 运营任务审核 | `/operator/op-review` | `getMyPublishedApi(status=doing, taskGroup=operator)` | 无显式筛选，支持排序/分页 | 店铺、文件地址、完成次数、完成凭证 | 批量通过、单条通过、驳回 |
| 任务大厅 | `/designer/hall`, `/basic/hall`, `/operator-assistant/hall` | `getTaskHallApi(taskGroup=design/cs/operator)` | 关键词 | 按角色切换款号/旺旺/店铺/文件地址等列 | 接单、详情内接单 |
| 后台全量任务 | `/admin/tasks/design`, `/admin/tasks/operator`, `/admin/tasks/cs` | `getAllTasksApi(taskGroup=*)` | 关键词、状态、发布人、接单人、日期 | 选择列、发布人、接单人、状态 | 导出当前筛选、导出选中、下载文件、批量删除、单条删除 |
| 基础美工分值审核 | `/basic/score-review` | `getScoreReviewListApi` | 发布人、基础美工 | 申请分值、美工、发布人、参考图、作品预览 | 同意、驳回 |
| 基础美工审核记录 | `/basic/review-records` | `getScoreReviewRecordsApi` | 发布人、基础美工、状态、日期 | 申请分值、审核通过分数、最终分值、驳回原因 | 查看作品，仅记录展示 |

## 适合优先抽象的 80%

- 文件分类与展示：参考图、参考附件、作品图、作品附件、预览 URL、下载入口、拖拽入口。
- 详情加载流程：`getTaskDetailApi`、图片预加载、失败时 fallback 到当前行、打开/关闭内联详情。
- 状态展示：状态文案、状态 tag、进度条宽度，优先统一使用 `useTaskStatus`。
- 分页/筛选骨架：页码、页大小、loading、total、列表回填、固定状态路由参数。
- Dashboard 跳转参数解析：`openTask`、`dateStart/dateEnd`、`status`、`dateField` 的读取和回灌。

## 暂不抽象的页面专有逻辑

- 设计师上传路径内联编辑、基础美工任务转移、运营助理完成次数编辑。
- 发布方编辑任务、客服重开、客服改编号、催促。
- 审核页的驳回弹窗、驳回附件上传、批量审核选择状态。
- 后台全量任务的导出、批量下载、批量删除。
- 分值审核与审核记录的分值状态流。

## 迁移门槛

- 迁移某个页面前，该页面必须有浏览器特征测试覆盖稳定可见行为。
- 抽象只能接收显式参数，不在共享模块中判断具体路由并硬编码角色。
- 每批只迁移一个共享能力或一个页面，迁移后运行任务页特征测试和 `npm run build`。
