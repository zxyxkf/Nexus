# 15.3.0 后功能可靠性修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 15.3.0 后新增功能中的数据一致性、上传内存、文件鉴权、异常文件名和页面状态问题。

**Architecture:** 文件先进入磁盘临时目录，数据库修改统一在 `executeTransaction` 提供的连接内完成，文件系统通过成功后清理或失败补偿维持一致性。任务发布使用单个 multipart 接口把任务、参考文件和款式图快照作为一个业务提交；文件读取权限复用任务详情权限规则。

**Tech Stack:** Vue 3、Axios、Express、Multer、SQLite/sql.js、MySQL2、Jest/Supertest、Playwright

---

### Task 1: 素材库事务与目录迁移

**Files:**
- Modify: `standalone-server/dao/material-library.dao.js`
- Modify: `standalone-server/services/material-library.service.js`
- Modify: `standalone-server/routes/material-library.js`
- Modify: `standalone-server/routes/config.js`
- Modify: `src/api/material-library.js`
- Modify: `src/views/material-library/Images.vue`
- Test: `standalone-server/tests/api/material-library.test.js`

- [ ] 在 DAO 中为查询、插入、删除和排序方法增加可选事务执行器，并确保事务调用不再回落到全局 `execute()`。
- [ ] 将一次素材上传的全部图片记录放进同一个事务，异常时删除本批正式文件和全部临时文件。
- [ ] 前端一次提交用户本次选择的全部文件，并在成功或失败后重新加载款式图片。
- [ ] 将商品库、款式和单图删除改为数据库事务成功后再清理物理文件。
- [ ] 实现素材目录绝对路径/写权限验证、引用文件复制、配置切换失败回滚和并发锁。
- [ ] 增加批次失败无孤儿记录、事务排序和目录迁移测试，并运行 `npm test -- --runInBand tests/api/material-library.test.js`。

### Task 2: 款式图快照磁盘化与统一文件名

**Files:**
- Modify: `standalone-server/routes/task/task-style-snapshot.js`
- Modify: `standalone-server/services/task-style-snapshot.service.js`
- Modify: `standalone-server/routes/task/task-action.js`
- Modify: `src/api/task.js`
- Test: `standalone-server/tests/api/task-style-snapshot.test.js`
- Test: `standalone-server/tests/api/cs-modification.test.js`
- Test: `standalone-server/tests/api/task-original-upload.test.js`

- [ ] 把编辑图片 Multer 存储改为操作系统临时目录，校验文件数量、单文件大小和总大小，并在所有出口清理临时文件。
- [ ] 服务层同时支持磁盘临时文件和测试 Buffer，保存失败时删除已生成的款式图。
- [ ] 抽取前端安全 multipart 追加函数，把原始文件名放进 JSON 字段。
- [ ] 在修改申请、修改完成和原图上传路由恢复原始文件名后再调用服务层。
- [ ] 使用包含控制字符和中文的文件名验证所有新增上传入口。

### Task 3: 原子任务发布

**Files:**
- Modify: `standalone-server/routes/task/task-crud.js`
- Modify: `standalone-server/services/task.service.js`
- Modify: `standalone-server/services/task-style-snapshot.service.js`
- Modify: `src/api/task.js`
- Modify: `src/views/shared/PublishTask.vue`
- Test: `standalone-server/tests/api/task.test.js`

- [ ] 从 `createTask` 提取任务记录创建和成功通知逻辑，保持原 `/create` 行为不变。
- [ ] 新增 multipart 发布路由，解析任务 JSON、参考文件、素材清单和编辑图片。
- [ ] 在一个数据库事务内插入任务、参考文件和款式图记录；任一步失败时回滚并删除落盘文件。
- [ ] 事务提交后才发送分配通知和 Socket 更新。
- [ ] 将共享发布页切换到新接口，只有完整成功才清空表单并提示成功。
- [ ] 测试中模拟素材源文件缺失，确认任务、文件记录和物理文件均未残留。

### Task 4: 文件资源鉴权和拖拽

**Files:**
- Modify: `standalone-server/services/task.service.js`
- Modify: `standalone-server/routes/task.js`
- Modify: `standalone-server/services/material-library.service.js`
- Modify: `standalone-server/routes/material-library.js`
- Modify: `src/api/upload.js`
- Test: `standalone-server/tests/api/task.test.js`
- Test: `standalone-server/tests/api/material-library.test.js`

- [ ] 提取任务详情使用的资源查看判定，并由详情、预览、下载共同调用。
- [ ] 任务文件查询关联任务 ID，越权时返回 403。
- [ ] 素材预览和下载调用素材服务的读取权限检查，并改为私有缓存。
- [ ] 素材拖拽下载地址与任务文件一样附加当前 Token。
- [ ] 覆盖本人、执行人、同店铺、分区全量权限、暂存和无权限用户矩阵。

### Task 5: 页面状态、下载目录与错误文案

**Files:**
- Modify: `src/views/basic/MyTasks.vue`
- Modify: `src/views/shared/MyTasksPub.vue`
- Modify: `standalone-server/routes/task.js`
- Modify: `standalone-server/services/task.service.js`
- Modify: `tests/task-pages/task-page-features.spec.js`

- [ ] 按路由名称隔离基础美工筛选缓存，并清理当前页面不可用的持久化状态。
- [ ] 非客服页面隐藏“待上传原图”。
- [ ] ZIP 路径按参考图、款式图、效果图、原图或运营美工作品区分。
- [ ] 将原图上传与完成流程的乱码、英文提示替换为明确中文。
- [ ] 同步当前状态名称和已删除控件的 Playwright 断言。

### Task 6: 全量回归验证

**Files:**
- Verify only; do not build or package.

- [ ] 对全部改动 JavaScript 文件运行 `node --check`。
- [ ] 在 `standalone-server` 运行 `npm test -- --runInBand`，预期全部通过。
- [ ] 在仓库根目录运行 `npm run test:task-pages`，预期全部通过。
- [ ] 运行 `git diff --check` 和 `git status --short`，确认没有构建产物、打包产物或意外文件。
- [ ] 复核没有生产地址请求、构建、打包、提交或推送。
