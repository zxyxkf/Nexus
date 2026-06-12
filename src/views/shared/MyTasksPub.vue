<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">我的任务</span>
          <div class="header-right">
            <el-input
              v-model="searchKeyword"
              :placeholder="isCsAgent ? '搜索旺旺ID/款号' : '搜索款号'"
              clearable
              style="width:180px;"
              @clear="handleFilterChange"
              @keyup.enter="handleFilterChange"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-input
              v-if="isCsAgent"
              v-model="taskNoFilter"
              placeholder="任务编号筛选"
              clearable
              style="width:150px;"
              @clear="handleFilterChange"
              @keyup.enter="handleFilterChange"
            >
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-select
              v-if="isCsAgent"
              v-model="designerFilter"
              placeholder="筛选基础美工"
              clearable
              style="width:150px;"
              @change="handleFilterChange"
            >
              <el-option label="全部" value="" />
              <el-option v-for="d in basicDesignerList" :key="d.id" :label="d.real_name || d.username" :value="String(d.id)" />
            </el-select>
            <el-select
              v-if="!isCsAgent"
              v-model="operatorDesignerFilter"
              placeholder="筛选美工"
              clearable
              style="width:150px;"
              @change="handleFilterChange"
            >
              <el-option label="全部" value="" />
              <el-option v-for="d in operatorDesignerList" :key="d.id" :label="d.real_name || d.username" :value="String(d.id)" />
            </el-select>
            <el-select
              v-if="!isCsAgent"
              v-model="publisherFilter"
              placeholder="筛选发布人"
              clearable
              style="width:150px;"
              @change="handleFilterChange"
            >
              <el-option label="全部" value="" />
              <el-option v-for="p in publisherList" :key="p.id" :label="p.real_name || p.username" :value="String(p.id)" />
            </el-select>
            <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width:130px;" @change="handleFilterChange">
              <el-option label="全部" value="" />
              <el-option label="待接单" value="wait" />
              <el-option label="已接单" value="accepted" />
              <el-option label="作图中" value="doing" />
              <el-option label="已完成" value="finished" />
              <el-option label="已驳回" value="rejected" />
              <el-option label="草稿" value="draft" />
            </el-select>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              clearable
              style="width:240px;"
              @change="handleFilterChange"
            />
          </div>
        </div>
      </template>

      <el-table :data="list" v-loading="loading" stripe style="width:100%" empty-text="暂无任务数据" highlight-current-row>
        <el-table-column prop="task_no" label="任务编号" width="95" align="center" sortable />
        <el-table-column prop="publisher_name" label="发布人" width="100" align="center" show-overflow-tooltip />
        <el-table-column prop="title" label="工作项目" min-width="100" align="center" show-overflow-tooltip />
        <el-table-column label="分值" width="120" align="center">
          <template #default="{ row }">{{ row.score || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="130" prop="status" align="center" sortable>
          <template #default="{ row }">
            <div class="status-cell">
              <el-tag :type="statusType(row.status)" size="small" effect="plain">
                {{ statusLabel(row.status) }}
              </el-tag>
              <div class="task-progress-bar">
                <div class="task-progress-fill" :style="{ width: progressWidth(row.status) }"></div>
              </div>
            </div>
          </template>
        </el-table-column>
        <template v-if="isCsAgent">
          <el-table-column label="旺旺ID" width="100" align="center" show-overflow-tooltip>
            <template #default="{ row }">{{ row.wangwang_id || row.ref_path || '-' }}</template>
          </el-table-column>
        </template>
        <el-table-column label="款号" width="140" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ row.style_number || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="!isCsAgent" label="指定颜色" width="140" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ row.specified_color || '-' }}</template>
        </el-table-column>
        <el-table-column prop="designer_name" :label="designerLabel" width="105" align="center" />
        <el-table-column label="参考图" width="160" align="center">
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
        <el-table-column label="作品预览" width="200" align="center">
          <template #default="{ row }">
            <div
              v-if="getFirstImage(row.files)"
              draggable="true"
              @dragstart="setupFileDrag($event, getFirstImage(row.files))"
              style="display:inline-block;"
            >
              <el-image
                :src="getFileUrl(getFirstImage(row.files))"
                fit="cover"
                :preview-src-list="getImageSrcList(row.files)"
                :initial-index="0"
                preview-teleported
                style="width:48px;height:48px;border-radius:6px;cursor:pointer;border:1px solid #e4e7ed;"
              />
            </div>
            <el-tooltip
              v-else-if="getWorkFiles(row.files).length"
              :content="getWorkFiles(row.files).map(f => f.file_name).join('\n')"
              placement="top"
            >
              <div class="file-badge" @click="viewDetail(row)" draggable="true" @dragstart="setupFileDrag($event, getWorkFiles(row.files)[0])" @mouseenter="preloadFilesForDrag(getWorkFiles(row.files))">
                <el-icon :size="18"><Document /></el-icon>
                <span>{{ getWorkFiles(row.files).length }}个附件</span>
              </div>
            </el-tooltip>
            <span v-else style="color:#c0c4cc;font-size:12px;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="发布时间" width="170" align="center" sortable show-overflow-tooltip>
          <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="(row.status === 'wait' || row.status === 'accepted')" type="warning" link size="small" @click="handleWithdraw(row)">撤回</el-button>
            <el-button v-if="row.status === 'draft'" type="success" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button v-if="isCsAgent && row.status === 'finished'" type="danger" link size="small" @click="openReopenDialog(row)">重开</el-button>
            <el-button v-if="canUpdateCsTaskNo && row.status === 'finished'" type="primary" link size="small" @click="openTaskNoDialog(row)">改编号</el-button>
            <el-button v-if="row.designer_id && row.status === 'accepted'" type="warning" link size="small" @click="urgeTask(row)">催促</el-button>
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
              <span v-if="isCsAgent" class="detail-number">#{{ currentTask.task_no }}</span>
              <span v-else class="detail-project-title" :title="currentTask.title || '-'">{{ currentTask.title || '-' }}</span>
              <el-tag :type="statusType(currentTask.status)" size="small">{{ statusLabel(currentTask.status) }}</el-tag>
              <span class="detail-header-time">{{ formatTaskHeaderTime(currentTask) }}</span>
            </div>
            <div class="detail-header-right">
              <el-button v-if="(currentTask.status === 'wait' || currentTask.status === 'accepted')" type="warning" size="small" @click="handleWithdraw(currentTask)">撤回</el-button>
              <el-button v-if="currentTask.status === 'draft'" type="success" size="small" @click="openEditDialog(currentTask)">编辑</el-button>
              <el-button v-if="isCsAgent && currentTask.status === 'finished'" type="danger" size="small" @click="openReopenDialog(currentTask)">重开</el-button>
              <el-button v-if="canUpdateCsTaskNo && currentTask.status === 'finished'" type="primary" size="small" @click="openTaskNoDialog(currentTask)">改编号</el-button>
              <el-button v-if="currentTask.designer_id && currentTask.status === 'accepted'" type="warning" size="small" @click="urgeTask(currentTask)">催促</el-button>
              <el-button circle @click="detailVisible = false"><el-icon><Close /></el-icon></el-button>
            </div>
          </div>

          <div class="inline-detail-body">
            <TaskStatusTimeline :task="currentTask" :task-group="taskGroup" />
            <TaskTransferTimeline v-if="isCsAgent" :records="currentTask.transfer_records || []" />
            <div class="inline-detail-people">
              <div class="inline-detail-stat-card">
                <label>发布人</label>
                <span>{{ currentTask.publisher_name || '我' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>{{ designerLabel }}</label>
                <span>{{ currentTask.designer_name || '未接单' }}</span>
              </div>
            </div>

            <div class="inline-detail-section">
              <div class="inline-detail-section-title">任务信息</div>
              <div class="inline-detail-stat-card">
                <label>工作项目</label>
                <span>{{ currentTask.title }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>分值</label>
                <span>{{ currentTask.score || '-' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>款号</label>
                <span>{{ currentTask.style_number || '无' }}</span>
              </div>
              <template v-if="isCsAgent">
                <div class="inline-detail-stat-card">
                  <label>旺旺ID</label>
                  <span>{{ currentTask.wangwang_id || currentTask.ref_path || '无' }}</span>
                </div>
              </template>
              <template v-else>
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
                <label>任务描述</label>
                <div class="value" style="white-space:pre-wrap;">{{ currentTask.description || '暂无' }}</div>
              </div>
            </div>

            <div class="inline-detail-section">
              <div class="inline-detail-section-title">提交与审核</div>
              <template v-if="isCsAgent">
                <div class="inline-detail-stat-card">
                  <label>申请分数</label>
                  <span>{{ formatScoreValue(currentTask.applied_score) }}</span>
                </div>
                <div class="inline-detail-stat-card">
                  <label>分数审核状态</label>
                  <el-tag :type="scoreReviewTagType(currentTask.score_review_status)" size="small">
                    {{ formatScoreReviewStatus(currentTask.score_review_status, currentTask) }}
                  </el-tag>
                </div>
                <div class="inline-detail-stat-card">
                  <label>分数审核通过分数</label>
                  <span>{{ formatScoreReviewApprovedScore(currentTask) }}</span>
                </div>
              </template>
              <div v-else class="inline-detail-stat-card full-width">
                <label>上传路径</label>
                <span>{{ currentTask.work_path || '无' }}</span>
              </div>
              <div v-if="currentTask.status === 'rejected'" class="inline-detail-stat-card full-width">
                <label>驳回原因</label>
                <div class="value" style="color:#e63946;">{{ currentTask.reject_reason }}</div>
              </div>
              <div v-if="isCsAgent && currentTask.score_review_reason" class="inline-detail-stat-card full-width">
                <label>分数审核驳回原因</label>
                <div class="value" style="color:#e63946;white-space:pre-wrap;">{{ currentTask.score_review_reason }}</div>
              </div>
            </div>

            <template v-if="detailRefImages.length">
              <div class="inline-detail-files">
                <h4>参考图 ({{ detailRefImages.length }})</h4>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  <div v-for="(file, index) in detailRefImages" :key="file.id" style="position:relative;" draggable="true" @dragstart="setupFileDrag($event, file)">
                    <el-image
                      :src="file._previewSrc || getFileUrl(file)"
                      fit="contain"
                      :preview-src-list="detailRefPreviewList"
                      :initial-index="index"
                      preview-teleported
                      style="width:120px;height:120px;border-radius:8px;border:1px solid #e4e7ed;"
                    />
                    <el-button class="file-download-btn" type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
                  </div>
                </div>
              </div>
            </template>

            <div v-if="detailRefAttachments.length" class="inline-detail-files">
              <h4>参考附件 ({{ detailRefAttachments.length }})</h4>
              <div v-for="file in detailRefAttachments" :key="file.id" class="attachment-item" draggable="true" @dragstart="setupFileDrag($event, file)">
                <el-icon :size="28" color="#909399"><Document /></el-icon>
                <div class="file-card-info">
                  <span class="file-name">{{ file.file_name }}</span>
                  <span class="file-size">{{ formatSize(file.file_size) }}</span>
                </div>
                <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
              </div>
            </div>

            <div v-if="workFiles.length" class="inline-detail-files">
              <h4>作品文件</h4>
              <div class="file-grid">
                <div v-for="file in workFiles" :key="file.id" class="file-item" draggable="true" @dragstart="setupFileDrag($event, file)">
                  <template v-if="file.file_type === 'image'">
                    <el-image
                      :src="file._previewSrc || getFileUrl(file)"
                      fit="cover"
                      :preview-src-list="imagePreviewList"
                      :initial-index="getImagePreviewIndex(workFiles, file)"
                      preview-teleported
                      style="width:120px;height:120px;border-radius:8px;"
                    />
                    <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
                  </template>
                  <div v-else class="attachment-item">
                    <el-icon :size="28" color="#909399"><Document /></el-icon>
                    <div class="file-card-info">
                      <span class="file-name">{{ file.file_name }}</span>
                      <span class="file-size">{{ formatSize(file.file_size) }}</span>
                    </div>
                    <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
                  </div>
                </div>
              </div>
            </div>
            <RejectHistory v-if="isCsAgent" :records="currentTask.reject_records || []" />
          </div>
        </div>
      </transition>
    </el-card>

    <!-- 编辑草稿任务对话框 -->
    <el-dialog v-model="editVisible" :title="editMode === 'reopen' ? '重开任务' : '编辑任务'" width="600px" :close-on-click-modal="false" top="5vh">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="80px">
        <el-form-item label="工作项目" prop="scoreItemId">
          <el-select v-model="editForm.scoreItemId" placeholder="请选择工作项目" filterable @change="onEditScoreItemChange" style="width:100%;">
            <el-option v-for="item in scoreItems" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="分值">
          <el-input :model-value="editForm.score" disabled />
        </el-form-item>

        <template v-if="isCsAgent">
          <el-form-item label="旺旺ID">
            <el-input v-model="editForm.wangwangId" />
          </el-form-item>
        </template>

        <el-form-item label="款号">
          <el-input v-model="editForm.styleNumber" placeholder="款号（可选）" />
        </el-form-item>
        <el-form-item v-if="!isCsAgent" label="指定颜色">
          <el-input v-model="editForm.specifiedColor" placeholder="指定颜色（可选）" />
        </el-form-item>

        <template v-if="!isCsAgent">
          <el-form-item label="参考路径">
            <el-input v-model="editForm.refPath" type="textarea" :rows="3" placeholder="参考文件路径或链接（可选）" />
          </el-form-item>
          <el-form-item label="截止时间">
            <el-date-picker v-model="editForm.deadline" type="datetime" placeholder="选择截止时间（可选）" format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%;" />
          </el-form-item>
        </template>

        <el-form-item label="任务描述" prop="description">
          <el-input v-model="editForm.description" type="textarea" :rows="5" maxlength="2000" show-word-limit placeholder="请详细描述作图需求" />
        </el-form-item>

        <el-form-item label="参考图">
          <el-upload
            ref="editUploadRef"
            v-model:file-list="editRefImages"
            list-type="picture-card"
            multiple
            :limit="10"
            accept="image/*"
            :auto-upload="false"
            @change="onEditRefFileChange"
          >
            <el-icon :size="28"><Plus /></el-icon>
          </el-upload>
          <p class="form-hint">{{ isCsAgent ? '新上传的参考图会追加保留，支持截图粘贴' : '重新上传后会替换原有参考图，支持截图粘贴' }}</p>
        </el-form-item>

        <el-form-item label="指派美工">
          <el-select v-model="editForm.designerId" placeholder="可选，留空则进入任务大厅" clearable filterable style="width:100%;">
            <el-option v-for="d in designerList" :key="d.id" :label="d.real_name || d.username" :value="d.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEditSave" :loading="editSaving">{{ editMode === 'reopen' ? '保存并重开' : '保存并重新发布' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, Document, Search, Plus } from '@element-plus/icons-vue'
import { getMyPublishedApi, urgeTaskApi, getFileUrl, saveFileToDisk, withdrawTaskApi, updateTaskApi, reopenFinishedCsTaskApi, updateCsTaskNoApi, uploadFilesApi, setupFileDrag, preloadFilesForDrag } from '@/api'
import { getScoreItemsApi } from '@/api'
import { getBasicDesignerListApi, getDesignerListApi, getOperatorAssistantListApi, getPublisherListApi } from '@/api'
import { STATUS_MAP, STATUS_TAG_TYPE, formatDate, formatFileSize, formatScoreReviewApprovedScore, formatScoreReviewStatus, formatScoreValue, formatTaskHeaderTime, scoreReviewTagType } from '@/utils/format'
import { useRealtime } from '@/composables/useRealtime'
import { useFileHelpers } from '@/composables/useFileHelpers'
import { usePersistedFilters } from '@/composables/usePersistedFilters'
import { useTaskDetail } from '@/composables/useTaskDetail'
import { hasPermission } from '@/utils/permissions'
import { appendClipboardImages, syncRawFiles } from '@/utils/clipboard-upload'
import TaskStatusTimeline from '@/components/TaskStatusTimeline.vue'
import TaskTransferTimeline from '@/components/TaskTransferTimeline.vue'
import RejectHistory from '@/components/RejectHistory.vue'

const route = useRoute()
const router = useRouter()
const taskGroup = computed(() => route.meta.taskGroup || (route.meta.role === 'cs_agent' ? 'cs' : 'design'))
const isCsAgent = computed(() => taskGroup.value === 'cs')
const isOperatorTask = computed(() => taskGroup.value === 'operator')
const canUpdateCsTaskNo = computed(() => isCsAgent.value && hasPermission('cs.task_no.update'))
const designerLabel = computed(() => isCsAgent.value ? '基础美工' : isOperatorTask.value ? '运营助理' : '美工')

const searchKeyword = computed({
  get: () => isCsAgent.value ? keywordFilter.value : styleNumberFilter.value,
  set: (v) => {
    if (isCsAgent.value) { keywordFilter.value = v } else { styleNumberFilter.value = v }
  }
})

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)
const statusFilter = ref('')
const styleNumberFilter = ref('')
const keywordFilter = ref('')
const taskNoFilter = ref('')
const designerFilter = ref('')
const operatorDesignerFilter = ref('')
const publisherFilter = ref('')
const dateRange = ref(null)
usePersistedFilters(`my_tasks_pub_${taskGroup.value}`, { statusFilter, styleNumberFilter, keywordFilter, taskNoFilter, designerFilter, operatorDesignerFilter, publisherFilter, dateRange })
const dateField = ref('')
const basicDesignerList = ref([])
const operatorDesignerList = ref([])
const publisherList = ref([])

const imagePreviewList = ref([])
const { detailVisible, currentTask, openDetail: viewDetail } = useTaskDetail({
  onLoaded: (detail) => {
    const workImageFiles = (detail.files || []).filter(file => file.file_category !== 'reference' && file.file_category !== 'reject' && file.file_type === 'image')
    imagePreviewList.value = workImageFiles.map(file => file._previewSrc || getFileUrl(file))
  },
  onError: error => console.error('[MyTasks] 加载任务详情失败:', error)
})

function statusLabel(s) { return STATUS_MAP[s] || s }
function statusType(s) { return STATUS_TAG_TYPE[s] || 'info' }

const progressSteps = { wait: '20%', accepted: '40%', doing: '60%', finished: '100%', rejected: '60%', draft: '0%' }
function progressWidth(s) { return progressSteps[s] || '0%' }

const { getRefImages, getRefAttachments, getWorkFiles, getRefImageSrcList, getFirstImage, getImageSrcList, getImagePreviewIndex } = useFileHelpers()
const detailRefImages = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
})
const detailRefPreviewList = computed(() => {
  return detailRefImages.value.map(f => f._previewSrc || getFileUrl(f))
})
const workFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference' && f.file_category !== 'reject')
})
const detailRefAttachments = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
})
function normalizeLoadOptions(options) {
  return options && typeof options === 'object' && !Array.isArray(options) ? options : {}
}

function handleFilterChange() {
  page.value = 1
  loadData()
}

async function loadData(options = {}) {
  const runOptions = normalizeLoadOptions(options)
  if (!runOptions.silent) loading.value = true
  try {
    const res = await getMyPublishedApi({
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined,
      styleNumber: isCsAgent.value ? undefined : (styleNumberFilter.value || undefined),
      keyword: isCsAgent.value ? (keywordFilter.value || undefined) : undefined,
      taskNo: isCsAgent.value ? (taskNoFilter.value || undefined) : undefined,
      designerId: isCsAgent.value ? (designerFilter.value || undefined) : (operatorDesignerFilter.value || undefined),
      publisherId: !isCsAgent.value ? (publisherFilter.value || undefined) : undefined,
      taskGroup: taskGroup.value,
      dateStart: dateRange.value?.[0] || undefined,
      dateEnd: dateRange.value?.[1] || undefined,
      dateField: dateField.value || undefined
    })
    if (res.code === 0) {
      list.value = res.data.list
      total.value = Number(res.data.total) || 0
      const openTaskId = route.query.openTask
      if (openTaskId) {
        const task = list.value.find(t => t.id == openTaskId)
        if (task) { router.replace({ query: {} }); viewDetail(task) }
      }
    }
  } catch (e) {
    console.error('[MyTasks] 加载任务列表失败:', e)
  } finally {
    if (!runOptions.silent) loading.value = false
  }
}

watch(taskGroup, async () => {
  applyDashboardQueryFilters()
  page.value = 1
  list.value = []
  total.value = 0
  detailVisible.value = false
  editVisible.value = false
  currentTask.value = null
  scoreItems.value = []
  designerList.value = []
  basicDesignerList.value = []
  operatorDesignerList.value = []
  publisherList.value = []
  if (isCsAgent.value) await loadBasicDesigners()
  if (!isCsAgent.value) { await loadPublisherList(); await loadDesignerList() }
  await loadData()
})

watch(() => route.query.openTask, (newTaskId) => {
  if (newTaskId && list.value.length > 0) {
    const task = list.value.find(t => t.id == newTaskId)
    if (task) { router.replace({ query: {} }); viewDetail(task) }
  }
})

function queryValue(key) {
  const value = route.query[key]
  return Array.isArray(value) ? value[0] : value
}

function applyDashboardQueryFilters() {
  const status = queryValue('status')
  const designerId = queryValue('designerId')
  const dateFieldQuery = queryValue('dateField')
  if (status) statusFilter.value = String(status)
  if (designerId) {
    if (isCsAgent.value) designerFilter.value = String(designerId)
    else operatorDesignerFilter.value = String(designerId)
  }
  dateField.value = ['finish', 'submit'].includes(dateFieldQuery) ? dateFieldQuery : ''
  if (route.query.dateStart || route.query.dateEnd || route.query.startDate || route.query.endDate) {
    const start = queryValue('dateStart') || queryValue('startDate') || queryValue('dateEnd') || queryValue('endDate')
    const end = queryValue('dateEnd') || queryValue('endDate') || queryValue('dateStart') || queryValue('startDate')
    dateRange.value = [String(start), String(end)]
  }
}

watch(() => [route.query.dateStart, route.query.dateEnd, route.query.startDate, route.query.endDate, route.query.status, route.query.designerId, route.query.dateField], () => {
  applyDashboardQueryFilters()
  page.value = 1
  loadData()
})

async function urgeTask(row) {
  try {
    await ElMessageBox.confirm(`确认催促${designerLabel.value}尽快完成任务「${row.title}」？`, '催促提醒')
    const res = await urgeTaskApi({ taskId: row.id, taskTitle: row.title, designerId: row.designer_id })
    if (res.code === 0) ElMessage.success(`已向${designerLabel.value}发送催促提醒`)
    else ElMessage.error(res.msg || '操作失败')
  } catch {}
}

// ===== 撤回 =====
async function handleWithdraw(row) {
  try {
    await ElMessageBox.confirm(
      `确认撤回任务「${row.title}」？${row.status === 'accepted' ? '该任务已被美工接单，撤回后将取消指派。' : ''}`,
      '确认撤回',
      { type: 'warning', confirmButtonText: '确认撤回' }
    )
    const res = await withdrawTaskApi({ taskId: row.id })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {}
}

// ===== 编辑草稿 =====
const editVisible = ref(false)
const editSaving = ref(false)
const editMode = ref('draft')
const editFormRef = ref(null)
const editUploadRef = ref(null)
const editForm = ref({ taskId: null, scoreItemId: null, score: 0, description: '', deadline: null, refPath: '', wangwangId: '', styleNumber: '', specifiedColor: '', designerId: null })
const editRefImages = ref([])
const editRefRawFiles = ref([])
const scoreItems = ref([])
const designerList = ref([])

const editRules = computed(() => ({
  scoreItemId: [{ required: true, message: '请选择工作项目', trigger: 'change' }],
  description: []
}))

function onEditRefFileChange(uploadFile, uploadFiles) {
  editRefRawFiles.value = syncRawFiles(uploadFiles)
}

function handleEditRefPaste(event) {
  if (!editVisible.value) return
  appendClipboardImages(event, editRefImages, editRefRawFiles, {
    prefix: isCsAgent.value ? 'cs-reference' : 'reference',
    maxCount: 10,
    maxSizeMB: 50
  })
}

async function loadScoreItems() {
  try {
    const res = await getScoreItemsApi({ taskGroup: taskGroup.value })
    if (res.code === 0) scoreItems.value = res.data || []
  } catch (e) {
    console.error('[MyTasksPub] 加载积分项目失败:', e)
  }
}

async function loadDesigners() {
  try {
    const api = isCsAgent.value ? getBasicDesignerListApi : isOperatorTask.value ? getOperatorAssistantListApi : getDesignerListApi
    const res = await api()
    if (res.code === 0) designerList.value = res.data || []
  } catch (e) {
    console.error('[MyTasksPub] 加载人员列表失败:', e)
  }
}

function onEditScoreItemChange(id) {
  const item = scoreItems.value.find(s => s.id === id)
  if (item) editForm.value.score = item.score
}

function openEditDialog(row) {
  editMode.value = 'draft'
  if (scoreItems.value.length === 0) loadScoreItems()
  if (designerList.value.length === 0) loadDesigners()

  editRefImages.value = []
  editRefRawFiles.value = []
  editForm.value = {
    taskId: row.id,
    scoreItemId: row.score_item_id || null,
    score: row.score || 0,
    description: row.description || '',
    deadline: row.deadline || null,
    refPath: row.ref_path || '',
    wangwangId: row.wangwang_id || row.ref_path || '',
    styleNumber: row.style_number || '',
    specifiedColor: row.specified_color || '',
    designerId: row.designer_id || null
  }
  editVisible.value = true
  editFormRef.value?.clearValidate?.()
}

async function openReopenDialog(row) {
  try {
    await ElMessageBox.confirm(
      `确认重开已完成任务「${row.title}」？保存后该任务会回到基础美工待做任务，已完成分值会扣回。`,
      '重开任务',
      { type: 'warning', confirmButtonText: '继续重开' }
    )
    editMode.value = 'reopen'
    if (scoreItems.value.length === 0) await loadScoreItems()
    if (designerList.value.length === 0) await loadDesigners()
    const scoreItem = scoreItems.value.find(item => Number(item.id) === Number(row.score_item_id))
    editRefImages.value = []
    editRefRawFiles.value = []
    editForm.value = {
      taskId: row.id,
      scoreItemId: row.score_item_id || null,
      score: scoreItem ? scoreItem.score : (row.score || 0),
      description: row.description || '',
      deadline: row.deadline || null,
      refPath: row.ref_path || '',
      wangwangId: row.wangwang_id || row.ref_path || '',
      styleNumber: row.style_number || '',
      specifiedColor: row.specified_color || '',
      designerId: row.designer_id || null
    }
    editVisible.value = true
    editFormRef.value?.clearValidate?.()
  } catch {}
}

async function openTaskNoDialog(row) {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的任务编号', '修改任务编号', {
      inputValue: row.task_no || '',
      inputPattern: /\S+/,
      inputErrorMessage: '任务编号不能为空',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    })
    const res = await updateCsTaskNoApi({ taskId: row.id, taskNo: value })
    if (res.code === 0) {
      ElMessage.success(res.msg || '任务编号已更新')
      if (currentTask.value?.id === row.id) currentTask.value.task_no = value
      await loadData()
    } else {
      ElMessage.error(res.msg || '修改失败')
    }
  } catch {}
}

async function handleEditSave() {
  const valid = await editFormRef.value?.validate().catch(() => false)
  if (!valid) return
  editSaving.value = true
  try {
    const f = editForm.value
    const payload = {
      taskId: f.taskId,
      title: scoreItems.value.find(s => s.id === f.scoreItemId)?.name || '',
      description: f.description,
      deadline: f.deadline,
      scoreItemId: f.scoreItemId,
      score: f.score,
      refPath: f.refPath,
      wangwangId: f.wangwangId,
      styleNumber: f.styleNumber,
      specifiedColor: f.specifiedColor,
      designerId: f.designerId
    }
    const res = editMode.value === 'reopen'
      ? await reopenFinishedCsTaskApi(payload)
      : await updateTaskApi(payload)
    if (res.code === 0) {
      if (editRefImages.value.length) {
        const rawFiles = editRefRawFiles.value.length
          ? editRefRawFiles.value
          : editRefImages.value.map(file => file.raw).filter(Boolean)
        if (rawFiles.length) {
          const uploadRes = await uploadFilesApi(f.taskId, rawFiles, 'reference', {
            replaceExisting: !isCsAgent.value
          })
          if (uploadRes.code !== 0) {
            ElMessage.error('参考图上传失败: ' + (uploadRes.msg || '未知错误'))
            return
          }
        }
      }
      ElMessage.success(res.msg)
      editVisible.value = false
      editRefImages.value = []
      editRefRawFiles.value = []
      loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch (e) {
    console.error('[MyTasks] 编辑任务失败:', e)
  } finally { editSaving.value = false }
}

const formatSize = formatFileSize

async function loadBasicDesigners() {
  try {
    const res = await getBasicDesignerListApi()
    if (res.code === 0) basicDesignerList.value = res.data || []
  } catch {}
}
async function loadDesignerList() {
  try {
    const res = await getDesignerListApi()
    if (res.code === 0) operatorDesignerList.value = res.data || []
  } catch {}
}
async function loadPublisherList() {
  try {
    const res = await getPublisherListApi()
    if (res.code === 0) publisherList.value = res.data || []
  } catch {}
}
applyDashboardQueryFilters()
if (isCsAgent.value) loadBasicDesigners()
if (!isCsAgent.value) { loadPublisherList(); loadDesignerList() }

onMounted(() => {
  window.addEventListener('paste', handleEditRefPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', handleEditRefPaste)
})

useRealtime(loadData, 3000, { shouldPause: () => detailVisible.value || editVisible.value })
</script>

<style scoped>
.page-container { max-width: none; padding: 0 8px; }
.file-badge {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  cursor: pointer; color: var(--dd-text-secondary); padding: 4px 0;
}
.file-badge:hover { color: var(--dd-primary); }
.file-badge span { font-size: 10px; }

.file-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.file-item { text-align: center; }
.attachment-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 8px; background: var(--dd-bg-secondary, #f5f7fa);
  border-radius: 8px; border: 1px solid var(--dd-border-light, #e4e7ed);
}
.file-card-info { text-align: center; }
.file-name { font-size: 12px; color: var(--dd-text-secondary); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 11px; color: var(--dd-text-secondary); display: block; }
.status-cell { display: flex; flex-direction: column; gap: 4px; }
.task-progress-bar { height: 3px; background: var(--dd-border-light); border-radius: 2px; overflow: hidden; }
.task-progress-fill { height: 100%; background: linear-gradient(90deg, var(--dd-primary), var(--dd-success)); border-radius: 2px; transition: width 0.5s ease; }
.multiline-value { white-space: pre-wrap; word-break: break-word; }
.file-download-btn { position: absolute; right: 4px; bottom: 4px; background: rgba(255, 255, 255, 0.9); border-radius: 4px; }
</style>
