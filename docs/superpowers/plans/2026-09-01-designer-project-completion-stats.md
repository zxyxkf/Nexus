# Designer Project Completion Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add strict, review-approved project completion statistics to the advanced designer dashboard and designer personal statistics while excluding pending-review tasks from assignee workload.

**Architecture:** Extend the existing task statistics payload with one reusable project-completion aggregation that counts only `finished` tasks and groups dated results by `finish_time`. Keep dashboard period switching entirely local to its project-statistics card, reuse `StatsPanel` behind an opt-in prop for the designer-only monthly matrix, and change only the shared assignee query's active status set.

**Tech Stack:** Vue 3, Element Plus, Node.js, Express, SQLite/MySQL-compatible SQL, Jest, Supertest, Playwright

---

## File Structure

- Modify `standalone-server/services/task.service.js`: build all/current/last/current-year project completion counts and expose them through existing admin and personal statistics payloads.
- Modify `standalone-server/dao/task.dao.js`: include `score_item_id` in personal task detail rows.
- Modify `standalone-server/dao/user.dao.js`: count `accepted` and `rejected`, but not `doing`, as active assignee work.
- Create `standalone-server/tests/api/project-completion-stats.test.js`: verify strict completion periods, personal payload, and workload statuses against SQLite.
- Modify `src/views/admin/Dashboard.vue`: add a card-local `全部 / 当月 / 上月` selector and select the corresponding count field.
- Modify `src/components/StatsPanel.vue`: add an opt-in monthly project type matrix.
- Modify `src/views/designer/Stats.vue`: enable the new matrix only for designer personal statistics while preserving the existing locally modified card list.
- Modify `tests/task-pages/task-page-features.spec.js`: verify the local dashboard selector, designer matrix, and role isolation while preserving unrelated existing test changes.

### Task 1: Lock The Backend Statistics And Workload Contract

**Files:**
- Create: `standalone-server/tests/api/project-completion-stats.test.js`

- [ ] **Step 1: Write a failing API regression test**

Use `setupApp()` and create a dedicated operator and designer. Create tasks for one design score item, then update their states and dates through the test database:

```js
const taskCases = [
  { status: 'finished', finishTime: currentMonthTime },
  { status: 'finished', finishTime: lastMonthTime },
  { status: 'finished', finishTime: olderTime },
  { status: 'doing', finishTime: currentMonthTime },
  { status: 'accepted', finishTime: null },
  { status: 'rejected', finishTime: null }
]
```

Assert the admin detail and designer personal endpoints expose:

```js
expect(project).toMatchObject({
  count: 3,
  current_month_count: 1,
  last_month_count: 1
})
expect(project.monthly_counts).toHaveLength(12)
```

Assert the designer list's `active_tasks` contains the `accepted` and `rejected` task IDs but not the `doing` or `finished` task IDs.

- [ ] **Step 2: Run the new API test and verify red**

Run:

```powershell
cd standalone-server
npx jest tests/api/project-completion-stats.test.js --runInBand
```

Expected: project period fields are missing, personal `project_stats` is missing, and workload still contains `doing` instead of `rejected`.

### Task 2: Implement Strict Project Completion Aggregation

**Files:**
- Modify: `standalone-server/services/task.service.js:1008-1225`
- Modify: `standalone-server/dao/task.dao.js:747-753`

- [ ] **Step 1: Include project identity in personal detail rows**

Extend `getDesignerDetailRows` without changing its filter:

```sql
SELECT finish_time, create_time, score, actual_quantity, status,
       score_review_status, score_item_id
FROM task_info
WHERE designer_id = ?
```

- [ ] **Step 2: Add a reusable project completion aggregator**

Add an internal helper near the other statistics builders:

```js
function buildProjectCompletionStats(tasks, scoreItems, refDate = new Date()) {
  const currentStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const nextStart = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
  const lastStart = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
  const year = refDate.getFullYear();
  const rows = new Map((scoreItems || []).map(item => [Number(item.id), {
    project_name: item.name,
    count: 0,
    current_month_count: 0,
    last_month_count: 0,
    monthly_counts: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: 0 }))
  }]));

  for (const task of tasks || []) {
    if (task.status !== 'finished') continue;
    const row = rows.get(Number(task.score_item_id));
    if (!row) continue;
    row.count += 1;
    const finishedAt = parseDateTime(task.finish_time);
    if (!finishedAt) continue;
    if (finishedAt >= currentStart && finishedAt < nextStart) row.current_month_count += 1;
    if (finishedAt >= lastStart && finishedAt < currentStart) row.last_month_count += 1;
    if (finishedAt.getFullYear() === year) row.monthly_counts[finishedAt.getMonth()].count += 1;
  }

  return [...rows.values()];
}
```

- [ ] **Step 3: Use the helper in admin statistics**

In `buildDesignerStats`, remove the existing all-status `projectMap` increments and return:

```js
project_stats: buildProjectCompletionStats(userTasks, relevantItems, now)
```

Keep every score, monthly score, daily score, completion rate, and publisher statistic unchanged.

- [ ] **Step 4: Use the helper for designer personal statistics only**

Load score items only when `role === 'designer'`, filter them to `source === 'design'`, and add:

```js
project_stats: role === 'designer'
  ? buildProjectCompletionStats(detailRows, designScoreItems, now)
  : undefined
```

Do not add this field for `basic_designer` or `operator_assistant`.

- [ ] **Step 5: Run the API regression test**

Run:

```powershell
cd standalone-server
npx jest tests/api/project-completion-stats.test.js --runInBand
```

Expected: the statistics assertions pass; the workload assertion still fails until Task 3.

### Task 3: Exclude Pending Review From Assignee Workload

**Files:**
- Modify: `standalone-server/dao/user.dao.js:137-154`

- [ ] **Step 1: Change only the active status condition**

Replace:

```sql
t.status IN ('accepted','doing')
```

with:

```sql
t.status IN ('accepted','rejected')
```

Do not modify the returned JSON structure, user roles, ordering, or any publish/assignment service.

- [ ] **Step 2: Run the API regression test**

Run:

```powershell
cd standalone-server
npx jest tests/api/project-completion-stats.test.js --runInBand
```

Expected: all project statistics and active workload assertions pass.

### Task 4: Lock The Frontend Display Contract

**Files:**
- Modify: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: Add dashboard period-switching coverage**

Mock a designer project row with distinct values:

```js
project_stats: [{
  project_name: '主图',
  count: 7,
  current_month_count: 2,
  last_month_count: 1,
  monthly_counts: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: index + 1 }))
}]
```

Open `/#/dashboard`, locate the card containing the exact title `项目类型完成统计`, verify `全部` initially shows `7`, click `当月` and verify `2`, then click `上月` and verify `1`. Assert the selector is inside this card's header.

- [ ] **Step 2: Add designer-only monthly matrix coverage**

Mock `/api/task/stats/my` with the same `project_stats`, open `/#/designer/stats`, and assert:

- `月度项目类型完成统计` is visible.
- The row header is `工作项目类型`.
- Columns `1月` and `12月` are visible.
- The `主图` row contains the expected first and twelfth month values.

Open `/#/basic/stats` in a separate context and assert the new section is absent.

- [ ] **Step 3: Run the new frontend tests and verify red**

Run:

```powershell
npx playwright test --config=playwright.task-pages.config.js -g "project type completion period|designer monthly project type"
```

Expected: both tests fail because the selector and personal matrix do not exist.

### Task 5: Add The Card-Local Dashboard Period Selector

**Files:**
- Modify: `src/views/admin/Dashboard.vue:112-125, 455-515`

- [ ] **Step 1: Add local period state**

```js
const projectPeriod = ref('all')
const projectCountKey = computed(() => ({
  all: 'count',
  current: 'current_month_count',
  last: 'last_month_count'
}[projectPeriod.value] || 'count')
```

- [ ] **Step 2: Place the selector inside the project card header**

Use an Element Plus radio-button group in the same card header:

```vue
<div class="card-header project-stat-header">
  <span class="card-title">项目类型完成统计</span>
  <el-radio-group v-model="projectPeriod" size="small">
    <el-radio-button value="all">全部</el-radio-button>
    <el-radio-button value="current">当月</el-radio-button>
    <el-radio-button value="last">上月</el-radio-button>
  </el-radio-group>
</div>
```

Use `label` instead of `value` if required by the installed Element Plus version.

- [ ] **Step 3: Select the displayed count locally**

In `projectFlatData`, assign each project cell from `p[projectCountKey.value]`, defaulting to `0`. Add only the minimal header alignment style needed to keep the title left and selector right.

- [ ] **Step 4: Run the dashboard frontend test**

Run:

```powershell
npx playwright test --config=playwright.task-pages.config.js -g "project type completion period"
```

Expected: the dashboard selector test passes without changing any other dashboard section.

### Task 6: Add Designer Monthly Project Type Statistics

**Files:**
- Modify: `src/components/StatsPanel.vue`
- Modify: `src/views/designer/Stats.vue`

- [ ] **Step 1: Add an opt-in shared panel prop**

Extend `StatsPanel` props:

```js
const props = defineProps({
  cards: { type: Array, required: true },
  showProjectMonthly: { type: Boolean, default: false }
})
```

- [ ] **Step 2: Build stable rows and 12 columns**

```js
const projectMonths = Array.from({ length: 12 }, (_, index) => ({
  key: `m${index + 1}`,
  label: `${index + 1}月`,
  month: index + 1
}))

const projectMonthlyRows = computed(() => (stats.value.project_stats || []).map(project => {
  const row = { project_name: project.project_name }
  for (const month of projectMonths) {
    row[month.key] = Number(project.monthly_counts?.find(item => Number(item.month) === month.month)?.count || 0)
  }
  return row
}))
```

- [ ] **Step 3: Render the opt-in matrix below monthly scores**

Render a normal Element Plus table with the fixed first column `工作项目类型` and 12 centered month columns. Show it only when `showProjectMonthly` is true and rows exist.

- [ ] **Step 4: Enable it only for designers**

Change only the designer wrapper:

```vue
<StatsPanel :cards="cards" show-project-monthly />
```

Preserve the already adjusted five designer cards. Leave basic designer and operator assistant wrappers unchanged.

- [ ] **Step 5: Run the personal statistics frontend test**

Run:

```powershell
npx playwright test --config=playwright.task-pages.config.js -g "designer monthly project type"
```

Expected: the designer table and role-isolation assertions pass.

### Task 7: Verify, Commit Locally, And Restart Local Services

**Files:**
- Verify all files listed above.

- [ ] **Step 1: Run focused and complete backend tests**

```powershell
cd standalone-server
npx jest tests/api/project-completion-stats.test.js --runInBand
npm test -- --runInBand
```

Expected: all backend suites pass using temporary SQLite databases.

- [ ] **Step 2: Run focused and complete task-page tests**

```powershell
npx playwright test --config=playwright.task-pages.config.js -g "project type completion period|designer monthly project type"
npm run test:task-pages
```

Expected: all task-page tests pass. Do not run a build or packaging command.

- [ ] **Step 3: Check exact diffs**

```powershell
git diff --check -- standalone-server/services/task.service.js standalone-server/dao/task.dao.js standalone-server/dao/user.dao.js standalone-server/tests/api/project-completion-stats.test.js src/views/admin/Dashboard.vue src/components/StatsPanel.vue src/views/designer/Stats.vue tests/task-pages/task-page-features.spec.js
```

Verify every line traces to the approved design. Preserve unrelated local changes in `src/views/designer/Stats.vue` and `tests/task-pages/task-page-features.spec.js`.

- [ ] **Step 4: Commit only this feature locally**

Stage clean files normally and stage only the feature hunks from the two already modified files. Confirm the cached diff before committing:

```powershell
git diff --cached --check
git commit -m "feat: add designer project completion stats"
```

Do not push any remote.

- [ ] **Step 5: Start isolated local services**

Start the backend on `127.0.0.1:18632` with:

```text
USE_MYSQL=0
DB_ENGINE=sqlite
DATA_DIR=D:/WorkBuddy_speace/2026-05-09-task-1/d-design-art-manager/.local-dev-data
UPLOAD_DIR=D:/WorkBuddy_speace/2026-05-09-task-1/d-design-art-manager/.local-dev-upload
LOG_DIR=D:/WorkBuddy_speace/2026-05-09-task-1/d-design-art-manager/.local-dev-logs
```

Start Vite on `127.0.0.1:5173` with `VITE_FORCE_LOCAL_API=1` and `VITE_DEV_API_TARGET=http://127.0.0.1:18632`. Verify `/api/health` reports `code: 0`, the startup output names SQLite and the workspace-local database path, and the frontend returns HTTP 200.
