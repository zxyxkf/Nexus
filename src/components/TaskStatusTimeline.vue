<template>
  <div class="task-status-panel">
    <div class="task-status-head">
      <div>
        <div class="task-status-title">{{ currentTitle }}</div>
        <div class="task-status-desc">{{ currentDesc }}</div>
      </div>
      <el-tag :type="statusType" size="small">{{ statusLabel }}</el-tag>
    </div>

    <el-alert
      v-if="task.status === 'rejected'"
      type="warning"
      show-icon
      :closable="false"
      class="task-status-alert"
      title="任务已被驳回，请根据驳回原因修改后重新提交。"
    />
    <el-alert
      v-else-if="task.status === 'doing'"
      type="info"
      show-icon
      :closable="false"
      class="task-status-alert"
      :title="reviewHint"
    />

    <div class="task-timeline">
      <div v-for="item in timeline" :key="item.key" class="task-timeline-item" :class="{ done: item.done, active: item.active }">
        <div class="task-timeline-dot"></div>
        <div class="task-timeline-content">
          <div class="task-timeline-label">{{ item.label }}</div>
          <div class="task-timeline-time">{{ item.time || '待完成' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { STATUS_MAP, STATUS_TAG_TYPE } from '@/utils/format'

const props = defineProps({
  task: { type: Object, required: true },
  taskGroup: { type: String, default: 'design' }
})

const reviewerName = computed(() => props.taskGroup === 'operator' ? '运营' : props.taskGroup === 'cs' ? '客服' : '运营')
const workerName = computed(() => props.taskGroup === 'operator' ? '运营助理' : props.taskGroup === 'cs' ? '基础美工' : '美工')
const statusLabel = computed(() => STATUS_MAP[props.task.status] || props.task.status)
const statusType = computed(() => STATUS_TAG_TYPE[props.task.status] || 'info')
const reviewHint = computed(() => `任务已提交，等待${reviewerName.value}审核。审核通过后会进入完成记录。`)

const currentTitle = computed(() => {
  const map = {
    draft: '草稿待重新发布',
    wait: `等待${workerName.value}接单`,
    accepted: `等待${workerName.value}上传提交`,
    doing: `等待${reviewerName.value}审核`,
    rejected: '已驳回，等待重新提交',
    finished: '已审核通过并留存'
  }
  return map[props.task.status] || '任务状态'
})

const currentDesc = computed(() => {
  if (props.task.status === 'doing') return `当前任务应出现在${reviewerName.value}的审核页面。`
  if (props.task.status === 'finished') return '当前任务应在我的任务或全量任务中留存。'
  if (props.task.status === 'rejected') return '重新提交后会再次进入待审核状态。'
  return '下方展示该任务的关键流转节点。'
})

const timeline = computed(() => {
  const task = props.task
  const items = [
    { key: 'create', label: '发布任务', time: task.create_time, done: true },
    { key: 'accept', label: `${workerName.value}接单`, time: task.designer_id ? (task.update_time || task.create_time) : '', done: ['accepted', 'doing', 'rejected', 'finished'].includes(task.status) },
    { key: 'submit', label: '上传提交', time: task.submit_time || (['doing', 'rejected', 'finished'].includes(task.status) ? task.update_time : ''), done: ['doing', 'rejected', 'finished'].includes(task.status) },
    { key: 'review', label: `${reviewerName.value}审核`, time: task.finish_time || (task.status === 'rejected' ? task.update_time : ''), done: ['rejected', 'finished'].includes(task.status) }
  ]
  return items.map(item => ({ ...item, active: !item.done && item.key === activeKey(task.status) }))
})

function activeKey(status) {
  if (status === 'wait') return 'accept'
  if (status === 'accepted') return 'submit'
  if (status === 'doing') return 'review'
  if (status === 'rejected') return 'submit'
  return ''
}
</script>

<style scoped>
.task-status-panel {
  grid-column: 1 / -1;
  border: 1px solid var(--dd-border-light);
  border-radius: 8px;
  padding: 12px;
  background: var(--dd-bg-card);
}
.task-status-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.task-status-title { font-size: 14px; font-weight: 700; color: var(--dd-text-primary); }
.task-status-desc { font-size: 12px; color: var(--dd-text-muted); margin-top: 3px; }
.task-status-alert { margin-top: 10px; }
.task-timeline { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 8px; margin-top: 12px; }
.task-timeline-item { display: flex; gap: 8px; align-items: flex-start; color: var(--dd-text-muted); }
.task-timeline-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; background: var(--dd-border); flex-shrink: 0; }
.task-timeline-item.done .task-timeline-dot { background: var(--dd-success); }
.task-timeline-item.active .task-timeline-dot { background: var(--dd-primary); box-shadow: 0 0 0 4px rgba(67, 97, 238, 0.12); }
.task-timeline-label { font-size: 12px; font-weight: 600; color: var(--dd-text-primary); }
.task-timeline-time { font-size: 11px; margin-top: 2px; }
@media (max-width: 900px) {
  .task-timeline { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
}
</style>
