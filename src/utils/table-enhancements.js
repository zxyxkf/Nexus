import { getUser } from '@/utils/auth'

const ENHANCED_ATTR = 'data-nexus-column-settings'
const STYLE_ID_PREFIX = 'nexus-table-columns-style-'
let tableSeq = 0
let observer = null
let scheduled = false

function getRouteKey() {
  return (window.location.hash || window.location.pathname || 'root').replace(/[^\w-]+/g, '_')
}

function isDashboardRoute() {
  const hash = window.location.hash || ''
  return hash === '#/dashboard' || hash.startsWith('#/dashboard/')
}

function getUserKey() {
  const user = getUser()
  return user?.id || user?.username || 'guest'
}

function getHeaderCells(table) {
  const rows = table.querySelectorAll('.el-table__header-wrapper thead tr')
  const row = rows[rows.length - 1]
  if (!row) return []
  return Array.from(row.querySelectorAll('th')).map((th, index) => {
    const text = th.querySelector('.cell')?.textContent?.trim() || `第${index + 1}列`
    return { index: index + 1, label: text || `第${index + 1}列` }
  })
}

function makeStorageKey(table, cells) {
  const signature = cells.map(cell => cell.label).join('|').slice(0, 160)
  const tableKey = table.dataset.nexusColumnKey || `${getRouteKey()}_${table.dataset.nexusTableIndex || '0'}_${signature}`
  return `nexus_table_columns_${getUserKey()}_${tableKey}`
}

function loadVisible(key, cells) {
  const all = cells.map(cell => cell.index)
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null')
    const valid = new Set(all)
    const next = Array.isArray(parsed) ? parsed.map(Number).filter(value => valid.has(value)) : all
    return next.length ? next : all
  } catch {
    return all
  }
}

function saveVisible(key, visible) {
  localStorage.setItem(key, JSON.stringify(visible))
}

function applyVisibility(table, tableId, cells, visible) {
  const hidden = cells.map(cell => cell.index).filter(index => !visible.includes(index))
  let style = document.getElementById(`${STYLE_ID_PREFIX}${tableId}`)
  if (!style) {
    style = document.createElement('style')
    style.id = `${STYLE_ID_PREFIX}${tableId}`
    document.head.appendChild(style)
  }

  if (!hidden.length) {
    style.textContent = ''
    table.__vueParentComponent?.proxy?.doLayout?.()
    return
  }

  const selectors = hidden.flatMap(index => [
    `.nexus-table-${tableId} .el-table__header-wrapper th:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__body-wrapper td:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__footer-wrapper td:nth-child(${index})`,
    `.nexus-table-${tableId} colgroup col:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__fixed th:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__fixed td:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__fixed-right th:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__fixed-right td:nth-child(${index})`
  ])
  style.textContent = `${selectors.join(',')}{display:none!important;width:0!important;min-width:0!important;max-width:0!important;padding:0!important;border:0!important;}`

  table.__vueParentComponent?.proxy?.doLayout?.()
}

function closeOtherPanels(activePanel) {
  document.querySelectorAll('.nexus-column-panel.is-open').forEach(panel => {
    if (panel !== activePanel) {
      panel.classList.remove('is-open')
      panel.classList.remove('is-teleported')
      panel.removeAttribute('style')
    }
  })
}

function positionPanel(button, panel) {
  const rect = button.getBoundingClientRect()
  const width = Math.max(panel.offsetWidth || 180, 180)
  const margin = 8
  const left = Math.min(
    Math.max(margin, rect.right - width),
    window.innerWidth - width - margin
  )
  const top = Math.min(rect.bottom + margin, window.innerHeight - margin)
  panel.style.position = 'fixed'
  panel.style.left = `${left}px`
  panel.style.top = `${top}px`
  panel.style.right = 'auto'
  panel.style.zIndex = '4000'
  panel.classList.add('is-teleported')
}

function removeEnhancement(table) {
  if (table.dataset.nexusTableId) {
    document.getElementById(`${STYLE_ID_PREFIX}${table.dataset.nexusTableId}`)?.remove()
  }
  table.querySelector(':scope > .nexus-column-control')?.remove()
  for (const className of [...table.classList]) {
    if (className.startsWith('nexus-table-')) table.classList.remove(className)
  }
  table.removeAttribute(ENHANCED_ATTR)
  delete table.dataset.nexusTableId
  delete table.dataset.nexusTableIndex
  delete table.dataset.nexusColumnSignature
}

function createControl(table, tableId, cells, storageKey, visible) {
  const control = document.createElement('div')
  control.className = 'nexus-column-control'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nexus-column-button'
  button.textContent = '列设置'

  const panel = document.createElement('div')
  panel.className = 'nexus-column-panel'

  const actions = document.createElement('div')
  actions.className = 'nexus-column-actions'

  const allButton = document.createElement('button')
  allButton.type = 'button'
  allButton.textContent = '全选'

  const resetButton = document.createElement('button')
  resetButton.type = 'button'
  resetButton.textContent = '默认'

  actions.append(allButton, resetButton)
  panel.appendChild(actions)

  const currentVisible = new Set(visible)
  for (const cell of cells) {
    const label = document.createElement('label')
    label.className = 'nexus-column-option'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = currentVisible.has(cell.index)
    checkbox.addEventListener('change', () => {
      const next = cells
        .filter(item => panel.querySelector(`input[data-index="${item.index}"]`)?.checked)
        .map(item => item.index)
      const finalVisible = next.length ? next : [cell.index]
      saveVisible(storageKey, finalVisible)
      applyVisibility(table, tableId, cells, finalVisible)
      panel.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.checked = finalVisible.includes(Number(input.dataset.index))
      })
    })
    checkbox.dataset.index = String(cell.index)
    const span = document.createElement('span')
    span.textContent = cell.label
    label.append(checkbox, span)
    panel.appendChild(label)
  }

  allButton.addEventListener('click', () => {
    const all = cells.map(cell => cell.index)
    saveVisible(storageKey, all)
    panel.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true })
    applyVisibility(table, tableId, cells, all)
  })

  resetButton.addEventListener('click', () => {
    const all = cells.map(cell => cell.index)
    localStorage.removeItem(storageKey)
    panel.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true })
    applyVisibility(table, tableId, cells, all)
  })

  button.addEventListener('click', event => {
    event.stopPropagation()
    const willOpen = !panel.classList.contains('is-open')
    closeOtherPanels(willOpen ? panel : null)
    panel.classList.toggle('is-open', willOpen)
    if (willOpen) positionPanel(button, panel)
    else {
      panel.classList.remove('is-teleported')
      panel.removeAttribute('style')
    }
  })
  panel.addEventListener('click', event => event.stopPropagation())

  control.append(button, panel)
  return control
}

function enhanceTable(table, index) {
  const cells = getHeaderCells(table)
  if (!cells.length) return
  const signature = cells.map(cell => cell.label).join('|')
  if (table.getAttribute(ENHANCED_ATTR) === '1' && table.dataset.nexusColumnSignature === signature) return

  removeEnhancement(table)

  const tableId = `${Date.now()}_${tableSeq++}`
  table.classList.add(`nexus-table-${tableId}`)
  table.dataset.nexusTableId = tableId
  table.dataset.nexusTableIndex = String(index)
  table.dataset.nexusColumnSignature = signature
  table.setAttribute(ENHANCED_ATTR, '1')

  const storageKey = makeStorageKey(table, cells)
  const visible = loadVisible(storageKey, cells)
  applyVisibility(table, tableId, cells, visible)
  table.appendChild(createControl(table, tableId, cells, storageKey, visible))
}

function enhanceTables() {
  const tables = document.querySelectorAll('.el-table')
  if (isDashboardRoute()) {
    tables.forEach(removeEnhancement)
    return
  }
  tables.forEach((table, index) => enhanceTable(table, index))
}

export function installTableEnhancements() {
  if (typeof window === 'undefined') return

  const scheduleEnhance = () => {
    if (scheduled) return
    scheduled = true
    window.requestAnimationFrame(() => {
      scheduled = false
      enhanceTables()
    })
  }
  scheduleEnhance()
  window.addEventListener('hashchange', scheduleEnhance)
  window.addEventListener('resize', () => closeOtherPanels(null))
  window.addEventListener('scroll', () => closeOtherPanels(null), true)
  document.addEventListener('click', () => closeOtherPanels(null))

  observer = new MutationObserver(scheduleEnhance)
  observer.observe(document.body, { childList: true, subtree: true })
}

export function uninstallTableEnhancements() {
  observer?.disconnect()
  observer = null
}
