/**
 * 字段标签映射 — 根据角色返回语义正确的标签
 */

import { useUserStore } from '@/store'

export function useFieldLabels() {
  const store = useUserStore()
  const isCsRole = store.isCsAgent || store.isBasicDesigner

  return {
    refPathLabel: isCsRole ? '旺旺ID' : '参考路径',
    designerLabel: isCsRole ? '基础美工' : '美工'
  }
}
