<template>
  <TaskDetailOverlay
    :visible="visible"
    :title="detailTitle"
    body-class="unified-task-detail-body"
    @close="$emit('close')"
  >
    <template #title-extra>
      <el-tag v-if="task && showSummaryStatus" :type="statusType(task.status)" size="small">
        {{ statusLabel(task.status) }}
      </el-tag>
    </template>

    <template #summary>
      <span
        v-for="item in summaryItems"
        :key="item.key"
        :class="item.className"
      >{{ item.value }}</span>
    </template>

    <template #actions>
      <slot name="actions" />
    </template>

    <div v-if="task" class="task-detail-content">
      <TaskStatusTimeline v-if="showStatusTimeline" :task="task" :task-group="taskGroup" />
      <TaskTransferTimeline
        v-if="showTransferTimeline"
        :records="task.transfer_records || []"
      />

      <section class="task-detail-information-panel">
        <el-descriptions :column="3" border size="small" class="task-detail-descriptions">
          <el-descriptions-item
            v-for="field in detailFields"
            :key="field.key || field.label"
            :label="field.label"
            :span="field.span || 1"
          >
            <el-tag v-if="field.type === 'score-review-status'" :type="scoreReviewTagType(field.status)" size="small">
              {{ field.value }}
            </el-tag>
            <span v-else :class="{ 'task-detail-danger-value': field.danger }">{{ field.value }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div
          v-for="row in detailPathRows"
          :key="row.key"
          class="task-detail-path-row"
        >
          <strong>{{ row.label }}</strong>
          <span>{{ row.value }}</span>
        </div>

        <div v-if="showDescription" class="task-detail-description-row">
          <strong>任务描述：</strong>
          <span>{{ descriptionValue }}</span>
        </div>
      </section>

      <div v-if="hasMedia" class="task-detail-media-grid">
        <section v-if="refFiles.length" class="task-detail-media-section">
          <h3 v-if="refImageFiles.length">{{ refImageLabel }} ({{ refImageFiles.length }})</h3>
          <div v-if="refImageFiles.length" class="task-detail-image-grid">
            <TaskDetailImage
              v-for="(file, index) in refImageFiles"
              :key="file.id"
              :file="file"
              :preview-list="refPreviewList"
              :initial-index="index"
              :hide-on-click-modal="currentContext === 'source-task'"
              :show-download="currentContext !== 'operator-assignee'"
              @download="downloadDetailFile(file)"
            />
          </div>
          <h4 v-if="refAttachments.length">{{ refAttachmentLabel }} ({{ refAttachments.length }})</h4>
          <TaskDetailAttachment
            v-for="file in refAttachments"
            :key="file.id"
            :file="file"
            :formatted-size="sourceFileSize(file.file_size)"
            @download="downloadDetailFile(file)"
          />
        </section>

        <section v-if="workFiles.length" class="task-detail-media-section">
          <h3 v-if="workImageFiles.length">{{ workImageLabel }} ({{ workImageFiles.length }})</h3>
          <div v-if="workImageFiles.length" class="task-detail-image-grid">
            <TaskDetailImage
              v-for="(file, index) in workImageFiles"
              :key="file.id"
              :file="file"
              :preview-list="workPreviewList"
              :initial-index="workPreviewInitialIndex(index)"
              :hide-on-click-modal="currentContext === 'source-task'"
              :show-download="currentContext !== 'operator-assignee'"
              @download="downloadDetailFile(file)"
            />
          </div>
          <h4 v-if="workAttachments.length">{{ workAttachmentLabel }} ({{ workAttachments.length }})</h4>
          <TaskDetailAttachment
            v-for="file in workAttachments"
            :key="file.id"
            :file="file"
            :formatted-size="sourceFileSize(file.file_size)"
            @download="downloadDetailFile(file)"
          />
        </section>
      </div>

      <RejectHistory v-if="showRejectHistory" :records="task.reject_records || []" />
    </div>
  </TaskDetailOverlay>
</template>

<script setup>
import { computed } from 'vue'
import TaskDetailOverlay from '@/components/TaskDetailOverlay.vue'
import TaskDetailImage from '@/components/TaskDetailImage.vue'
import TaskDetailAttachment from '@/components/TaskDetailAttachment.vue'
import TaskStatusTimeline from '@/components/TaskStatusTimeline.vue'
import TaskTransferTimeline from '@/components/TaskTransferTimeline.vue'
import RejectHistory from '@/components/RejectHistory.vue'
import { downloadFile, getFileUrl, saveFileToDisk } from '@/api/upload'
import {
  STATUS_MAP,
  STATUS_TAG_TYPE,
  formatDate,
  formatTaskHeaderTime,
  formatScoreReviewApprovedScore,
  formatScoreReviewStatus,
  formatScoreValue,
  scoreReviewTagType
} from '@/utils/format'
import { useTaskStatus } from '@/composables/useTaskStatus'

const props = defineProps({
  visible: { type: Boolean, default: false },
  task: { type: Object, default: null },
  taskGroup: { type: String, default: 'design' },
  detailContext: { type: String, default: '' }
})

defineEmits(['close'])

const {
  statusLabel: sourceStatusLabel,
  statusType: sourceStatusType
} = useTaskStatus()

const currentContext = computed(() => props.detailContext || 'source-task')
const allFiles = computed(() => props.task?.files || [])
const refFiles = computed(() => allFiles.value.filter(file => file.file_category === 'reference'))
const workFiles = computed(() => allFiles.value.filter(file => (
  file.file_category !== 'reference' &&
  (['design-assignee', 'hall'].includes(currentContext.value) || file.file_category !== 'reject')
)))
const refImageFiles = computed(() => refFiles.value.filter(file => file.file_type === 'image'))
const refAttachments = computed(() => refFiles.value.filter(file => file.file_type !== 'image'))
const workImageFiles = computed(() => currentContext.value === 'hall'
  ? []
  : workFiles.value.filter(file => file.file_type === 'image'))
const workAttachments = computed(() => currentContext.value === 'hall'
  ? workFiles.value
  : workFiles.value.filter(file => file.file_type !== 'image'))
const sourcePreviewList = computed(() => [...refImageFiles.value, ...workImageFiles.value]
  .map(file => file._previewSrc || getFileUrl(file)))
const refPreviewList = computed(() => currentContext.value === 'source-task'
  ? sourcePreviewList.value
  : refImageFiles.value.map(file => file._previewSrc || getFileUrl(file)))
const workPreviewList = computed(() => currentContext.value === 'source-task'
  ? sourcePreviewList.value
  : workImageFiles.value.map(file => file._previewSrc || getFileUrl(file)))
const hasMedia = computed(() => refFiles.value.length > 0 || workFiles.value.length > 0)
const isOperatorTask = computed(() => props.taskGroup === 'operator')
const isCsTask = computed(() => props.taskGroup === 'cs')
const showStatusTimeline = computed(() => !['hall', 'score-review'].includes(currentContext.value))
const showTransferTimeline = computed(() => isCsTask.value && currentContext.value !== 'hall')
const showRejectHistory = computed(() => isCsTask.value && currentContext.value !== 'hall')
const showDescription = computed(() => currentContext.value !== 'source-task' || Boolean(props.task?.description))
const descriptionValue = computed(() => {
  const fallback = currentContext.value === 'hall' ? '暂无描述' : '暂无'
  return props.task?.description || fallback
})
const detailTitle = computed(() => {
  const task = props.task || {}
  if (currentContext.value === 'source-task' || currentContext.value === 'design-assignee') {
    return task.title || '任务详情'
  }
  if (currentContext.value === 'hall') {
    if (props.taskGroup === 'design') return task.score_item_name || '任务详情'
    return task.title || task.score_item_name || task.task_no || '任务详情'
  }
  return task.title || task.task_no || '任务详情'
})
const showSummaryStatus = computed(() => [
  'source-task',
  'published',
  'design-assignee',
  'cs-assignee',
  'operator-published',
  'admin',
  'review-records'
].includes(currentContext.value))
const summaryItems = computed(() => {
  const task = props.task || {}
  const context = currentContext.value
  const items = []
  const add = (key, value, className = '') => {
    if (value !== undefined && value !== null && value !== '') {
      items.push({ key, value, className })
    }
  }
  const addTaskNumber = () => add('task-number', `#${task.task_no}`, 'detail-number')
  const addHeaderTime = () => add('header-time', formatTaskHeaderTime(task), 'detail-header-time')

  if (context === 'source-task') {
    add('designer', task.designer_name)
    add('submit-time', task.submit_time)
  } else if (context === 'hall') {
    if (isCsTask.value && task.task_no) addTaskNumber()
    add('publisher', task.publisher_name)
    addHeaderTime()
  } else if (context === 'published') {
    if (isCsTask.value && task.task_no) addTaskNumber()
    addHeaderTime()
  } else if (context === 'design-assignee' || context === 'operator-published') {
    addHeaderTime()
  } else if (context === 'cs-assignee') {
    if (task.task_no) addTaskNumber()
    addHeaderTime()
  } else if (context === 'operator-assignee') {
    add('publisher', task.publisher_name)
    addHeaderTime()
  } else if (context === 'admin') {
    if (isCsTask.value && task.task_no) addTaskNumber()
    addHeaderTime()
  } else if (context === 'review') {
    if (isCsTask.value && task.task_no) addTaskNumber()
    add('designer', task.designer_name)
    addHeaderTime()
  } else if (context === 'operator-review') {
    add('designer', task.designer_name)
    addHeaderTime()
  } else if (context === 'score-review') {
    if (task.task_no) addTaskNumber()
    add('designer', task.designer_name)
  } else if (context === 'review-records') {
    if (task.task_no) addTaskNumber()
    addHeaderTime()
  }

  return items
})
const workImageLabel = computed(() => {
  if (currentContext.value === 'hall') return '附件图片'
  if (isOperatorTask.value) return '完成凭证图片'
  if (currentContext.value === 'review') return '已提交作品图片'
  return '作品图片'
})
const refImageLabel = computed(() => currentContext.value === 'source-task' ? '参考图片' : '参考图')
const refAttachmentLabel = computed(() => currentContext.value === 'source-task' ? '参考文件' : '参考附件')
const workAttachmentLabel = computed(() => {
  if (currentContext.value === 'hall') return '附件'
  if (isOperatorTask.value) return '完成凭证附件'
  if (currentContext.value === 'review') return '已提交作品附件'
  return '作品附件'
})

const detailFields = computed(() => {
  const task = props.task || {}
  const fields = []
  const add = (label, value, options = {}) => fields.push({ label, value, ...options })
  const addPeople = (publisherFallback, label, assigneeFallback) => {
    add('发布人', task.publisher_name || publisherFallback)
    add(label, task.designer_name || assigneeFallback)
  }
  const addScoreReview = ({ applicationLabel = '申请分数', statusLabel = '分数审核状态' } = {}) => {
    add(applicationLabel, formatScoreValue(task.applied_score))
    add(statusLabel, formatScoreReviewStatus(task.score_review_status, task), {
      type: 'score-review-status',
      status: task.score_review_status
    })
    add('分数审核通过分数', formatScoreReviewApprovedScore(task))
  }
  const addTaskRejectReason = (label = '驳回原因') => {
    add(label, task.reject_reason, { span: 3, danger: true })
  }

  if (currentContext.value === 'source-task') {
    add('任务编号', task.task_no)
    add('状态', statusLabel(task.status))
    add('分值', task.score || '-')
    add('数量', task.quantity || 1)
    if (task.actual_quantity !== undefined) add('实际完成', task.actual_quantity || 0)
    if (task.shop_name) add('店铺', task.shop_name)
    if (task.wangwang_id) add('旺旺ID', task.wangwang_id)
    if (task.style_number) add('款号', task.style_number)
    if (task.specified_color) add('颜色', task.specified_color)
    add('发布人', task.publisher_name)
    if (task.designer_name) add('执行人', task.designer_name)
    if (task.work_path) add('上传路径', task.work_path)
    if (task.deadline) add('截止日期', task.deadline)
    add('创建时间', task.create_time || '-')
    if (task.submit_time) add('上传提交时间', task.submit_time)
    if (task.finish_time) add('完成时间', task.finish_time)
    if (task.reject_reason) addTaskRejectReason()
  } else if (currentContext.value === 'hall') {
    addPeople('-', '接单人', '未接单')
    add('工作项目', task.score_item_name || task.title || '-')
    add('分值', task.score || '-')
    if (props.taskGroup === 'operator') {
      add('店铺', task.shop_name || '-')
      add('任务数量', task.quantity || 1)
      add('任务文件地址', task.task_file_path || '-', { span: 3 })
    } else if (props.taskGroup === 'cs') {
      add('旺旺ID', task.wangwang_id || task.ref_path || '无')
      add('款号', task.style_number || '无')
      add('指定颜色', task.specified_color || '无')
    } else {
      add('款号', task.style_number || '无')
      add('指定颜色', task.specified_color || '无')
    }
    if (props.taskGroup !== 'design') {
      add('任务标题', task.title || '-', { span: 3 })
    }
  } else if (currentContext.value === 'published') {
    addPeople('我', props.taskGroup === 'cs' ? '基础美工' : '美工', '未接单')
    add('工作项目', task.title)
    add('分值', task.score || '-')
    add('款号', task.style_number || '无')
    if (props.taskGroup === 'cs') {
      add('旺旺ID', task.wangwang_id || task.ref_path || '无')
      add('指定颜色', task.specified_color || '无')
      addScoreReview()
    } else {
      add('指定颜色', task.specified_color || '无')
    }
    if (task.status === 'rejected') addTaskRejectReason()
    if (props.taskGroup === 'cs' && task.score_review_reason) {
      add('分数审核驳回原因', task.score_review_reason, { span: 3, danger: true })
    }
  } else if (currentContext.value === 'design-assignee') {
    addPeople('-', '接单人', '我')
    add('工作项目', task.title || '-')
    add('款号', task.style_number || '无')
    add('指定颜色', task.specified_color || '无')
    if (task.status === 'rejected') addTaskRejectReason()
  } else if (currentContext.value === 'cs-assignee') {
    addPeople('-', '接单人', '我')
    add('旺旺ID', task.wangwang_id || task.ref_path || '无')
    add('款号', task.style_number || '无')
    add('指定颜色', task.specified_color || '无')
    addScoreReview()
    if (task.status === 'rejected') addTaskRejectReason()
    if (task.score_review_reason) {
      add('分数审核驳回原因', task.score_review_reason, { span: 3, danger: true })
    }
  } else if (currentContext.value === 'operator-published') {
    addPeople('我', '接单人', '未接单')
    add('店铺', task.shop_name || '-')
    add('任务数量', task.quantity || 1)
    add('工作项目', task.title)
    add('分值', task.score || '-')
    add('任务文件地址', task.task_file_path || '-', { span: 3 })
    add('完成次数', task.actual_quantity || 0)
    add('上传路径', task.work_path || '无', { span: 3 })
    if (task.status === 'rejected') addTaskRejectReason()
  } else if (currentContext.value === 'operator-assignee') {
    addPeople('-', '接单人', '我')
    add('店铺', task.shop_name || '-')
    add('任务数量', task.quantity || 1)
    add('工作项目', task.title)
    add('分值', task.score || '-')
    add('任务文件地址', task.task_file_path || '-', { span: 3 })
    add('完成次数', task.actual_quantity || 0)
    if (task.status === 'rejected') addTaskRejectReason()
  } else if (currentContext.value === 'admin') {
    const label = props.taskGroup === 'cs' ? '基础美工' : props.taskGroup === 'operator' ? '运营助理' : '美工'
    addPeople('', label, '未接单')
    add('工作项目', task.title || '-')
    add('分值', task.score || '-')
    if (props.taskGroup === 'design') {
      add('款号', task.style_number || '无')
      add('指定颜色', task.specified_color || '无')
    }
    if (props.taskGroup === 'operator') {
      add('任务数量', task.quantity || 1)
      add('任务文件地址', task.task_file_path || '-', { span: 3 })
      add('完成次数', task.actual_quantity || 0)
    } else if (props.taskGroup === 'cs') {
      add('旺旺ID', task.wangwang_id || task.ref_path || '无')
      add('款号', task.style_number || '无')
      add('指定颜色', task.specified_color || '无')
      addScoreReview()
    }
    if (props.taskGroup === 'operator') {
      add('上传路径', task.work_path || '无', { span: 3 })
    }
    if (task.status === 'rejected') addTaskRejectReason()
    if (props.taskGroup === 'cs' && task.score_review_reason) {
      add('分数审核驳回原因', task.score_review_reason, { span: 3, danger: true })
    }
  } else if (currentContext.value === 'review') {
    const label = props.taskGroup === 'cs' ? '基础美工' : '美工'
    addPeople('-', label, '未接单')
    add('工作项目', task.title)
    if (props.taskGroup === 'cs') {
      add('旺旺ID', task.wangwang_id || task.ref_path || '无')
      add('款号', task.style_number || '无')
      add('指定颜色', task.specified_color || '无')
      addScoreReview()
    } else {
      add('分值', task.score || '-')
      add('款号', task.style_number || '无')
      add('指定颜色', task.specified_color || '无')
    }
    if (props.taskGroup === 'cs' && task.reject_reason) addTaskRejectReason()
    if (props.taskGroup === 'cs' && task.score_review_reason) {
      add('分数审核驳回原因', task.score_review_reason, { span: 3, danger: true })
    }
  } else if (currentContext.value === 'operator-review') {
    addPeople('-', '接单人', '未接单')
    add('店铺', task.shop_name || '-')
    add('任务数量', task.quantity || 1)
    add('工作项目', task.title)
    add('任务文件地址', task.task_file_path || '-', { span: 3 })
    add('完成次数', task.actual_quantity || 0)
    add('上传路径', task.work_path || '无', { span: 3 })
  } else if (currentContext.value === 'score-review') {
    addPeople('-', '接单人', '未接单')
    add('旺旺ID', task.wangwang_id || task.ref_path || '无')
    add('款号', task.style_number || '无')
    add('申请分值', task.applied_score)
    add('上传提交时间', formatDate(task.submit_time))
  } else if (currentContext.value === 'review-records') {
    addPeople('-', '接单人', '未接单')
    add('工作项目', task.title || '-')
    add('最终分值', formatScoreValue(task.score))
    add('旺旺ID', task.wangwang_id || task.ref_path || '无')
    add('款号', task.style_number || '无')
    add('申请分值', formatScoreValue(task.applied_score))
    add('分数审核通过分数', formatScoreReviewApprovedScore(task))
    add('分值审核状态', formatScoreReviewStatus(task.score_review_status, task), {
      type: 'score-review-status',
      status: task.score_review_status
    })
    if (task.score_review_reason) {
      add('驳回原因', task.score_review_reason, { span: 3 })
    }
    if (task.reject_reason) addTaskRejectReason('任务驳回原因')
  }

  return fields
})

const detailPathRows = computed(() => {
  const task = props.task || {}
  const context = currentContext.value
  const rows = []
  const add = (key, label, value) => rows.push({ key, label, value: value || '无' })

  // Design workflows show paths as full-width rows so long values remain scannable.
  if (['hall', 'published', 'design-assignee', 'admin', 'review'].includes(context)
    && props.taskGroup === 'design') {
    add('reference-path', '参考路径', task.ref_path)
    add('work-path', '上传路径', task.work_path)
  }
  return rows
})

function statusLabel(status) {
  if (currentContext.value === 'source-task') return sourceStatusLabel(status)
  return STATUS_MAP[status] || status || '-'
}

function workPreviewInitialIndex(index) {
  return currentContext.value === 'source-task' ? refImageFiles.value.length + index : index
}

function downloadDetailFile(file) {
  if (currentContext.value === 'source-task') {
    downloadFile(file)
    return
  }
  saveFileToDisk(file)
}

function sourceFileSize(bytes) {
  if (currentContext.value !== 'source-task') return ''
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function statusType(status) {
  if (currentContext.value === 'source-task') return sourceStatusType(status)
  return STATUS_TAG_TYPE[status] || 'info'
}
</script>

<style scoped>
.task-detail-content {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.task-detail-information-panel {
  overflow: hidden;
  border: 1px solid #d8dee8;
  border-radius: 6px;
  background: #fff;
}

.task-detail-descriptions {
  --el-border-color-lighter: #dfe4ec;
}

.task-detail-descriptions :deep(.el-descriptions__label.el-descriptions__cell) {
  width: 132px;
  color: #4b5565;
  font-weight: 600;
  background: #f1f3f7;
}

.task-detail-descriptions :deep(.el-descriptions__content.el-descriptions__cell) {
  color: #253047;
  background: #fff;
}

.task-detail-descriptions :deep(.el-descriptions__cell) {
  padding: 12px 16px;
}

.task-detail-path-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 16px;
  min-height: 48px;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid #dfe4ec;
  color: #253047;
  line-height: 1.6;
}

.task-detail-path-row strong {
  color: #4b5565;
  font-weight: 600;
}

.task-detail-path-row span {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.task-detail-danger-value {
  color: #e63946;
  white-space: pre-wrap;
}

.task-detail-description-row {
  display: flex;
  gap: 6px;
  min-height: 54px;
  padding: 14px 16px;
  border-top: 1px solid #dfe4ec;
  color: #596579;
  line-height: 1.7;
  white-space: pre-wrap;
}

.task-detail-description-row strong {
  flex: 0 0 auto;
  color: #253047;
}

.task-detail-media-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  padding-top: 16px;
  border-top: 1px solid #dfe4ec;
}

.task-detail-media-section {
  min-width: 0;
}

.task-detail-media-section h3 {
  margin: 0 0 12px;
  color: #253047;
  font-size: 15px;
  letter-spacing: 0;
}

.task-detail-media-section h4 {
  margin: 12px 0 4px;
  color: #596579;
  font-size: 13px;
  letter-spacing: 0;
}

.task-detail-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 108px);
  gap: 12px;
  margin-bottom: 10px;
}

@media (max-width: 900px) {
  .task-detail-media-grid {
    grid-template-columns: 1fr;
  }

  .task-detail-path-row {
    grid-template-columns: 110px minmax(0, 1fr);
  }
}
</style>
