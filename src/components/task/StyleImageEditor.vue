<template>
  <el-dialog
    v-model="dialogVisible"
    title="编辑款式图"
    width="min(1240px, 96vw)"
    top="3vh"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    class="style-image-editor-dialog"
    @opened="initializeEditor"
    @closed="disposeEditor"
  >
    <div v-loading="loading" class="style-editor-shell">
      <section class="style-editor-workspace">
        <div
          ref="viewportRef"
          class="style-editor-viewport"
          :data-viewport-x="viewportX"
          :data-viewport-y="viewportY"
        >
          <canvas ref="canvasRef" />
        </div>
        <div class="style-editor-status">
          <span>{{ Math.round(zoom * 100) }}%</span>
          <span v-if="selectedLabel">已选：{{ selectedLabel }}</span>
          <span v-else>未选择图层</span>
        </div>
      </section>

      <aside class="style-editor-tools">
        <section class="tool-section">
          <h3>框选工具</h3>
          <div class="tool-row">
            <el-select v-model="shapeTool" placeholder="选择形状" style="flex: 1">
              <el-option label="矩形" value="rect" />
              <el-option label="圆形 / 椭圆" value="ellipse" />
              <el-option label="自由四边形" value="polygon" />
              <el-option label="箭头" value="arrow" />
            </el-select>
            <el-button type="primary" :disabled="!shapeTool" @click="addShape">添加</el-button>
          </div>
        </section>

        <section class="tool-section">
          <h3>添加内容</h3>
          <div class="tool-row">
            <el-button :icon="EditPen" @click="addText">添加文字</el-button>
            <el-button :icon="Picture" @click="chooseOverlayImage">上传图片</el-button>
            <input ref="overlayInputRef" class="file-input" type="file" accept="image/*" @change="addOverlayImage" />
          </div>
        </section>

        <section v-if="hasSelection" class="tool-section selected-properties">
          <h3>当前元素</h3>

          <template v-if="isShapeSelected">
            <label class="property-row">
              <span>线条颜色</span>
              <el-color-picker v-model="strokeColor" @change="applyShapeStyle" />
            </label>
            <label class="property-row">
              <span>线条粗细</span>
              <el-input-number v-model="strokeWidth" :min="1" :max="40" controls-position="right" @change="applyShapeStyle" />
            </label>
          </template>

          <template v-if="isTextSelected">
            <label class="property-column">
              <span>文字内容</span>
              <el-input v-model="textValue" type="textarea" :rows="3" maxlength="300" @input="applyTextStyle" />
            </label>
            <label class="property-row">
              <span>字号</span>
              <el-input-number v-model="fontSize" :min="10" :max="240" controls-position="right" @change="applyTextStyle" />
            </label>
            <label class="property-row">
              <span>文字颜色</span>
              <el-color-picker v-model="textColor" @change="applyTextStyle" />
            </label>
            <label class="property-row">
              <span>背景颜色</span>
              <div class="color-with-clear">
                <el-color-picker v-model="textBackground" show-alpha @change="applyTextStyle" />
                <el-button link @click="clearTextBackground">清除</el-button>
              </div>
            </label>
          </template>

          <template v-if="isUploadedImageSelected">
            <label class="property-column">
              <span>去底容差</span>
              <el-slider v-model="backgroundTolerance" :min="0" :max="255" :show-input="true" />
            </label>
            <label class="property-column">
              <span>边缘净化</span>
              <el-slider v-model="edgeCleanup" :min="0" :max="100" :show-input="true" />
            </label>
            <div class="tool-row">
              <el-button :loading="processingImage" @click="removeImageBackground">一键透明底</el-button>
              <el-button @click="restoreUploadedImage">恢复图片</el-button>
            </div>

            <div class="image-color-tools">
              <span class="property-title">图片换色</span>
              <el-radio-group v-model="recolorMode" size="small">
                <el-radio-button value="solid">整体单色</el-radio-button>
                <el-radio-button value="matching">指定颜色</el-radio-button>
              </el-radio-group>
              <div v-if="recolorMode === 'matching'" class="property-row">
                <span>原颜色</span>
                <div class="color-pick-row">
                  <span class="color-swatch" :style="{ backgroundColor: sourceColor }" />
                  <el-button
                    size="small"
                    :type="eyedropperActive ? 'primary' : undefined"
                    @click="toggleEyedropper"
                  >{{ eyedropperActive ? '点击图片取色' : '吸管取色' }}</el-button>
                </div>
              </div>
              <label class="property-row">
                <span>目标颜色</span>
                <el-color-picker v-model="targetColor" />
              </label>
              <label v-if="recolorMode === 'matching'" class="property-column">
                <span>颜色容差</span>
                <el-slider v-model="colorTolerance" :min="1" :max="255" :show-input="true" />
              </label>
              <div class="tool-row">
                <el-button type="primary" :loading="processingImage" @click="applyImageRecolor">应用换色</el-button>
                <el-button :disabled="!canUndo" @click="undo">撤销换色</el-button>
              </div>
            </div>
          </template>

          <div class="layer-actions">
            <el-tooltip content="上移一层" placement="top">
              <el-button :icon="Top" circle @click="moveLayerUp" />
            </el-tooltip>
            <el-tooltip content="下移一层" placement="top">
              <el-button :icon="Bottom" circle @click="moveLayerDown" />
            </el-tooltip>
            <el-tooltip content="复制元素" placement="top">
              <el-button :icon="CopyDocument" circle @click="cloneSelection" />
            </el-tooltip>
            <el-tooltip content="删除元素" placement="top">
              <el-button :icon="Delete" circle type="danger" plain @click="deleteSelection" />
            </el-tooltip>
          </div>
        </section>
      </aside>
    </div>

    <template #footer>
      <div class="style-editor-footer">
        <div class="history-actions">
          <el-tooltip content="撤销" placement="top">
            <el-button :icon="RefreshLeft" circle :disabled="!canUndo" @click="undo" />
          </el-tooltip>
          <el-tooltip content="恢复" placement="top">
            <el-button :icon="RefreshRight" circle :disabled="!canRedo" @click="redo" />
          </el-tooltip>
          <el-tooltip content="移动画布" placement="top">
            <el-button
              :icon="Rank"
              circle
              :type="panMode ? 'primary' : undefined"
              aria-label="移动画布"
              :aria-pressed="panMode"
              @click="togglePanMode"
            />
          </el-tooltip>
          <el-button @click="restoreOriginal">还原原图</el-button>
        </div>
        <div>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveResult">保存成品</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Bottom,
  CopyDocument,
  Delete,
  EditPen,
  Picture,
  Rank,
  RefreshLeft,
  RefreshRight,
  Top
} from '@element-plus/icons-vue'
import {
  Canvas,
  Ellipse,
  FabricImage,
  Group,
  IText,
  Line,
  Point,
  Polygon,
  Rect,
  Triangle,
  util
} from 'fabric'
import {
  recolorMatching,
  recolorSolid,
  removeBackground,
  samplePixel
} from '@/utils/background-removal'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  image: { type: Object, default: null },
  savedScene: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'save'])

const CUSTOM_PROPERTIES = ['nexusType', 'originalDataUrl', 'uploadedLayer']
const HISTORY_LIMIT = 50
const MIN_ZOOM = 0.2
const MAX_ZOOM = 5
const MAX_CANVAS_DIMENSION = 4096

const dialogVisible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

const canvasRef = ref(null)
const viewportRef = ref(null)
const overlayInputRef = ref(null)
const loading = ref(false)
const saving = ref(false)
const processingImage = ref(false)
const zoom = ref(1)
const shapeTool = ref('')
const selectedObject = shallowRef(null)
const strokeColor = ref('#ff3b30')
const strokeWidth = ref(5)
const textValue = ref('')
const fontSize = ref(44)
const textColor = ref('#111111')
const textBackground = ref('rgba(255,255,255,0)')
const backgroundTolerance = ref(42)
const edgeCleanup = ref(55)
const recolorMode = ref('solid')
const sourceColor = ref('#000000')
const targetColor = ref('#ff3b30')
const colorTolerance = ref(36)
const eyedropperActive = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)
const panMode = ref(false)
const viewportX = ref(0)
const viewportY = ref(0)

let canvas = null
let history = []
let historyIndex = -1
let historyLocked = false
let historyTimer = null
let isPanning = false
let lastPanX = 0
let lastPanY = 0
let panPointerId = null
let panCanvasElement = null

const hasSelection = computed(() => Boolean(selectedObject.value))
const isShapeSelected = computed(() => selectedObject.value?.nexusType === 'shape')
const isTextSelected = computed(() => selectedObject.value?.nexusType === 'text')
const isUploadedImageSelected = computed(() => selectedObject.value?.nexusType === 'uploaded-image')
const selectedLabel = computed(() => {
  if (isShapeSelected.value) return '框选'
  if (isTextSelected.value) return '文字'
  if (isUploadedImageSelected.value) return '图片'
  return ''
})

function currentImageUrl() {
  return props.image?.editorUrl || props.image?.previewUrl || props.image?.url || ''
}

function safeBaseName() {
  const fallback = `material-${props.image?.id || 'image'}`
  const source = String(props.image?.display_name || props.image?.original_name || fallback)
  return (source.replace(/\.[^.]+$/, '').replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').trim() || fallback)
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

function setBaseImageProperties(object) {
  if (object?.nexusType !== 'base-image') return
  object.set({ selectable: false, evented: false, hasControls: false, hasBorders: false })
}

function normalizeLoadedObjects() {
  canvas?.getObjects().forEach(setBaseImageProperties)
}

async function createBaseImage() {
  const source = currentImageUrl()
  if (!source) throw new Error('未找到款式图地址')
  const image = await FabricImage.fromURL(source, { crossOrigin: 'anonymous' })
  const originalWidth = Number(image.width) || 1
  const originalHeight = Number(image.height) || 1
  const scale = Math.min(1, MAX_CANVAS_DIMENSION / Math.max(originalWidth, originalHeight))
  const width = Math.max(1, Math.round(originalWidth * scale))
  const height = Math.max(1, Math.round(originalHeight * scale))

  canvas.setDimensions({ width, height })
  image.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX: width / originalWidth,
    scaleY: height / originalHeight,
    nexusType: 'base-image',
    selectable: false,
    evented: false,
    hasControls: false,
    hasBorders: false
  })
  canvas.add(image)
  canvas.sendObjectToBack(image)
}

async function initializeEditor() {
  if (!canvasRef.value || loading.value) return
  disposeCanvasOnly()
  loading.value = true
  try {
    canvas = new Canvas(canvasRef.value, {
      preserveObjectStacking: true,
      selection: true,
      backgroundColor: '#eef0f3'
    })

    historyLocked = true
    if (props.savedScene) {
      const scene = JSON.parse(JSON.stringify(props.savedScene))
      const width = Number(scene.width) || 900
      const height = Number(scene.height) || 650
      canvas.setDimensions({ width, height })
      await canvas.loadFromJSON(scene)
      normalizeLoadedObjects()
    } else {
      await createBaseImage()
    }
    historyLocked = false

    bindCanvasEvents()
    bindPanEvents()
    resizeCanvasDisplay()
    resetViewport()
    resetHistory()
  } catch (error) {
    console.error('[StyleEditor] 初始化失败:', error)
    ElMessage.error(error.message || '款式图加载失败')
    dialogVisible.value = false
  } finally {
    historyLocked = false
    loading.value = false
  }
}

function bindCanvasEvents() {
  if (!canvas) return
  canvas.on('selection:created', event => syncSelectedObject(event.selected?.[0]))
  canvas.on('selection:updated', event => syncSelectedObject(event.selected?.[0]))
  canvas.on('selection:cleared', () => syncSelectedObject(null))
  canvas.on('object:added', scheduleHistory)
  canvas.on('object:modified', scheduleHistory)
  canvas.on('object:removed', scheduleHistory)
  canvas.on('text:changed', scheduleHistory)
  canvas.on('mouse:down', handleEyedropperPick)
  canvas.on('mouse:wheel', event => {
    event.e.preventDefault()
    event.e.stopPropagation()
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, canvas.getZoom() * (0.999 ** event.e.deltaY)))
    canvas.zoomToPoint(new Point(event.e.offsetX, event.e.offsetY), nextZoom)
    zoom.value = nextZoom
    syncViewportPosition()
  })
}

function syncViewportPosition() {
  viewportX.value = Number(canvas?.viewportTransform?.[4]) || 0
  viewportY.value = Number(canvas?.viewportTransform?.[5]) || 0
}

function bindPanEvents() {
  if (!canvas?.upperCanvasEl) return
  panCanvasElement = canvas.upperCanvasEl
  panCanvasElement.addEventListener('pointerdown', startPanning, true)
  panCanvasElement.addEventListener('pointermove', movePanning, true)
  panCanvasElement.addEventListener('pointerup', stopPanning, true)
  panCanvasElement.addEventListener('pointercancel', stopPanning, true)
}

function unbindPanEvents() {
  if (!panCanvasElement) return
  panCanvasElement.removeEventListener('pointerdown', startPanning, true)
  panCanvasElement.removeEventListener('pointermove', movePanning, true)
  panCanvasElement.removeEventListener('pointerup', stopPanning, true)
  panCanvasElement.removeEventListener('pointercancel', stopPanning, true)
  panCanvasElement = null
  panPointerId = null
}

function startPanning(event) {
  if (!panMode.value || event.button !== 0 || !canvas) return
  isPanning = true
  panPointerId = event.pointerId
  lastPanX = event.clientX
  lastPanY = event.clientY
  panCanvasElement?.setPointerCapture?.(event.pointerId)
  canvas.defaultCursor = 'grabbing'
  canvas.setCursor('grabbing')
  event.preventDefault()
}

function movePanning(event) {
  if (!panMode.value || !isPanning || !canvas) return
  const transform = [...canvas.viewportTransform]
  transform[4] += event.clientX - lastPanX
  transform[5] += event.clientY - lastPanY
  lastPanX = event.clientX
  lastPanY = event.clientY
  canvas.setViewportTransform(transform)
  syncViewportPosition()
  canvas.renderAll()
  event.preventDefault()
}

function stopPanning(event) {
  if (!isPanning) return
  if (panPointerId !== null && panCanvasElement?.hasPointerCapture?.(panPointerId)) {
    panCanvasElement.releasePointerCapture(panPointerId)
  }
  isPanning = false
  panPointerId = null
  if (panMode.value && canvas) {
    canvas.defaultCursor = 'grab'
    canvas.setCursor('grab')
  }
}

function setPanMode(enabled) {
  panMode.value = Boolean(enabled)
  eyedropperActive.value = false
  isPanning = false
  if (!canvas) return
  canvas.selection = !panMode.value
  canvas.skipTargetFind = panMode.value
  if (panMode.value) {
    canvas.discardActiveObject()
    syncSelectedObject(null)
  }
  const cursor = panMode.value ? 'grab' : 'default'
  canvas.defaultCursor = cursor
  canvas.hoverCursor = panMode.value ? 'grab' : 'move'
  canvas.setCursor(cursor)
  canvas.requestRenderAll()
}

function togglePanMode() {
  setPanMode(!panMode.value)
}

function resizeCanvasDisplay() {
  if (!canvas || !viewportRef.value) return
  const availableWidth = Math.max(280, viewportRef.value.clientWidth - 24)
  const availableHeight = Math.max(280, viewportRef.value.clientHeight - 24)
  const ratio = Math.min(availableWidth / canvas.getWidth(), availableHeight / canvas.getHeight(), 1)
  canvas.setDimensions({
    width: Math.round(canvas.getWidth() * ratio),
    height: Math.round(canvas.getHeight() * ratio)
  }, { cssOnly: true })
}

function resetViewport() {
  if (!canvas) return
  setPanMode(false)
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
  zoom.value = 1
  syncViewportPosition()
  canvas.requestRenderAll()
}

function syncSelectedObject(object) {
  selectedObject.value = object?.nexusType === 'base-image' ? null : (object || null)
  const selected = selectedObject.value
  if (!selected) {
    eyedropperActive.value = false
    return
  }
  if (selected.nexusType !== 'uploaded-image') eyedropperActive.value = false

  strokeColor.value = selected.nexusType === 'shape'
    ? (selected.stroke || selected.getObjects?.()[0]?.stroke || '#ff3b30')
    : strokeColor.value
  strokeWidth.value = selected.nexusType === 'shape'
    ? Number(selected.strokeWidth || selected.getObjects?.()[0]?.strokeWidth || 5)
    : strokeWidth.value
  if (selected.nexusType === 'text') {
    textValue.value = selected.text || ''
    fontSize.value = Number(selected.fontSize) || 44
    textColor.value = selected.fill || '#111111'
    textBackground.value = selected.backgroundColor || 'rgba(255,255,255,0)'
  }
}

function objectCenter(size = 0) {
  return {
    left: Math.max(0, (canvas.getWidth() - size) / 2),
    top: Math.max(0, (canvas.getHeight() - size) / 2)
  }
}

function commonShapeOptions(size) {
  return {
    ...objectCenter(size),
    fill: 'rgba(255,255,255,0)',
    stroke: strokeColor.value,
    strokeWidth: strokeWidth.value,
    strokeUniform: true,
    nexusType: 'shape'
  }
}

function addShape() {
  if (!canvas || !shapeTool.value) return
  const size = Math.max(100, Math.min(canvas.getWidth(), canvas.getHeight()) * 0.3)
  const options = commonShapeOptions(size)
  let object

  if (shapeTool.value === 'rect') {
    object = new Rect({ ...options, width: size, height: size * 0.7 })
  } else if (shapeTool.value === 'ellipse') {
    object = new Ellipse({ ...options, rx: size / 2, ry: size * 0.35 })
  } else if (shapeTool.value === 'polygon') {
    object = new Polygon([
      { x: 0, y: size * 0.12 },
      { x: size, y: 0 },
      { x: size * 0.88, y: size * 0.72 },
      { x: size * 0.08, y: size * 0.64 }
    ], options)
  } else {
    const length = size
    const line = new Line([0, 0, length, 0], {
      stroke: strokeColor.value,
      strokeWidth: strokeWidth.value,
      strokeUniform: true
    })
    const head = new Triangle({
      left: length,
      top: 0,
      width: Math.max(22, strokeWidth.value * 4),
      height: Math.max(28, strokeWidth.value * 5),
      fill: strokeColor.value,
      originX: 'center',
      originY: 'center',
      angle: 90
    })
    object = new Group([line, head], {
      ...objectCenter(size),
      nexusType: 'shape'
    })
  }

  canvas.add(object)
  canvas.setActiveObject(object)
  syncSelectedObject(object)
  canvas.requestRenderAll()
}

function addText() {
  if (!canvas) return
  const object = new IText('双击编辑文字', {
    ...objectCenter(180),
    fontSize: Math.max(24, Math.min(56, canvas.getWidth() * 0.05)),
    fill: textColor.value,
    backgroundColor: 'rgba(255,255,255,0)',
    fontFamily: 'Microsoft YaHei, sans-serif',
    nexusType: 'text'
  })
  canvas.add(object)
  canvas.setActiveObject(object)
  syncSelectedObject(object)
  canvas.requestRenderAll()
}

function chooseOverlayImage() {
  overlayInputRef.value?.click()
}

async function addOverlayImage(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }

  try {
    const dataUrl = await readFileAsDataUrl(file)
    const object = await FabricImage.fromURL(dataUrl)
    const maxWidth = canvas.getWidth() * 0.45
    const maxHeight = canvas.getHeight() * 0.45
    const scale = Math.min(1, maxWidth / object.width, maxHeight / object.height)
    object.set({
      ...objectCenter(Math.min(object.width * scale, object.height * scale)),
      scaleX: scale,
      scaleY: scale,
      nexusType: 'uploaded-image',
      uploadedLayer: true,
      originalDataUrl: dataUrl
    })
    canvas.add(object)
    canvas.setActiveObject(object)
    syncSelectedObject(object)
    canvas.requestRenderAll()
  } catch (error) {
    ElMessage.error(error.message || '图片添加失败')
  }
}

function applyShapeStyle() {
  const object = selectedObject.value
  if (!object || object.nexusType !== 'shape') return
  if (object instanceof Group) {
    object.getObjects().forEach(child => {
      child.set({ stroke: strokeColor.value, strokeWidth: strokeWidth.value })
      if (child instanceof Triangle) child.set({ fill: strokeColor.value })
    })
  } else {
    object.set({ stroke: strokeColor.value, strokeWidth: strokeWidth.value })
  }
  object.setCoords()
  canvas.requestRenderAll()
  scheduleHistory()
}

function applyTextStyle() {
  const object = selectedObject.value
  if (!object || object.nexusType !== 'text') return
  object.set({
    text: textValue.value,
    fontSize: fontSize.value,
    fill: textColor.value,
    backgroundColor: textBackground.value || 'rgba(255,255,255,0)'
  })
  object.setCoords()
  canvas.requestRenderAll()
  scheduleHistory()
}

function clearTextBackground() {
  textBackground.value = 'rgba(255,255,255,0)'
  applyTextStyle()
}

function imageDataForObject(object) {
  const element = object?.getElement?.()
  if (!element) throw new Error('当前图片图层不可用')
  const width = Number(element.naturalWidth || element.videoWidth || element.width) || 0
  const height = Number(element.naturalHeight || element.videoHeight || element.height) || 0
  if (!width || !height) throw new Error('当前图片尺寸无效')
  const workCanvas = document.createElement('canvas')
  workCanvas.width = width
  workCanvas.height = height
  const context = workCanvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(element, 0, 0, width, height)
  return { workCanvas, context, imageData: context.getImageData(0, 0, width, height) }
}

async function transformUploadedImage(transform, failureMessage) {
  const object = selectedObject.value
  if (!object?.uploadedLayer) return
  processingImage.value = true
  try {
    const { workCanvas, context, imageData } = imageDataForObject(object)
    context.putImageData(transform(imageData), 0, 0)
    await object.setSrc(workCanvas.toDataURL('image/png'))
    object.setCoords()
    canvas.requestRenderAll()
    captureHistory()
  } catch (error) {
    console.error(`[StyleEditor] ${failureMessage}:`, error)
    ElMessage.error(error.message || failureMessage)
  } finally {
    processingImage.value = false
  }
}

async function removeImageBackground() {
  await transformUploadedImage(
    imageData => removeBackground(imageData, {
      tolerance: backgroundTolerance.value,
      edgeCleanup: edgeCleanup.value
    }),
    '透明底处理失败'
  )
}

async function applyImageRecolor() {
  if (recolorMode.value === 'matching' && !sourceColor.value) {
    ElMessage.warning('请先使用吸管选择原颜色')
    return
  }
  await transformUploadedImage(
    imageData => recolorMode.value === 'solid'
      ? recolorSolid(imageData, targetColor.value)
      : recolorMatching(imageData, sourceColor.value, targetColor.value, colorTolerance.value),
    '图片换色失败'
  )
}

function colorToHex(color) {
  return `#${[color.r, color.g, color.b]
    .map(channel => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

function toggleEyedropper() {
  eyedropperActive.value = !eyedropperActive.value
  if (canvas) {
    canvas.defaultCursor = eyedropperActive.value ? 'crosshair' : 'default'
    canvas.hoverCursor = eyedropperActive.value ? 'crosshair' : 'move'
    canvas.requestRenderAll()
  }
}

function handleEyedropperPick(event) {
  const object = selectedObject.value
  if (!eyedropperActive.value || !object?.uploadedLayer || !canvas) return
  try {
    const scenePoint = canvas.getScenePoint(event.e)
    const localPoint = util.transformPoint(scenePoint, util.invertTransform(object.calcTransformMatrix()))
    const { imageData } = imageDataForObject(object)
    const pixelX = ((localPoint.x / Math.max(1, Number(object.width))) + 0.5) * imageData.width
    const pixelY = ((localPoint.y / Math.max(1, Number(object.height))) + 0.5) * imageData.height
    sourceColor.value = colorToHex(samplePixel(imageData, pixelX, pixelY))
    eyedropperActive.value = false
    canvas.defaultCursor = 'default'
    canvas.hoverCursor = 'move'
    canvas.requestRenderAll()
  } catch (error) {
    ElMessage.error(error.message || '取色失败')
  }
}

async function restoreUploadedImage() {
  const object = selectedObject.value
  if (!object?.uploadedLayer || !object.originalDataUrl) return
  try {
    await object.setSrc(object.originalDataUrl)
    object.setCoords()
    canvas.requestRenderAll()
    captureHistory()
  } catch (error) {
    ElMessage.error(error.message || '图片恢复失败')
  }
}

function moveLayerUp() {
  const object = selectedObject.value
  if (!canvas || !object) return
  canvas.bringObjectForward(object)
  canvas.requestRenderAll()
  captureHistory()
}

function moveLayerDown() {
  const object = selectedObject.value
  if (!canvas || !object) return
  const index = canvas.getObjects().indexOf(object)
  canvas.moveObjectTo(object, Math.max(1, index - 1))
  canvas.requestRenderAll()
  captureHistory()
}

async function cloneSelection() {
  const object = selectedObject.value
  if (!canvas || !object) return
  const clone = await object.clone(CUSTOM_PROPERTIES)
  clone.set({ left: Number(object.left || 0) + 24, top: Number(object.top || 0) + 24 })
  canvas.add(clone)
  canvas.setActiveObject(clone)
  syncSelectedObject(clone)
  canvas.requestRenderAll()
}

function deleteSelection() {
  const object = selectedObject.value
  if (!canvas || !object) return
  canvas.remove(object)
  canvas.discardActiveObject()
  syncSelectedObject(null)
  canvas.requestRenderAll()
}

function serializeCanvas() {
  return JSON.stringify({
    ...canvas.toJSON(CUSTOM_PROPERTIES),
    width: canvas.getWidth(),
    height: canvas.getHeight()
  })
}

function updateHistoryButtons() {
  canUndo.value = historyIndex > 0
  canRedo.value = historyIndex >= 0 && historyIndex < history.length - 1
}

function resetHistory() {
  clearTimeout(historyTimer)
  history = [serializeCanvas()]
  historyIndex = 0
  updateHistoryButtons()
}

function scheduleHistory() {
  if (historyLocked || !canvas) return
  clearTimeout(historyTimer)
  historyTimer = setTimeout(captureHistory, 80)
}

function captureHistory() {
  if (historyLocked || !canvas) return
  clearTimeout(historyTimer)
  const serialized = serializeCanvas()
  if (history[historyIndex] === serialized) return
  history = history.slice(0, historyIndex + 1)
  history.push(serialized)
  if (history.length > HISTORY_LIMIT) history.shift()
  historyIndex = history.length - 1
  updateHistoryButtons()
}

async function loadHistory(index) {
  if (!canvas || index < 0 || index >= history.length) return
  historyLocked = true
  try {
    canvas.discardActiveObject()
    syncSelectedObject(null)
    await canvas.loadFromJSON(JSON.parse(history[index]))
    normalizeLoadedObjects()
    canvas.requestRenderAll()
    historyIndex = index
    updateHistoryButtons()
  } finally {
    historyLocked = false
  }
}

function undo() {
  if (canUndo.value) loadHistory(historyIndex - 1)
}

function redo() {
  if (canRedo.value) loadHistory(historyIndex + 1)
}

async function restoreOriginal() {
  if (!canvas) return
  historyLocked = true
  try {
    canvas.clear()
    canvas.backgroundColor = '#eef0f3'
    await createBaseImage()
    resetViewport()
    resizeCanvasDisplay()
    syncSelectedObject(null)
  } catch (error) {
    ElMessage.error(error.message || '原图恢复失败')
  } finally {
    historyLocked = false
  }
  captureHistory()
}

async function saveResult() {
  if (!canvas || !props.image?.id) return
  saving.value = true
  const viewportTransform = [...canvas.viewportTransform]
  try {
    canvas.discardActiveObject()
    syncSelectedObject(null)
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    canvas.requestRenderAll()
    const scene = {
      ...canvas.toJSON(CUSTOM_PROPERTIES),
      width: canvas.getWidth(),
      height: canvas.getHeight()
    }
    const blob = await canvas.toBlob({ format: 'png', multiplier: 1, enableRetinaScaling: false })
    if (!blob) throw new Error('图片导出失败')
    const fileName = `${safeBaseName()}-效果图.png`
    const file = new File([blob], fileName, { type: 'image/png' })
    emit('save', {
      materialImageId: props.image.id,
      file,
      previewUrl: URL.createObjectURL(blob),
      scene
    })
    dialogVisible.value = false
  } catch (error) {
    console.error('[StyleEditor] 保存失败:', error)
    ElMessage.error(error.message || '成品保存失败')
  } finally {
    if (canvas) {
      canvas.setViewportTransform(viewportTransform)
      canvas.requestRenderAll()
    }
    saving.value = false
  }
}

function disposeCanvasOnly() {
  clearTimeout(historyTimer)
  if (canvas) {
    setPanMode(false)
    unbindPanEvents()
    canvas.dispose()
    canvas = null
  }
  selectedObject.value = null
}

function disposeEditor() {
  disposeCanvasOnly()
  history = []
  historyIndex = -1
  canUndo.value = false
  canRedo.value = false
  panMode.value = false
  zoom.value = 1
  viewportX.value = 0
  viewportY.value = 0
  eyedropperActive.value = false
}

function handleResize() {
  if (dialogVisible.value) resizeCanvasDisplay()
}

window.addEventListener('resize', handleResize)
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  disposeEditor()
})
</script>

<style scoped>
.style-editor-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 16px;
  min-height: 620px;
  max-height: 76vh;
}
.style-editor-workspace {
  display: grid;
  grid-template-rows: minmax(0, 1fr) 32px;
  min-width: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  overflow: hidden;
  background: #dfe2e7;
}
.style-editor-viewport {
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 12px;
}
.style-editor-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-top: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.style-editor-tools {
  min-width: 0;
  overflow-y: auto;
  padding-right: 4px;
}
.tool-section {
  padding: 0 0 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.tool-section h3 {
  margin: 0 0 12px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  letter-spacing: 0;
}
.tool-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tool-row .el-button + .el-button { margin-left: 0; }
.file-input { display: none; }
.property-row,
.property-column {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.property-row { align-items: center; justify-content: space-between; }
.property-column { flex-direction: column; gap: 7px; }
.property-row > span { flex: 0 0 auto; }
.property-row :deep(.el-input-number) { width: 132px; }
.property-column :deep(.el-slider) { margin: 0 10px; width: calc(100% - 20px); }
.color-with-clear { display: flex; align-items: center; gap: 4px; }
.image-color-tools {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.property-title {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 700;
}
.color-pick-row { display: flex; align-items: center; gap: 8px; }
.color-swatch {
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  box-shadow: inset 0 0 0 2px var(--el-bg-color);
}
.layer-actions { display: flex; gap: 8px; margin-top: 16px; }
.layer-actions .el-button + .el-button { margin-left: 0; }
.style-editor-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.history-actions { display: flex; align-items: center; gap: 8px; }
.history-actions .el-button + .el-button { margin-left: 0; }

@media (max-width: 900px) {
  .style-editor-shell {
    grid-template-columns: 1fr;
    min-height: 0;
    max-height: 72vh;
    overflow-y: auto;
  }
  .style-editor-workspace { min-height: 480px; }
  .style-editor-tools { overflow: visible; }
}
</style>

<style>
.style-image-editor-dialog .el-dialog__body {
  padding: 14px 20px;
  overflow: hidden;
}
</style>
