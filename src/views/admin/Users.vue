<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">用户管理</span>
          <el-button type="primary" @click="openCreate">
            <el-icon><Plus /></el-icon>新增用户
          </el-button>
        </div>
      </template>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-input v-model="filter.keyword" placeholder="搜索用户名/姓名" clearable style="width:200px;" @clear="loadData" @keyup.enter="loadData" />
        <el-select v-model="filter.role" placeholder="角色" clearable style="width:120px;" @change="loadData">
          <el-option label="全部角色" value="" />
          <el-option label="超级管理员" value="admin" />
          <el-option label="子管理员" value="sub_admin" />
          <el-option label="运营专员" value="operator" />
          <el-option label="客服专员" value="cs_agent" />
          <el-option label="美工设计师" value="designer" />
          <el-option label="基础美工" value="basic_designer" />
          <el-option label="运营助理" value="operator_assistant" />
        </el-select>
        <el-select v-model="filter.status" placeholder="状态" clearable style="width:100px;" @change="loadData">
          <el-option label="全部状态" value="" />
          <el-option label="已启用" value="1" />
          <el-option label="已禁用" value="0" />
        </el-select>
        <el-button @click="loadData" type="primary">查询</el-button>
      </div>

      <el-table :data="list" v-loading="loading" stripe style="width:100%" empty-text="暂无数据" highlight-current-row>
        <el-table-column prop="username" label="用户名" width="130" sortable />
        <el-table-column prop="real_name" label="姓名" width="110" />
        <el-table-column label="角色" width="100" prop="role" sortable>
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small" effect="plain">
              {{ roleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="店铺/组长" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="row.role === 'basic_designer'">
              <el-tag v-if="row.is_team_lead" type="warning" size="small">组长</el-tag>
              <span v-else>-</span>
            </template>
            <template v-else-if="row.role === 'operator'">
              <span>{{ row.store || '-' }}</span>
            </template>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" width="160" />
        <el-table-column prop="phone" label="手机" width="120" />
        <el-table-column label="最后登录" width="170" show-overflow-tooltip>
          <template #default="{ row }">{{ row.last_login_time || '从未登录' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ row.create_time }}</template>
        </el-table-column>
        <el-table-column label="操作" width="270" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="warning" link size="small" @click="resetPwd(row)">重置密码</el-button>
            <el-button
              :type="row.status === 1 ? 'danger' : 'success'"
              link
              size="small"
              @click="toggleStatus(row)"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button type="danger" link size="small" @click="deleteUser(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
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
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '新增用户'" width="500px" :close-on-click-modal="false" top="8vh">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px" size="default">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password" v-if="!isEdit">
          <el-input v-model="form.password" type="password" show-password placeholder="至少6位密码" />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="form.realName" placeholder="请输入真实姓名" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width:100%;">
            <el-option label="运营专员" value="operator" />
            <el-option label="美工设计师" value="designer" />
            <el-option label="客服专员" value="cs_agent" />
            <el-option label="基础美工" value="basic_designer" />
            <el-option label="运营助理" value="operator_assistant" />
            <el-option label="子管理员" value="sub_admin" />
            <el-option label="超级管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="店铺" prop="store" v-if="form.role === 'operator'">
          <el-select v-model="form.store" placeholder="请选择店铺" style="width:100%;">
            <el-option v-for="s in shopList" :key="s.id" :label="s.name" :value="s.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="设为组长" v-if="form.role === 'basic_designer'">
          <el-switch v-model="form.isTeamLead" active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="可选" />
        </el-form-item>
        <el-form-item label="手机">
          <el-input v-model="form.phone" placeholder="可选" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { getUserListApi, createUserApi, updateUserApi, resetPasswordApi, toggleUserStatusApi, deleteUserApi, getShopListApi } from '@/api'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)

const filter = reactive({ keyword: '', role: '', status: '' })

const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)
const editId = ref(null)

const shopList = ref([])

async function loadShops() {
  try {
    const res = await getShopListApi()
    if (res.code === 0) shopList.value = res.data || []
  } catch {}
}

const form = reactive({
  username: '',
  password: '',
  realName: '',
  role: 'operator',
  store: '',
  isTeamLead: false,
  email: '',
  phone: '',
  remark: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '密码不少于6位', trigger: 'blur' }],
  realName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

function roleLabel(r) {
  const map = { admin: '超级管理员', sub_admin: '子管理员', operator: '运营', cs_agent: '客服', designer: '美工', basic_designer: '基础美工', operator_assistant: '运营助理' }
  return map[r] || r
}
function roleTagType(r) {
  const map = { admin: 'danger', sub_admin: '', operator: 'warning', cs_agent: 'warning', designer: 'success', basic_designer: '', operator_assistant: 'info' }
  return map[r] || 'info'
}

async function loadData() {
  loading.value = true
  try {
    const res = await getUserListApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: filter.keyword || undefined,
      role: filter.role || undefined,
      status: filter.status !== '' ? filter.status : undefined
    })
    if (res.code === 0) {
      list.value = res.data.list
      total.value = res.data.total
    }
  } catch (e) {
    console.error('[Users] 加载用户列表失败:', e)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  isEdit.value = false
  editId.value = null
  form.username = ''
  form.password = ''
  form.realName = ''
  form.role = 'operator'
  form.store = ''
  form.isTeamLead = false
  form.email = ''
  form.phone = ''
  form.remark = ''
  if (shopList.value.length === 0) loadShops()
  dialogVisible.value = true
}

function openEdit(row) {
  isEdit.value = true
  editId.value = row.id
  form.username = row.username
  form.password = ''
  form.realName = row.real_name
  form.role = row.role
  form.store = row.store || ''
  form.isTeamLead = !!row.is_team_lead
  form.email = row.email || ''
  form.phone = row.phone || ''
  form.remark = row.remark || ''
  if (shopList.value.length === 0) loadShops()
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitLoading.value = true
  try {
    let res
    if (isEdit.value) {
      res = await updateUserApi({
        id: editId.value,
        realName: form.realName,
        role: form.role,
        store: form.role === 'operator' ? form.store : undefined,
        isTeamLead: form.isTeamLead ? 1 : 0,
        email: form.email || undefined,
        phone: form.phone || undefined,
        remark: form.remark || undefined
      })
    } else {
      res = await createUserApi({
        username: form.username,
        password: form.password,
        realName: form.realName,
        role: form.role,
        store: form.role === 'operator' ? form.store : undefined,
        isTeamLead: form.isTeamLead ? 1 : 0,
        email: form.email || undefined,
        phone: form.phone || undefined,
        remark: form.remark || undefined
      })
    }

    if (res.code === 0) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } finally {
    submitLoading.value = false
  }
}

async function resetPwd(row) {
  try {
    await ElMessageBox.confirm(`确认重置用户「${row.username}」的密码为 123456？`, '确认')
    const res = await resetPasswordApi({ id: row.id })
    if (res.code === 0) {
      ElMessage.success(res.msg)
    }
  } catch {}
}

async function toggleStatus(row) {
  const action = row.status === 1 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确认${action}用户「${row.username}」？`, '确认')
    const res = await toggleUserStatusApi({ id: row.id, status: row.status === 1 ? 0 : 1 })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      await loadData()
    }
  } catch {}
}

async function deleteUser(row) {
  try {
    await ElMessageBox.confirm(`确认删除用户「${row.username}」？删除后该用户发布的任务将保留但发布人置空。`, '删除确认', { confirmButtonText: '确认删除', type: 'warning' })
    const res = await deleteUserApi({ id: row.id })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {}
}

onMounted(() => loadData())
</script>

<style scoped>
</style>
