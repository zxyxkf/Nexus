<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header><div class="card-header"><span class="card-title">素材库</span><div class="header-right"><el-input v-model="keyword" clearable placeholder="搜索商品库或款式名称" style="width:260px" @input="loadProducts"><template #prefix><el-icon><Search /></el-icon></template></el-input><el-button type="primary" @click="createProduct"><el-icon><Plus /></el-icon>新建商品库</el-button></div></div></template>
      <div v-if="searchResults.styles.length" class="search-results"><div class="search-label">款式搜索结果</div><el-button v-for="style in searchResults.styles" :key="style.id" text @click="openStyle(style.id)">{{ style.product_name }} / {{ style.name }}</el-button></div>
      <div class="material-grid"><MaterialCard v-for="item in products" :key="item.id" :name="item.name" :count="item.style_count" :preview-url="item.previewUrl" @open="openProduct(item.id)" @command="command => handleCommand(item, command)" /></div>
      <el-empty v-if="!loading && !products.length" description="暂无商品库" />
    </el-card>
  </div>
</template>
<script setup>
import { onMounted, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import MaterialCard from '@/components/material-library/MaterialCard.vue'
import { getMaterialProductsApi, createMaterialProductApi, renameMaterialProductApi, deleteMaterialProductApi, searchMaterialLibraryApi } from '@/api'
const router = useRouter(); const products = ref([]); const keyword = ref(''); const loading = ref(false); const searchResults = reactive({ styles: [] })
async function loadProducts() { loading.value = true; try { const [res, search] = await Promise.all([getMaterialProductsApi({ keyword: keyword.value }), searchMaterialLibraryApi(keyword.value)]); if (res.code === 0) products.value = res.data || []; searchResults.styles = search.code === 0 ? (search.data?.styles || []) : [] } finally { loading.value = false } }
function openProduct(id) { router.push(`/material-library/products/${id}/styles`) }
function openStyle(id) { router.push(`/material-library/styles/${id}/images`) }
async function createProduct() { const { value } = await ElMessageBox.prompt('请输入商品库名称', '新建商品库', { inputPattern: /\S+/, inputErrorMessage: '名称不能为空' }); const res = await createMaterialProductApi({ name: value }); if (res.code === 0) { ElMessage.success('创建成功'); loadProducts() } else ElMessage.error(res.msg) }
async function handleCommand(item, command) { if (command === 'rename') { const { value } = await ElMessageBox.prompt('请输入新名称', '重命名', { inputValue: item.name }); const res = await renameMaterialProductApi(item.id, { name: value }); if (res.code === 0) loadProducts(); else ElMessage.error(res.msg) } if (command === 'delete') { await ElMessageBox.confirm(`将删除“${item.name}”及其全部款式和图片，是否继续？`, '确认删除', { type: 'warning' }); const res = await deleteMaterialProductApi(item.id); if (res.code === 0) { ElMessage.success('已删除'); loadProducts() } else ElMessage.error(res.msg) } }
onMounted(loadProducts)
</script>
<style scoped>.header-right { display:flex; gap:10px; align-items:center; }.material-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:16px; }.search-results { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:10px 12px; margin-bottom:18px; background:var(--el-fill-color-light); border-radius:6px; }.search-label { color:var(--el-text-color-secondary); font-size:13px; }</style>
