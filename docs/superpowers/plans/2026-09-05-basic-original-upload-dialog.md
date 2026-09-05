# 基础美工独立上传原图窗口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让基础美工在待上传原图列表中直接通过独立窗口上传并完成原图提交，避免进入详情页和重复点击。

**Architecture:** 复用现有 `OriginalUploadPanel`，新增可选的合并完成模式。基础美工列表通过任务详情接口取得完整任务对象后打开 `el-dialog`；合并模式的“完成上传”先上传当前选择文件，再调用完成接口，成功后由列表刷新并关闭窗口。详情页不传该模式，因此保留原双按钮行为。

**Tech Stack:** Vue 3 `<script setup>`、Element Plus、现有 `uploadOriginalFilesApi` / `completeOriginalUploadApi`、Vite。

---

### Task 1: 扩展原图上传组件的合并完成模式

**Files:**
- Modify: `src/components/task/OriginalUploadPanel.vue`

- [ ] **Step 1: 增加 `autoComplete` 属性**

新增布尔属性，默认 `false`，使现有详情页调用保持原行为。

```js
autoComplete: { type: Boolean, default: false }
```

- [ ] **Step 2: 将完成按钮改为统一入口**

按钮继续显示“完成上传”，点击后调用 `completeUpload`。当 `autoComplete` 为 `true` 且有待上传文件时，先执行上传，再完成状态流转；上传失败时停止并保留选择文件。

```js
async function completeUpload() {
  if (completing.value || uploading.value) return
  completing.value = true
  try {
    if (props.autoComplete && rawFiles.value.length) {
      const uploaded = await uploadFilesInternal()
      if (!uploaded) return
    }
    const response = await completeOriginalUploadApi(props.task.id)
    if (response.code !== 0) throw new Error(response.msg || '完成原图上传失败')
    emit('completed', props.task.id)
  } catch (error) {
    ElMessage.error(error.response?.data?.msg || error.message || '完成原图上传失败')
  } finally {
    completing.value = false
  }
}
```

上传逻辑抽成 `uploadFilesInternal()`，供独立按钮和合并完成模式共用；上传失败返回 `false`，不清空选择文件。

- [ ] **Step 3: 保留详情页原按钮语义**

`autoComplete === false` 时，“上传所选原图”仍只上传，“完成上传”仍只完成；不改变已有事件名和后端调用。

- [ ] **Step 4: 做组件静态检查**

运行 `npm run dev -- --host 127.0.0.1 --port 4173` 或使用当前 Vite 服务访问组件所在页面，确认无 Vue 编译错误。

### Task 2: 在基础美工待上传列表增加独立弹窗

**Files:**
- Modify: `src/views/basic/MyTasks.vue`

- [ ] **Step 1: 引入组件与弹窗状态**

新增 `OriginalUploadPanel` 引入，以及 `originalUploadVisible`、`originalUploadTask` 状态。

- [ ] **Step 2: 修改待上传原图入口**

将 `pending_original` 行的按钮从 `viewDetail(row)` 改为 `openOriginalUpload(row)`；其他状态按钮不变。

- [ ] **Step 3: 加载完整任务详情并打开窗口**

`openOriginalUpload(row)` 调用现有 `getTaskDetailApi({ id: row.id })`。成功后设置 `originalUploadTask` 并打开窗口；失败时提示错误，不改变列表状态。

- [ ] **Step 4: 复用组件并处理完成事件**

弹窗内容使用：

```vue
<OriginalUploadPanel
  v-if="originalUploadTask"
  :task="originalUploadTask"
  :auto-complete="true"
  :max-file-count="maxFileCount"
  :max-file-size-m-b="maxFileSizeMB"
  @completed="handleStandaloneOriginalCompleted"
/>
```

完成后关闭弹窗、清空当前任务、调用 `loadData({ silent: true })` 刷新列表与红点。上传失败不关闭窗口，保留已选文件以便重试。

- [ ] **Step 5: 限制弹窗滚动范围**

为弹窗设置合适宽度和 `overflow: auto` 内容区域，确保原图较多时只滚动弹窗内部，不造成页面整体跳转。

### Task 3: 回归验证

**Files:**
- Test: existing frontend source checks and existing backend task tests (no new test file)

- [ ] **Step 1: 运行前端编译检查**

运行 `npm run build -- --mode development` 仅作为编译检查；若用户明确禁止构建，则改用已运行的 Vite 热更新和 `npx vite --host 127.0.0.1 --port 4173` 页面加载检查，不生成交付包。

- [ ] **Step 2: 验证详情页行为未变**

确认 `TaskDetail.vue` 未传 `autoComplete`，详情页仍能分别执行“上传所选原图”和“完成上传”。

- [ ] **Step 3: 验证列表行为**

使用本地基础美工账号打开待上传原图：点击入口不跳详情页；拖拽/选择文件后点击一次“完成上传”完成状态流转；接口失败时窗口和文件仍保留。

- [ ] **Step 4: 检查工作区差异**

运行 `git diff --check`，确保没有空白错误或意外改动；不推送远程仓库。
