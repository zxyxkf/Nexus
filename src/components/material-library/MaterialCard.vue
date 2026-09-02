<template>
  <div class="material-card" @click="$emit('open')">
    <div class="material-card-preview">
      <img v-if="previewUrl" :src="resolvedPreview" alt="" loading="lazy" />
      <el-icon v-else :size="34"><Picture /></el-icon>
    </div>
    <div class="material-card-body">
      <strong>{{ name }}</strong>
      <span v-if="count !== undefined">{{ count }} 项</span>
    </div>
    <el-dropdown trigger="click" @command="$emit('command', $event)" @click.stop>
      <el-button text circle @click.stop><el-icon><MoreFilled /></el-icon></el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="rename">重命名</el-dropdown-item>
          <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Picture, MoreFilled } from '@element-plus/icons-vue'
import { getFileUrl } from '@/api/upload'
defineEmits(['open', 'command'])
const props = defineProps({ name: String, count: [Number, String], previewUrl: String })
const resolvedPreview = computed(() => getFileUrl(props.previewUrl))
</script>

<style scoped>
.material-card { position: relative; display: flex; flex-direction: column; min-height: 190px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: var(--el-bg-color); cursor: pointer; transition: box-shadow .2s, transform .2s; overflow: hidden; }
.material-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15, 23, 42, .08); }
.material-card-preview { height: 132px; display: grid; place-items: center; background: var(--el-fill-color-light); color: var(--el-text-color-placeholder); overflow: hidden; }
.material-card-preview img { width: 100%; height: 100%; object-fit: cover; }
.material-card-body { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 12px; min-width: 0; }
.material-card-body strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.material-card-body span { flex: none; color: var(--el-text-color-secondary); font-size: 12px; }
.material-card > .el-dropdown { position: absolute; top: 8px; right: 8px; }
</style>
