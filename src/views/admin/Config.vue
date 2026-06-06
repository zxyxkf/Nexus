<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="系统配置" name="config">
          <template #label>
            <span>系统配置 <el-tag size="small" type="info" style="margin-left:4px;">{{ configList.length }}</el-tag></span>
          </template>

          <div class="filter-bar">
            <el-radio-group v-model="filterGroup" size="small">
              <el-radio-button label="">全部</el-radio-button>
              <el-radio-button v-for="g in groups" :key="g.name" :label="g.name">
                {{ g.label }} ({{ g.count }})
              </el-radio-button>
            </el-radio-group>
            <el-button type="primary" link @click="loadConfig"><el-icon><Refresh /></el-icon></el-button>
          </div>

          <el-table :data="filteredConfigs" v-loading="configLoading" stripe style="width:100%" empty-text="暂无配置数据" :max-height="550">
            <el-table-column prop="config_key" label="配置键" width="220" show-overflow-tooltip />
            <el-table-column label="配置值" min-width="300">
              <template #default="{ row, $index }">
                <div v-if="editIndex === $index" class="edit-row">
                  <el-input v-model="editValue" :type="editValue.length > 40 ? 'textarea' : 'text'" :rows="2" @keyup.enter.ctrl="saveConfig(row, $index)" />
                  <div class="edit-actions">
                    <el-button type="primary" size="small" @click="saveConfig(row, $index)" :loading="saving">保存</el-button>
                    <el-button size="small" @click="cancelEdit">取消</el-button>
                  </div>
                </div>
                <span v-else class="config-value-text">{{ row.config_value }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="config_group" label="分组" width="80" />
            <el-table-column prop="config_desc" label="描述" width="220" show-overflow-tooltip />
            <el-table-column label="操作" width="110" fixed="right" align="center">
              <template #default="{ row, $index }">
                <el-button type="primary" link size="small" :disabled="row.editable !== 1" @click="startEdit(row, $index)">编辑</el-button>
                <el-popconfirm title="确认删除此配置项？" confirm-button-text="删除" @confirm="handleConfigDelete(row)">
                  <template #reference>
                    <el-button type="danger" link size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="设计积分项目" name="score">
          <template #label>
            <span>设计积分 <el-tag size="small" type="info" style="margin-left:4px;">{{ scoreList.length }}</el-tag></span>
          </template>

          <div class="filter-bar">
            <el-button type="primary" @click="openScoreDialog()"><el-icon><Plus /></el-icon> 新增项目</el-button>
            <el-button link @click="loadScoreItems"><el-icon><Refresh /></el-icon></el-button>
          </div>

          <el-table :data="scoreList" v-loading="scoreLoading" stripe style="width:100%" empty-text="暂无积分项目" :max-height="550">
            <el-table-column prop="name" label="项目名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="score" label="分值" width="100" align="center" sortable />
            <el-table-column prop="score_desc" label="备注" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="120" fixed="right" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openScoreDialog(row)">编辑</el-button>
                <el-popconfirm title="确认删除此积分项目？已有任务不会受影响。" confirm-button-text="删除" @confirm="handleScoreDelete(row)">
                  <template #reference>
                    <el-button type="danger" link size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="客服积分项目" name="scoreCs">
          <template #label>
            <span>客服积分 <el-tag size="small" type="info" style="margin-left:4px;">{{ scoreCsList.length }}</el-tag></span>
          </template>

          <div class="filter-bar">
            <el-button type="primary" @click="openScoreCsDialog()"><el-icon><Plus /></el-icon> 新增项目</el-button>
            <el-button link @click="loadScoreCsItems"><el-icon><Refresh /></el-icon></el-button>
          </div>

          <el-table :data="scoreCsList" v-loading="scoreCsLoading" stripe style="width:100%" empty-text="暂无积分项目" :max-height="550">
            <el-table-column prop="name" label="项目名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="score" label="分值" width="100" align="center" sortable />
            <el-table-column prop="score_desc" label="备注" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="120" fixed="right" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openScoreCsDialog(row)">编辑</el-button>
                <el-popconfirm title="确认删除此积分项目？已有任务不会受影响。" confirm-button-text="删除" @confirm="handleScoreCsDelete(row)">
                  <template #reference>
                    <el-button type="danger" link size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="公告管理" name="announce">
          <template #label>
            <span>公告管理 <el-tag size="small" type="info" style="margin-left:4px;">{{ announceList.length }}</el-tag></span>
          </template>

          <div class="filter-bar">
            <el-button type="primary" @click="openAnnounceDialog()"><el-icon><Plus /></el-icon> 新建公告</el-button>
            <el-button link @click="loadAnnouncements"><el-icon><Refresh /></el-icon></el-button>
          </div>

          <el-table :data="announceList" v-loading="announceLoading" stripe style="width:100%" empty-text="暂无公告" :max-height="550">
            <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
            <el-table-column prop="content" label="内容" min-width="280" show-overflow-tooltip />
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.is_active === 1 ? 'success' : 'info'" size="small">{{ row.is_active === 1 ? '发布中' : '草稿' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="creator_name" label="创建者" width="100" align="center" />
            <el-table-column prop="create_time" label="创建时间" width="160" align="center" />
            <el-table-column label="操作" width="200" fixed="right" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openAnnounceDialog(row)">编辑</el-button>
                <el-button v-if="row.is_active !== 1" type="success" link size="small" @click="toggleAnnounceActive(row, true)">发布</el-button>
                <el-button v-else type="warning" link size="small" @click="toggleAnnounceActive(row, false)">下线</el-button>
                <el-popconfirm title="确认删除此公告？" confirm-button-text="删除" @confirm="handleAnnounceDelete(row)">
                  <template #reference>
                    <el-button type="danger" link size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="店铺管理" name="shop">
          <template #label>
            <span>店铺管理 <el-tag size="small" type="info" style="margin-left:4px;">{{ shopList.length }}</el-tag></span>
          </template>

          <div class="filter-bar">
            <el-button type="primary" @click="openShopDialog()"><el-icon><Plus /></el-icon> 新建店铺</el-button>
            <el-button link @click="loadShops"><el-icon><Refresh /></el-icon></el-button>
          </div>

          <el-table :data="shopList" v-loading="shopLoading" stripe style="width:100%" empty-text="暂无店铺" :max-height="550">
            <el-table-column type="index" label="#" width="50" align="center" />
            <el-table-column prop="name" label="店铺名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="create_time" label="创建时间" width="160" align="center" />
            <el-table-column label="操作" width="150" fixed="right" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openShopDialog(row)">编辑</el-button>
                <el-popconfirm title="确认删除此店铺？" confirm-button-text="删除" @confirm="handleShopDelete(row)">
                  <template #reference>
                    <el-button type="danger" link size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="运营积分项目" name="scoreOp">
          <template #label>
            <span>运营积分 <el-tag size="small" type="info" style="margin-left:4px;">{{ scoreOpList.length }}</el-tag></span>
          </template>

          <div class="filter-bar">
            <el-button type="primary" @click="openScoreOpDialog()"><el-icon><Plus /></el-icon> 新增项目</el-button>
            <el-button link @click="loadScoreOpItems"><el-icon><Refresh /></el-icon></el-button>
          </div>

          <el-table :data="scoreOpList" v-loading="scoreOpLoading" stripe style="width:100%" empty-text="暂无积分项目" :max-height="550">
            <el-table-column prop="name" label="项目名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="score" label="分值" width="100" align="center" sortable />
            <el-table-column prop="score_desc" label="备注" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="120" fixed="right" align="center">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openScoreOpDialog(row)">编辑</el-button>
                <el-popconfirm title="确认删除此积分项目？已有任务不会受影响。" confirm-button-text="删除" @confirm="handleScoreOpDelete(row)">
                  <template #reference>
                    <el-button type="danger" link size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 设计积分项目弹窗 -->
    <el-dialog v-model="scoreDialogVisible" :title="scoreForm.id ? '编辑积分项目' : '新增积分项目'" width="460px" :close-on-click-modal="false">
      <el-form ref="scoreFormRef" :model="scoreForm" :rules="scoreRules" label-width="80px">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="scoreForm.name" placeholder="如：主图、SKU AI图" maxlength="100" />
        </el-form-item>
        <el-form-item label="分值" prop="score">
          <el-input-number v-model="scoreForm.score" :min="0" :max="100" :precision="1" style="width:100%;" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="scoreForm.score_desc" placeholder="选填" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scoreDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleScoreSave" :loading="scoreSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 公告弹窗 -->
    <el-dialog v-model="announceDialogVisible" :title="announceForm.id ? '编辑公告' : '新建公告'" width="520px" :close-on-click-modal="false">
      <el-form ref="announceFormRef" :model="announceForm" :rules="announceRules" label-width="70px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="announceForm.title" placeholder="如：系统维护通知" maxlength="100" />
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input v-model="announceForm.content" type="textarea" :rows="4" placeholder="公告正文内容" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="发布">
          <el-switch v-model="announceForm.isActive" active-text="立即发布" inactive-text="存为草稿" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="announceDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAnnounceSave" :loading="announceSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 店铺管理弹窗 -->
    <el-dialog v-model="shopDialogVisible" :title="shopForm.id ? '编辑店铺' : '新建店铺'" width="420px" :close-on-click-modal="false">
      <el-form ref="shopFormRef" :model="shopForm" :rules="shopRules" label-width="80px">
        <el-form-item label="店铺名称" prop="name">
          <el-input v-model="shopForm.name" placeholder="请输入店铺名称" maxlength="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shopDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleShopSave" :loading="shopSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 运营积分项目弹窗 -->
    <el-dialog v-model="scoreOpDialogVisible" :title="scoreOpForm.id ? '编辑运营积分项目' : '新增运营积分项目'" width="460px" :close-on-click-modal="false">
      <el-form ref="scoreOpFormRef" :model="scoreOpForm" :rules="scoreRules" label-width="80px">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="scoreOpForm.name" placeholder="如：补单表格整理" maxlength="100" />
        </el-form-item>
        <el-form-item label="分值" prop="score">
          <el-input-number v-model="scoreOpForm.score" :min="0" :max="100" :precision="1" style="width:100%;" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="scoreOpForm.score_desc" placeholder="选填" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scoreOpDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleScoreOpSave" :loading="scoreOpSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 客服积分项目弹窗 -->
    <el-dialog v-model="scoreCsDialogVisible" :title="scoreCsForm.id ? '编辑客服积分项目' : '新增客服积分项目'" width="460px" :close-on-click-modal="false">
      <el-form ref="scoreCsFormRef" :model="scoreCsForm" :rules="scoreRules" label-width="80px">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="scoreCsForm.name" placeholder="如：客服咨询回复" maxlength="100" />
        </el-form-item>
        <el-form-item label="分值" prop="score">
          <el-input-number v-model="scoreCsForm.score" :min="0" :max="100" :precision="1" style="width:100%;" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="scoreCsForm.score_desc" placeholder="选填" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scoreCsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleScoreCsSave" :loading="scoreCsSaving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Plus } from '@element-plus/icons-vue'
import { getConfigListApi, updateConfigApi, deleteConfigApi, getScoreItemsApi, saveScoreItemApi, deleteScoreItemApi, getAnnouncementListApi, createAnnouncementApi, updateAnnouncementApi, deleteAnnouncementApi, getShopListApi, createShopApi, updateShopApi, deleteShopApi } from '@/api'

// ===== 系统配置 =====
const configLoading = ref(false)
const configList = ref([])
const editIndex = ref(-1)
const editValue = ref('')
const saving = ref(false)
const filterGroup = ref('')

const groups = computed(() => {
  const map = {}
  for (const item of configList.value) {
    const g = item.config_group || 'system'
    map[g] = (map[g] || 0) + 1
  }
  return Object.entries(map).map(([name, count]) => ({ name, label: name, count }))
})

const filteredConfigs = computed(() => {
  if (!filterGroup.value) return configList.value
  return configList.value.filter(item => (item.config_group || 'system') === filterGroup.value)
})

async function loadConfig() {
  configLoading.value = true
  try {
    const res = await getConfigListApi()
    if (res.code === 0) configList.value = res.data
  } finally { configLoading.value = false }
}

function startEdit(row, index) {
  if (row.editable !== 1) return
  editIndex.value = index
  editValue.value = row.config_value
}

function cancelEdit() {
  editIndex.value = -1
  editValue.value = ''
}

async function saveConfig(row, index) {
  const val = editValue.value.trim()
  if (!val) { ElMessage.warning('配置值不能为空'); return }
  saving.value = true
  try {
    await ElMessageBox.confirm(`确认修改「${row.config_key}」\n${row.config_value} → ${val}`, '确认修改', { type: 'warning' })
    const res = await updateConfigApi({ id: row.id, configValue: val })
    if (res.code === 0) {
      ElMessage.success('已更新')
      configList.value[index].config_value = val
      cancelEdit()
    } else { ElMessage.error(res.msg) }
  } catch {} finally { saving.value = false }
}

async function handleConfigDelete(row) {
  try {
    const res = await deleteConfigApi({ id: row.id })
    if (res.code === 0) {
      ElMessage.success('已删除')
      await loadConfig()
    } else {
      ElMessage.error(res.msg)
    }
  } catch (e) {
    console.error('[Config] 删除配置失败:', e)
  }
}

// ===== 设计积分项目 =====
const scoreLoading = ref(false)
const scoreList = ref([])
const scoreDialogVisible = ref(false)
const scoreFormRef = ref(null)
const scoreSaving = ref(false)
const scoreForm = ref({ id: null, name: '', score: 0, score_desc: '' })

// ===== 运营积分项目 =====
const scoreOpLoading = ref(false)
const scoreOpList = ref([])
const scoreOpDialogVisible = ref(false)
const scoreOpFormRef = ref(null)
const scoreOpSaving = ref(false)
const scoreOpForm = ref({ id: null, name: '', score: 0, score_desc: '' })

const scoreRules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  score: [{ required: true, message: '请输入分值', trigger: 'blur' }]
}

// ===== 设计积分 CRUD =====
async function loadScoreItems() {
  scoreLoading.value = true
  try {
    const res = await getScoreItemsApi({ taskGroup: 'design' })
    if (res.code === 0) scoreList.value = res.data || []
  } catch (e) {
    console.error('[Config] 加载设计积分失败:', e)
  } finally { scoreLoading.value = false }
}

function openScoreDialog(row) {
  if (row) {
    scoreForm.value = { id: row.id, name: row.name, score: row.score, score_desc: row.score_desc || '' }
  } else {
    scoreForm.value = { id: null, name: '', score: 0, score_desc: '' }
  }
  scoreDialogVisible.value = true
}

async function handleScoreSave() {
  const valid = await scoreFormRef.value?.validate().catch(() => false)
  if (!valid) return
  scoreSaving.value = true
  try {
    const res = await saveScoreItemApi({
      id: scoreForm.value.id,
      name: scoreForm.value.name,
      score: scoreForm.value.score,
      scoreDesc: scoreForm.value.score_desc,
      taskGroup: 'design'
    })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      scoreDialogVisible.value = false
      await loadScoreItems()
    } else {
      ElMessage.error(res.msg)
    }
  } catch (e) {
    console.error('[Config] 保存设计积分失败:', e)
  } finally { scoreSaving.value = false }
}

async function handleScoreDelete(row) {
  try {
    const res = await deleteScoreItemApi({ id: row.id, taskGroup: 'design' })
    if (res.code === 0) {
      ElMessage.success('已删除')
      await loadScoreItems()
    } else {
      ElMessage.error(res.msg)
    }
  } catch (e) {
    console.error('[Config] 删除设计积分失败:', e)
  }
}

// ===== 运营积分 CRUD =====
async function loadScoreOpItems() {
  scoreOpLoading.value = true
  try {
    const res = await getScoreItemsApi({ taskGroup: 'operator' })
    if (res.code === 0) scoreOpList.value = res.data || []
  } catch (e) {
    console.error('[Config] 加载运营积分失败:', e)
  } finally { scoreOpLoading.value = false }
}

function openScoreOpDialog(row) {
  if (row) {
    scoreOpForm.value = { id: row.id, name: row.name, score: row.score, score_desc: row.score_desc || '' }
  } else {
    scoreOpForm.value = { id: null, name: '', score: 0, score_desc: '' }
  }
  scoreOpDialogVisible.value = true
}

async function handleScoreOpSave() {
  const valid = await scoreOpFormRef.value?.validate().catch(() => false)
  if (!valid) return
  scoreOpSaving.value = true
  try {
    const res = await saveScoreItemApi({
      id: scoreOpForm.value.id,
      name: scoreOpForm.value.name,
      score: scoreOpForm.value.score,
      scoreDesc: scoreOpForm.value.score_desc,
      taskGroup: 'operator'
    })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      scoreOpDialogVisible.value = false
      await loadScoreOpItems()
    } else {
      ElMessage.error(res.msg)
    }
  } catch (e) {
    console.error('[Config] 保存运营积分失败:', e)
  } finally { scoreOpSaving.value = false }
}

async function handleScoreOpDelete(row) {
  try {
    const res = await deleteScoreItemApi({ id: row.id, taskGroup: 'operator' })
    if (res.code === 0) {
      ElMessage.success('已删除')
      await loadScoreOpItems()
    } else {
      ElMessage.error(res.msg)
    }
  } catch (e) {
    console.error('[Config] 删除运营积分失败:', e)
  }
}

// ===== 客服积分 CRUD =====
const scoreCsLoading = ref(false)
const scoreCsList = ref([])
const scoreCsDialogVisible = ref(false)
const scoreCsFormRef = ref(null)
const scoreCsSaving = ref(false)
const scoreCsForm = ref({ id: null, name: '', score: 0, score_desc: '' })

async function loadScoreCsItems() {
  scoreCsLoading.value = true
  try {
    const res = await getScoreItemsApi({ taskGroup: 'cs' })
    if (res.code === 0) scoreCsList.value = res.data || []
  } catch (e) {
    console.error('[Config] 加载客服积分失败:', e)
  } finally { scoreCsLoading.value = false }
}

function openScoreCsDialog(row) {
  if (row) {
    scoreCsForm.value = { id: row.id, name: row.name, score: row.score, score_desc: row.score_desc || '' }
  } else {
    scoreCsForm.value = { id: null, name: '', score: 0, score_desc: '' }
  }
  scoreCsDialogVisible.value = true
}

async function handleScoreCsSave() {
  const valid = await scoreCsFormRef.value?.validate().catch(() => false)
  if (!valid) return
  scoreCsSaving.value = true
  try {
    const res = await saveScoreItemApi({
      id: scoreCsForm.value.id,
      name: scoreCsForm.value.name,
      score: scoreCsForm.value.score,
      scoreDesc: scoreCsForm.value.score_desc,
      taskGroup: 'cs'
    })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      scoreCsDialogVisible.value = false
      await loadScoreCsItems()
    } else {
      ElMessage.error(res.msg)
    }
  } catch (e) {
    console.error('[Config] 保存客服积分失败:', e)
  } finally { scoreCsSaving.value = false }
}

async function handleScoreCsDelete(row) {
  try {
    const res = await deleteScoreItemApi({ id: row.id, taskGroup: 'cs' })
    if (res.code === 0) {
      ElMessage.success('已删除')
      await loadScoreCsItems()
    } else {
      ElMessage.error(res.msg)
    }
  } catch (e) {
    console.error('[Config] 删除客服积分失败:', e)
  }
}

// ===== 公告管理 CRUD =====
const announceLoading = ref(false)
const announceList = ref([])
const announceDialogVisible = ref(false)
const announceFormRef = ref(null)
const announceSaving = ref(false)
const announceForm = ref({ id: null, title: '', content: '', isActive: false })

const announceRules = {
  title: [{ required: true, message: '请输入公告标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入公告内容', trigger: 'blur' }]
}

async function loadAnnouncements() {
  announceLoading.value = true
  try {
    const res = await getAnnouncementListApi()
    if (res.code === 0) announceList.value = res.data || []
  } catch (e) {
    console.error('[Config] 加载公告失败:', e)
  } finally { announceLoading.value = false }
}

function openAnnounceDialog(row) {
  if (row) {
    announceForm.value = { id: row.id, title: row.title, content: row.content, isActive: row.is_active === 1 }
  } else {
    announceForm.value = { id: null, title: '', content: '', isActive: false }
  }
  announceDialogVisible.value = true
}

async function handleAnnounceSave() {
  const valid = await announceFormRef.value?.validate().catch(() => false)
  if (!valid) return
  announceSaving.value = true
  try {
    const data = { title: announceForm.value.title, content: announceForm.value.content, isActive: announceForm.value.isActive }
    const api = announceForm.value.id
      ? updateAnnouncementApi({ id: announceForm.value.id, ...data })
      : createAnnouncementApi(data)
    const res = await api
    if (res.code === 0) {
      ElMessage.success(res.msg)
      announceDialogVisible.value = false
      await loadAnnouncements()
    } else { ElMessage.error(res.msg) }
  } catch (e) {
    console.error('[Config] 保存公告失败:', e)
  } finally { announceSaving.value = false }
}

async function toggleAnnounceActive(row, active) {
  try {
    const res = await updateAnnouncementApi({ id: row.id, title: row.title, content: row.content, isActive: active })
    if (res.code === 0) {
      ElMessage.success(active ? '已发布' : '已下线')
      await loadAnnouncements()
    } else { ElMessage.error(res.msg) }
  } catch (e) {
    console.error('[Config] 切换公告状态失败:', e)
  }
}

async function handleAnnounceDelete(row) {
  try {
    const res = await deleteAnnouncementApi(row.id)
    if (res.code === 0) {
      ElMessage.success('已删除')
      await loadAnnouncements()
    } else { ElMessage.error(res.msg) }
  } catch (e) {
    console.error('[Config] 删除公告失败:', e)
  }
}

// ===== 店铺管理 =====
const shopLoading = ref(false)
const shopList = ref([])
const shopDialogVisible = ref(false)
const shopFormRef = ref(null)
const shopSaving = ref(false)
const shopForm = ref({ id: null, name: '' })
const shopRules = {
  name: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }]
}

async function loadShops() {
  shopLoading.value = true
  try {
    const res = await getShopListApi()
    if (res.code === 0) shopList.value = res.data || []
  } catch (e) {
    console.error('[Config] 加载店铺失败:', e)
  } finally { shopLoading.value = false }
}

function openShopDialog(row) {
  if (row) {
    shopForm.value = { id: row.id, name: row.name }
  } else {
    shopForm.value = { id: null, name: '' }
  }
  shopDialogVisible.value = true
}

async function handleShopSave() {
  const valid = await shopFormRef.value?.validate().catch(() => false)
  if (!valid) return
  shopSaving.value = true
  try {
    const api = shopForm.value.id
      ? updateShopApi({ id: shopForm.value.id, name: shopForm.value.name })
      : createShopApi({ name: shopForm.value.name })
    const res = await api
    if (res.code === 0) {
      ElMessage.success(res.msg)
      shopDialogVisible.value = false
      await loadShops()
    } else { ElMessage.error(res.msg) }
  } catch (e) {
    console.error('[Config] 保存店铺失败:', e)
  } finally { shopSaving.value = false }
}

async function handleShopDelete(row) {
  try {
    const res = await deleteShopApi(row.id)
    if (res.code === 0) {
      ElMessage.success('已删除')
      await loadShops()
    } else { ElMessage.error(res.msg) }
  } catch (e) {
    console.error('[Config] 删除店铺失败:', e)
  }
}

// ===== 生命周期 =====
const activeTab = ref('config')
function onTabChange(tab) {
  if (tab === 'score' && scoreList.value.length === 0) loadScoreItems()
  if (tab === 'scoreCs' && scoreCsList.value.length === 0) loadScoreCsItems()
  if (tab === 'scoreOp' && scoreOpList.value.length === 0) loadScoreOpItems()
  if (tab === 'announce' && announceList.value.length === 0) loadAnnouncements()
  if (tab === 'shop' && shopList.value.length === 0) loadShops()
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.config-value-text { font-family: var(--dd-font-mono); font-size: 13px; color: var(--dd-text-primary); word-break: break-all; }
.edit-row { display: flex; flex-direction: column; gap: 6px; }
.edit-actions { display: flex; gap: 6px; }
</style>
