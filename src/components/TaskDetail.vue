<template>
  <el-dialog
    :model-value="visible"
    :title="task?.title || '任务详情'"
    width="75%"
    top="3vh"
    destroy-on-close
    @update:model-value="$emit('close')"
  >
    <template v-if="task">
      <TaskStatusTimeline :task="task" :task-group="taskGroup" class="detail-timeline" />

      <!-- 任务基本信息 -->
      <el-descriptions :column="3" border size="small" class="detail-descriptions">
        <el-descriptions-item label="任务编号">{{ task.task_no }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusType(task.status)" size="small">{{ statusLabel(task.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="分值">{{ task.score || '-' }}</el-descriptions-item>
        <el-descriptions-item label="数量">{{ task.quantity || 1 }}</el-descriptions-item>
        <el-descriptions-item v-if="task.actual_quantity !== undefined" label="实际完成">
          {{ task.actual_quantity || 0 }}
        </el-descriptions-item>
        <el-descriptions-item v-if="task.shop_name" label="店铺">{{ task.shop_name }}</el-descriptions-item>
        <el-descriptions-item v-if="task.wangwang_id" label="旺旺ID">{{ task.wangwang_id }}</el-descriptions-item>
        <el-descriptions-item v-if="task.style_number" label="款号">{{ task.style_number }}</el-descriptions-item>
        <el-descriptions-item v-if="task.specified_color" label="颜色">{{ task.specified_color }}</el-descriptions-item>
        <el-descriptions-item label="发布人">{{ task.publisher_name }}</el-descriptions-item>
        <el-descriptions-item v-if="task.designer_name" label="执行人">{{ task.designer_name }}</el-descriptions-item>
        <el-descriptions-item v-if="task.work_path" label="上传路径">{{ task.work_path }}</el-descriptions-item>
        <el-descriptions-item v-if="task.deadline" label="截止日期">{{ task.deadline }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(task.create_time) }}</el-descriptions-item>
        <el-descriptions-item v-if="task.submit_time" label="上传提交时间">{{ formatTime(task.submit_time) }}</el-descriptions-item>
        <el-descriptions-item v-if="task.finish_time" label="完成时间">{{ formatTime(task.finish_time) }}</el-descriptions-item>
      </el-descriptions>

      <!-- 描述 -->
      <div v-if="task.description" class="task-description">
        <strong>任务描述：</strong>
        <p>{{ task.description }}</p>
      </div>

      <!-- 驳回原因 -->
      <el-alert
        v-if="task.reject_reason"
        :title="'驳回原因：' + task.reject_reason"
        type="warning"
        :closable="false"
        show-icon
        style="margin:12px 0"
      />

      <!-- 参考图 / 参考文件 -->
      <div v-if="refImageFiles.length || refAttachments.length" class="detail-section">
        <div v-if="refImageFiles.length" class="file-section">
          <div class="section-label">参考图片 ({{ refImageFiles.length }})</div>
          <div class="image-grid">
            <div
              v-for="file in refImageFiles"
              :key="file.id"
              class="image-item"
              draggable="true"
              @dragstart="setupFileDrag($event, file)"
              @click="previewImage(file)"
            >
              <el-image :src="file._previewSrc || getFileUrl(file)" fit="cover" class="thumb-img" />
              <div class="image-name">{{ file.file_name }}</div>
              <el-button link type="primary" size="small" @click.stop="downloadFile(file)">下载</el-button>
            </div>
          </div>
        </div>
        <div v-if="refAttachments.length" class="file-section">
          <div class="section-label">参考文件 ({{ refAttachments.length }})</div>
          <div v-for="file in refAttachments" :key="file.id" class="file-link" draggable="true" @dragstart="setupFileDrag($event, file)">
            <el-icon><Document /></el-icon>
            <span style="cursor:pointer;color:#409EFF" @click="downloadFile(file)">
              {{ file.file_name }} ({{ formatSize(file.file_size) }})
            </span>
          </div>
        </div>
      </div>

      <!-- 作品图片 / 文件 -->
      <div v-if="workImageFiles.length || workAttachments.length" class="detail-section">
        <div v-if="workImageFiles.length" class="file-section">
          <div class="section-label">作品图片 ({{ workImageFiles.length }})</div>
          <div class="image-grid">
            <div
              v-for="file in workImageFiles"
              :key="file.id"
              class="image-item"
              draggable="true"
              @dragstart="setupFileDrag($event, file)"
              @click="previewImage(file)"
            >
              <el-image :src="file._previewSrc || getFileUrl(file)" fit="cover" class="thumb-img" />
              <div class="image-name">{{ file.file_name }}</div>
              <el-button link type="primary" size="small" @click.stop="downloadFile(file)">下载</el-button>
            </div>
          </div>
        </div>
        <div v-if="workAttachments.length" class="file-section">
          <div class="section-label">附件 ({{ workAttachments.length }})</div>
          <div v-for="file in workAttachments" :key="file.id" class="file-link" draggable="true" @dragstart="setupFileDrag($event, file)">
            <el-icon><Document /></el-icon>
            <span style="cursor:pointer;color:#409EFF" @click="downloadFile(file)">
              {{ file.file_name }} ({{ formatSize(file.file_size) }})
            </span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <slot name="actions" />
      <el-button @click="$emit('close')">关闭</el-button>
    </template>
  </el-dialog>

  <!-- 图片预览 -->
  <el-image-viewer
    v-if="previewVisible"
    :url-list="previewUrlList"
    :initial-index="previewIndex"
    @close="previewVisible = false"
    :hide-on-click-modal="true"
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import { Document } from '@element-plus/icons-vue'
import TaskStatusTimeline from '@/components/TaskStatusTimeline.vue'
import { getFileUrl, downloadFile as downloadFileUtil, setupFileDrag } from '@/api/upload'
import { useTaskStatus } from '@/composables/useTaskStatus'

const { statusLabel, statusType } = useTaskStatus()

const props = defineProps({
  visible: { type: Boolean, default: false },
  task: { type: Object, default: null },
  taskGroup: { type: String, default: 'design' }
})

defineEmits(['close'])

const previewVisible = ref(false)
const previewUrlList = ref([])
const previewIndex = ref(0)

const allFiles = computed(() => props.task?.files || [])

const refImageFiles = computed(() =>
  allFiles.value.filter(f => f.file_category === 'reference' && f.file_type === 'image')
)
const refAttachments = computed(() =>
  allFiles.value.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
)
const workImageFiles = computed(() =>
  allFiles.value.filter(f => f.file_category !== 'reference' && f.file_type === 'image')
)
const workAttachments = computed(() =>
  allFiles.value.filter(f => f.file_category !== 'reference' && f.file_type !== 'image')
)

function previewImage(file) {
  const images = [...refImageFiles.value, ...workImageFiles.value]
  previewUrlList.value = images.map(f => f._previewSrc || getFileUrl(f))
  previewIndex.value = images.findIndex(f => f.id === file.id)
  previewVisible.value = true
}

function downloadFile(file) {
  downloadFileUtil(file)
}

function formatTime(t) {
  return t || '-'
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}
</script>

<style scoped>
.detail-timeline { margin-bottom: 16px; }
.detail-descriptions { margin-bottom: 16px; }
.task-description { margin: 12px 0; padding: 10px; background: #f5f7fa; border-radius: 4px; }
.task-description p { margin: 4px 0 0; color: #606266; }
.detail-section { margin-top: 16px; border-top: 1px solid #EBEEF5; padding-top: 12px; }
.section-label { font-weight: 600; margin-bottom: 8px; color: #303133; }
.image-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.image-item { width: 100px; cursor: pointer; text-align: center; }
.thumb-img { width: 100px; height: 100px; border-radius: 4px; object-fit: cover; border: 1px solid #EBEEF5; }
.image-name { font-size: 11px; color: #909399; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
.file-section { margin-bottom: 12px; }
.file-link { display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 13px; }
</style>
