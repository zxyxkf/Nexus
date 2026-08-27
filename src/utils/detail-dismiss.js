let installed = false

function isVisible(element) {
  return !!element && element.getClientRects().length > 0
}

function getActiveDetailOverlay() {
  const overlays = Array.from(document.querySelectorAll('.inline-detail-overlay, .task-detail-overlay')).filter(isVisible)
  return overlays[overlays.length - 1] || null
}

function hasActiveUiOverlay() {
  return Array.from(document.querySelectorAll('.el-overlay, .el-image-viewer__wrapper, .el-message-box__wrapper'))
    .some(isVisible)
}

function closeDetail(overlay) {
  const closeButton = overlay?.querySelector('[aria-label="关闭"], .inline-detail-header .detail-header-right .el-button.is-circle')
  if (closeButton instanceof HTMLElement) {
    closeButton.click()
  }
}

function isBlankDetailArea(target, overlay) {
  if (!(target instanceof HTMLElement)) return false
  return !overlay.contains(target)
}

export function installDetailDismiss() {
  if (installed || typeof window === 'undefined') return
  installed = true

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || hasActiveUiOverlay()) return
    const overlay = getActiveDetailOverlay()
    if (!overlay) return
    event.preventDefault()
    closeDetail(overlay)
  })

  document.addEventListener('click', (event) => {
    if (hasActiveUiOverlay()) return
    const overlay = getActiveDetailOverlay()
    if (!overlay || !isBlankDetailArea(event.target, overlay)) return
    closeDetail(overlay)
  })
}
