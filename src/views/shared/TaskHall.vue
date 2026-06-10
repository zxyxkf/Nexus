<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">任务大厅</span>
          <div class="header-right">
            <el-input
              v-model="keyword"
              placeholder="搜索任务标题/编号"
              clearable
              style="width:240px;"
              @clear="loadData"
              @keyup.enter="loadData"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>
        </div>
      </template>

      <el-table :data="list" v-loading="loading" stripe style="width:100%" highlight-current-row>
        <template #empty>
          <TaskEmptyState description="暂无可领取任务" hint="可稍后查看，或清空搜索条件后重试" action-text="清空搜索" @action="clearSearch" />
        </template>
        <el-table-column prop="task_no" label="任务编号" width="140" show-overflow-tooltip />
        <el-table-column v-if="isOperatorAssistant" prop="shop_name" label="店铺" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.shop_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="title" label="工作项目" min-width="90" show-overflow-tooltip />
        <el-table-column label="分值" width="100" align="center">
          <template #default="{ row }">{{ row.score || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isOperatorAssistant" label="数量" width="70" align="center">
          <template #default="{ row }">{{ row.quantity || 1 }}</template>
        </el-table-column>
        <el-table-column v-if="isOperatorAssistant" label="文件地址" width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.task_file_path || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isBasicDesigner" label="旺旺ID" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.wangwang_id || row.ref_path || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="!isOperatorAssistant" label="款号" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.style_number || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isBasicDesigner" label="任务描述" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="!isBasicDesigner && !isOperatorAssistant" label="指定颜色" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.specified_color || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="!isBasicDesigner && !isOperatorAssistant" label="参考路径" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.ref_path || '-' }}</template>
        </el-table-column>
        <el-table-column label="参考图" width="170" align="center">
          <template #default="{ row }">
            <div
              v-if="getRefImages(row.files).length"
              draggable="true"
              @dragstart="setupFileDrag($event, getRefImages(row.files)[0])"
              style="display:inline-block;"
            >
              <el-image
                :src="getFileUrl(getRefImages(row.files)[0])"
                fit="cover"
                :preview-src-list="getRefImageSrcList(row.files)"
                preview-teleported
                style="width:48px;height:48px;border-radius:6px;cursor:pointer;border:1px solid #e4e7ed;"
              />
            </div>
            <el-tooltip
              v-else-if="getRefAttachments(row.files).length"
              :content="getRefAttachments(row.files).map(f => f.file_name).join('\n')"
              placement="top"
            >
              <div class="file-badge" draggable="true" @dragstart="setupFileDrag($event, getRefAttachments(row.files)[0])" @mouseenter="preloadFilesForDrag(getRefAttachments(row.files))">
                <el-icon :size="18"><Document /></el-icon>
                <span>{{ getRefAttachments(row.files).length }}个附件</span>
              </div>
            </el-tooltip>
            <span v-else style="color:#c0c4cc;font-size:12px;">-</span>
          </template>
        </el-table-column>
        <el-table-column v-if="!isBasicDesigner && !isOperatorAssistant" label="截止时间" min-width="80">
          <template #default="{ row }">{{ row.deadline || '-' }}</template>
        </el-table-column>
        <el-table-column prop="publisher_name" label="发布人" width="105" />
        <el-table-column prop="create_time" label="发布时间" width="170" sortable show-overflow-tooltip>
          <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">详情</el-button>
            <el-button type="primary" size="small" @click="acceptTask(row)" :loading="acceptingId === row.id">接单</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <Pagination
          v-model:currentPage="page"
          v-model:pageSize="pageSize"
          :total="total"
          :page-sizes="[10, 15, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadData"
          @size-change="loadData"
        />
      </div>

      <!-- 任务详情 —— 内联覆盖层 -->
      <transition name="overlay-fade">
        <div v-if="detailVisible" class="inline-detail-overlay">
          <div class="inline-detail-header">
            <div class="detail-header-left">
              <span v-if="isBasicDesigner" class="detail-number">#{{ currentTask.task_no }}</span>
              <span v-else class="detail-project-title" :title="currentTask.title || currentTask.score_item_name || '-'">{{ currentTask.title || currentTask.score_item_name || '-' }}</span>
              <span style="font-size:14px;font-weight:600;">{{ currentTask.publisher_name }}</span>
              <span class="detail-header-time">{{ formatTaskHeaderTime(currentTask) }}</span>
            </div>
            <div class="detail-header-right">
              <el-button type="primary" size="small" @click="acceptInDetail" :loading="acceptingId === currentTask?.id">接单</el-button>
              <el-button circle @click="detailVisible = false"><el-icon><Close /></el-icon></el-button>
            </div>
          </div>

          <div class="inline-detail-body">
            <div class="inline-detail-stat-card">
              <label>工作项目</label>
              <span>{{ currentTask.score_item_name || '-' }}</span>
            </div>
            <div class="inline-detail-stat-card">
              <label>分值</label>
              <span>{{ currentTask.score || '-' }}</span>
            </div>
            <template v-if="isOperatorAssistant">
              <div class="inline-detail-stat-card">
                <label>店铺</label>
                <span>{{ currentTask.shop_name || '-' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>任务数量</label>
                <span>{{ currentTask.quantity || 1 }}</span>
              </div>
              <div class="inline-detail-stat-card full-width">
                <label>任务文件地址</label>
                <span>{{ currentTask.task_file_path || '-' }}</span>
              </div>
            </template>
            <template v-if="isBasicDesigner">
              <div class="inline-detail-stat-card">
                <label>旺旺ID</label>
                <span>{{ currentTask.wangwang_id || currentTask.ref_path || '无' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>款号</label>
                <span>{{ currentTask.style_number || '无' }}</span>
              </div>
            </template>
            <template v-else-if="!isOperatorAssistant">
              <div class="inline-detail-stat-card">
                <label>款号</label>
                <span>{{ currentTask.style_number || '无' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>指定颜色</label>
                <span>{{ currentTask.specified_color || '无' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>参考路径</label>
                <span class="multiline-value">{{ currentTask.ref_path || '无' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>截止时间</label>
                <span>{{ currentTask.deadline || '无' }}</span>
              </div>
            </template>

            <div class="inline-detail-stat-card full-width">
              <label>任务标题</label>
              <span>{{ currentTask.title }}</span>
            </div>
            <div class="inline-detail-stat-card full-width">
              <label>任务描述</label>
              <div class="value" style="white-space:pre-wrap;">{{ currentTask.description || '暂无描述' }}</div>
            </div>

            <template v-if="currentTask.files && currentTask.files.length">
              <div v-if="detailRefImages.length" class="inline-detail-files">
                <h4>参考图 ({{ detailRefImages.length }})</h4>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  <div v-for="file in detailRefImages" :key="file.id" style="position:relative;" draggable="true" @dragstart="setupFileDrag($event, file)">
                    <el-image
                      :src="file._previewSrc || getFileUrl(file)"
                      fit="contain"
                      :preview-src-list="detailRefPreviewList"
                      preview-teleported
                      style="width:120px;height:120px;border-radius:8px;border:1px solid #e4e7ed;"
                    />
                    <el-button type="primary" link size="small" @click="downloadFile(file)" style="position:absolute;bottom:4px;right:4px;background:rgba(255,255,255,0.9);border-radius:4px;">下载</el-button>
                  </div>
                </div>
              </div>
              <div v-if="detailRefAttachments.length" class="inline-detail-files">
                <h4>参考附件 ({{ detailRefAttachments.length }})</h4>
                <div v-for="file in detailRefAttachments" :key="file.id" class="file-card" draggable="true" @dragstart="setupFileDrag($event, file)">
                  <el-icon :size="28" color="#909399"><Document /></el-icon>
                  <div class="file-card-info">
                    <span class="file-card-name">{{ file.file_name }}</span>
                    <span class="file-card-size">{{ formatSize(file.file_size) }}</span>
                  </div>
                  <el-button type="primary" link size="small" @click="downloadFile(file)">下载</el-button>
                </div>
              </div>
              <div v-if="detailAttachFiles.length" class="inline-detail-files">
                <h4>附件 ({{ detailAttachFiles.length }})</h4>
                <div v-for="file in detailAttachFiles" :key="file.id" class="file-card" draggable="true" @dragstart="setupFileDrag($event, file)">
                  <el-icon :size="28" color="#909399"><Document /></el-icon>
                  <div class="file-card-info">
                    <span class="file-card-name">{{ file.file_name }}</span>
                    <span class="file-card-size">{{ formatSize(file.file_size) }}</span>
                  </div>
                  <el-button type="primary" link size="small" @click="downloadFile(file)">下载</el-button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </transition>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, Document } from '@element-plus/icons-vue'
import { getTaskHallApi, acceptTaskApi, getTaskDetailApi, getFileUrl, fetchImageDataUrl, setupFileDrag, preloadFilesForDrag } from '@/api'
import { formatDate, formatFileSize, formatTaskHeaderTime } from '@/utils/format'
import { useRealtime } from '@/composables/useRealtime'
import { useFileHelpers } from '@/composables/useFileHelpers'
import TaskEmptyState from '@/components/TaskEmptyState.vue'

const route = useRoute()
const isBasicDesigner = computed(() => route.meta.role === 'basic_designer')
const isOperatorAssistant = computed(() => route.meta.role === 'operator_assistant')
const taskGroup = computed(() => {
  if (route.meta.role === 'basic_designer') return 'cs'
  if (route.meta.role === 'operator_assistant') return 'operator'
  return 'design'
})

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)
const keyword = ref('')
const acceptingId = ref(null)
const detailVisible = ref(false)
const currentTask = ref(null)

const { getRefImages, getRefAttachments, getRefImageSrcList, downloadFile } = useFileHelpers()
const formatSize = formatFileSize

const detailRefImages = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
})
const detailRefPreviewList = computed(() => {
  return detailRefImages.value.map(f => f._previewSrc || getFileUrl(f))
})
const detailAttachFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference')
})
const detailRefAttachments = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
})

async function viewDetail(row) {
  try {
    const res = await getTaskDetailApi({ taskId: row.id })
    if (res.code === 0) {
      const files = res.data.files || []
      const refImages = files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
      await Promise.all(refImages.map(async (f) => {
        f._previewSrc = await fetchImageDataUrl(f)
      }))
      preloadFilesForDrag(files)
      currentTask.value = { ...res.data, files }
      detailVisible.value = true
    }
  } catch (e) {
    currentTask.value = row
    detailVisible.value = true
  }
}

async function acceptInDetail() {
  if (currentTask.value) await acceptTask(currentTask.value)
  detailVisible.value = false
}

async function loadData(options = {}) {
  if (!options.silent) loading.value = true
  try {
    const res = await getTaskHallApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      taskGroup: taskGroup.value
    })
    if (res.code === 0) {
      list.value = res.data.list
      total.value = res.data.total
    }
  } catch (e) {
    console.error('[TaskHall] 加载任务大厅失败:', e)
  } finally {
    if (!options.silent) loading.value = false
  }
}

function clearSearch() {
  keyword.value = ''
  page.value = 1
  loadData()
}

watch(taskGroup, async () => {
  page.value = 1
  list.value = []
  total.value = 0
  detailVisible.value = false
  currentTask.value = null
  await loadData()
})

async function acceptTask(row) {
  try {
    await ElMessageBox.confirm(`确认接单「${row.title}」？`, '接单确认')
    acceptingId.value = row.id
    const res = await acceptTaskApi({ taskId: row.id })
    if (res.code === 0) {
      ElMessage.success('接单成功！请尽快完成')
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {
    // 取消
  } finally {
    acceptingId.value = null
  }
}

useRealtime(loadData, 3000, { shouldPause: () => detailVisible.value })
</script>

<style scoped>
.page-container { max-width: none; padding: 0 8px; }
:deep(.el-table__body tr) { height: 52px; }
.file-card {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border: 1px solid #ebeef5;
  border-radius: 8px; margin-bottom: 6px;
}
.file-card-info { flex: 1; min-width: 0; }
.file-card-name {
  display: block; font-size: 13px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-card-size { font-size: 12px; color: var(--dd-text-muted); }
.multiline-value { white-space: pre-wrap; word-break: break-word; }
</style>
