import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import Pagination from './components/Pagination.vue'
import './utils/auth'
import './assets/styles/global.css'

const app = createApp(App)
const pinia = createPinia()
app.component('Pagination', Pagination)

// ===== 全局错误处理 =====

app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error]', err, info)
}

window.onerror = (msg, url, line, col, err) => {
  console.error('[Window Error]', msg, url, line, col, err)
  return false
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Promise Rejection]', event.reason)
})

// ===== 注册 & 挂载 =====

// 注册所有Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus, { locale: zhCn })
app.use(pinia)
app.use(router)
app.mount('#app')
