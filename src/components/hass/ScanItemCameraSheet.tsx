import { useCallback, useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { useHass } from '@hakit/core'
import { Description } from '../core/Description'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet, type ModalSheetStyle } from '../core/ModalSheet'
import { NativePickerField } from '../core/NativePickerField'
import { RadioRow } from '../core/RadioRow'
import styles from './ScanItemCameraSheet.module.css'

interface ScanItemCameraSheetProps {
  defaultLocation?: EverShelfLocation
  open: boolean
  onClose: () => void
}

type CameraMode = 'barcode' | 'expiry'
type ScanStep = CameraMode | 'review' | 'adding'
type ProcessingMode = 'barcode' | 'expiry' | null
type CameraStatus = 'idle' | 'starting' | 'ready' | 'error'
type LookupStatus = 'idle' | 'scanning' | 'resolving' | 'found' | 'not-found' | 'error'
type ExpiryStatus = 'idle' | 'ready' | 'reading' | 'found' | 'not-found' | 'error'
type AddItemStatus = 'idle' | 'adding' | 'added' | 'error'
export type EverShelfLocation = 'dispensa' | 'frigo' | 'freezer' | 'spice_rack' | 'cabinet' | 'altro'
type QuickExpirationValue = '3-days' | '1-week' | '1-month' | '6-months' | '1-year'
type CallService = <Response extends object>(params: Record<string, unknown>) => Promise<{ response: Response }> | void
type BarcodeFormatEnum = typeof import('@zxing/browser')['BarcodeFormat']

interface EverShelfProduct {
  barcode?: number | string
  brand?: string
  brands?: string
  category?: string
  default_quantity?: number | string
  id?: number | string
  image?: string
  image_url?: string
  name?: string
  product_name?: string
  quantity?: string
  title?: string
  [key: string]: unknown
}

interface EverShelfBarcodeResult {
  barcode?: number | string
  error?: string
  found?: boolean
  message?: string
  product?: EverShelfProduct
  service_response?: EverShelfBarcodeResult
  source?: string
  [key: string]: unknown
}

interface EverShelfExpiryResult {
  date?: string
  error?: string
  expiry_date?: string
  found?: boolean
  http_code?: number | string
  raw_text?: string
  service_response?: EverShelfExpiryResult
  source?: string
  success?: boolean
  [key: string]: unknown
}

interface EverShelfAddItemResult {
  error?: string
  inventory?: {
    new_qty?: number | string
    total_qty?: number | string
    unit?: string
    [key: string]: unknown
  }
  message?: string
  product_id?: number | string
  service_response?: EverShelfAddItemResult
  success?: boolean
  [key: string]: unknown
}

const SCAN_ITEM_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-max-width': '560px',
  '--modal-desktop-width': '560px',
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    aspectRatio: { ideal: 16 / 9 },
    facingMode: { ideal: 'environment' },
    height: { ideal: 720 },
    width: { ideal: 1280 },
  },
}
const SECURE_CONTEXT_MESSAGE = 'Camera access requires a secure origin. Use HTTPS for the Home Assistant wrapper, or localhost/127.0.0.1 during local development.'
const UNSUPPORTED_CAMERA_MESSAGE = 'This browser does not expose camera access to React Dash.'
const TRANSIENT_SCAN_ERRORS = new Set(['ChecksumException', 'FormatException', 'NotFoundException'])
const EVERSHELF_LOCATIONS: { label: string, value: EverShelfLocation }[] = [
  { label: 'Pantry', value: 'dispensa' },
  { label: 'Fridge', value: 'frigo' },
  { label: 'Freezer', value: 'freezer' },
  { label: 'Spice Rack', value: 'spice_rack' },
  { label: 'Cabinet', value: 'cabinet' },
  { label: 'Library', value: 'altro' },
]
const QUICK_EXPIRATION_OPTIONS: { label: string, value: QuickExpirationValue }[] = [
  { label: 'In 3 Days', value: '3-days' },
  { label: 'In 1 Week', value: '1-week' },
  { label: 'In 1 Month', value: '1-month' },
  { label: 'In 6 Months', value: '6-months' },
  { label: 'In 1 Year', value: '1-year' },
]

function locationLabel(value: EverShelfLocation) {
  return EVERSHELF_LOCATIONS.find((location) => location.value === value)?.label ?? 'Pantry'
}

function locationDestination(value: EverShelfLocation) {
  if (value === 'dispensa') return 'pantry'
  if (value === 'frigo') return 'fridge'
  if (value === 'freezer') return 'freezer'
  if (value === 'spice_rack') return 'spice rack'
  if (value === 'cabinet') return 'cabinet'
  return 'library'
}

function cameraAccessErrorMessage(error: unknown) {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'Camera permission was denied. Allow camera access and try again.'
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'No usable camera was found on this device.'
    if (error.name === 'NotReadableError') return 'The camera is already in use or could not be started.'
  }

  return error instanceof Error ? error.message : 'Unable to start the camera.'
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

function visibleVideoCrop(video: HTMLVideoElement) {
  const videoWidth = video.videoWidth
  const videoHeight = video.videoHeight
  const rect = video.getBoundingClientRect()
  const viewportAspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : videoWidth / videoHeight
  const videoAspect = videoWidth / videoHeight
  if (videoAspect > viewportAspect) {
    const sourceWidth = Math.round(videoHeight * viewportAspect)
    return {
      sourceHeight: videoHeight,
      sourceWidth,
      sourceX: Math.round((videoWidth - sourceWidth) / 2),
      sourceY: 0,
    }
  }

  const sourceHeight = Math.round(videoWidth / viewportAspect)
  return {
    sourceHeight,
    sourceWidth: videoWidth,
    sourceX: 0,
    sourceY: Math.round((videoHeight - sourceHeight) / 2),
  }
}

function barcodeFormats(BarcodeFormat: BarcodeFormatEnum) {
  return [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
  ]
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function productNameValue(product?: EverShelfProduct) {
  return stringValue(product?.name ?? product?.product_name ?? product?.title)
}

function productBrand(product?: EverShelfProduct) {
  return stringValue(product?.brand ?? product?.brands)
}

function productCategory(product?: EverShelfProduct) {
  return stringValue(product?.category)
}

function productId(product?: EverShelfProduct) {
  const rawId = product?.id
  const id = typeof rawId === 'number' ? rawId : Number(stringValue(rawId))
  return Number.isFinite(id) && id > 0 ? id : null
}

function productImage(product?: EverShelfProduct) {
  return stringValue(product?.image_url ?? product?.image)
}

function productDefaultQuantity(product?: EverShelfProduct) {
  const quantity = Number(product?.default_quantity)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null
}

function serviceResponsePayload<T extends { service_response?: T }>(response: { response: T } | void) {
  const payload = response?.response
  return payload?.service_response ?? payload
}

function scannerErrorName(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error ? String((error as { name?: unknown }).name) : ''
}

function scannerErrorRawMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: unknown }).message) : ''
}

function isTransientScannerError(error: unknown) {
  if (TRANSIENT_SCAN_ERRORS.has(scannerErrorName(error))) return true
  const message = scannerErrorRawMessage(error).toLowerCase()
  return message.includes('no multiformat readers')
    || message.includes('notfoundexception')
    || message.includes('no barcode')
}

function scannerErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  const name = scannerErrorName(error)
  const message = scannerErrorRawMessage(error)
  if (message) return message
  return name ? `Barcode scanner failed with ${name}.` : 'Barcode scanner failed.'
}

function expiryDateValue(result: EverShelfExpiryResult | null) {
  return result?.expiry_date ?? result?.date ?? null
}

function formatExpiryDate(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  if (!match) return dateValue
  const [, year, month, day] = match
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(Number(year), Number(month) - 1, Number(day)))
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayDate() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
  nextDate.setDate(Math.min(date.getDate(), lastDay))
  return nextDate
}

function quickExpirationDateValue(value: QuickExpirationValue) {
  const today = todayDate()
  if (value === '3-days') return dateInputValue(addDays(today, 3))
  if (value === '1-week') return dateInputValue(addDays(today, 7))
  if (value === '1-month') return dateInputValue(addMonths(today, 1))
  if (value === '6-months') return dateInputValue(addMonths(today, 6))
  return dateInputValue(addMonths(today, 12))
}

function selectedQuickExpirationValue(dateValue: string) {
  return QUICK_EXPIRATION_OPTIONS.find((option) => quickExpirationDateValue(option.value) === dateValue)?.value ?? null
}

function expiryResultFound(result: EverShelfExpiryResult | null) {
  return Boolean(result && (result.success === true || result.found === true) && expiryDateValue(result))
}

function isAiRateLimitError(message: string, httpCode: unknown) {
  const code = typeof httpCode === 'number' ? httpCode : Number(stringValue(httpCode))
  const normalized = message.toLowerCase()
  return code === 429
    || normalized.includes('429')
    || normalized.includes('too many requests')
    || normalized.includes('quota')
    || normalized.includes('rate limit')
}

function expirationReadErrorMessage(message: string, httpCode?: unknown) {
  if (isAiRateLimitError(message, httpCode)) {
    return 'AI-based expiration date parsing is unavailable. Please enter the expiration date manually or try again later.'
  }
  return message || 'Unable to read expiration date.'
}

export function ScanItemCameraSheet({ defaultLocation = 'dispensa', open, onClose }: ScanItemCameraSheetProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const scanSessionIdRef = useRef(0)
  const cameraRequestIdRef = useRef(0)
  const serviceRequestIdRef = useRef(0)
  const lastScannedBarcodeRef = useRef<string | null>(null)
  const [step, setStep] = useState<ScanStep>('barcode')
  const [activeMode, setActiveMode] = useState<CameraMode | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [processingMode, setProcessingMode] = useState<ProcessingMode>(null)
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null)
  const [lookupResult, setLookupResult] = useState<EverShelfBarcodeResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [barcodeCameraHidden, setBarcodeCameraHidden] = useState(false)
  const [expiryStatus, setExpiryStatus] = useState<ExpiryStatus>('idle')
  const [expiryResult, setExpiryResult] = useState<EverShelfExpiryResult | null>(null)
  const [expiryError, setExpiryError] = useState<string | null>(null)
  const [expiryCameraHidden, setExpiryCameraHidden] = useState(true)
  const [hasSuccessfulExpiryRead, setHasSuccessfulExpiryRead] = useState(false)
  const [itemName, setItemName] = useState('')
  const [itemBrand, setItemBrand] = useState('')
  const [itemQuantity, setItemQuantity] = useState('1')
  const [itemLocation, setItemLocation] = useState<EverShelfLocation>(defaultLocation)
  const [itemExpiryDate, setItemExpiryDate] = useState('')
  const [addStatus, setAddStatus] = useState<AddItemStatus>('idle')
  const [addError, setAddError] = useState<string | null>(null)

  const stopBarcodeScanner = useCallback(() => {
    scanSessionIdRef.current += 1
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
  }, [])

  const stopActiveStream = useCallback(() => {
    cameraRequestIdRef.current += 1
    stopBarcodeScanner()
    if (streamRef.current) {
      stopStream(streamRef.current)
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [stopBarcodeScanner])

  const hideActiveCamera = useCallback(() => {
    stopActiveStream()
    setActiveMode(null)
    setStatus('idle')
  }, [stopActiveStream])

  const resetAll = useCallback(() => {
    serviceRequestIdRef.current += 1
    lastScannedBarcodeRef.current = null
    setStep('barcode')
    setActiveMode(null)
    setStatus('idle')
    setError(null)
    setProcessingMode(null)
    setLookupStatus('idle')
    setDetectedBarcode(null)
    setLookupResult(null)
    setLookupError(null)
    setBarcodeCameraHidden(false)
    setExpiryStatus('idle')
    setExpiryResult(null)
    setExpiryError(null)
    setExpiryCameraHidden(true)
    setHasSuccessfulExpiryRead(false)
    setItemName('')
    setItemBrand('')
    setItemQuantity('1')
    setItemLocation(defaultLocation)
    setItemExpiryDate('')
    setAddStatus('idle')
    setAddError(null)
  }, [defaultLocation])

  const resolveBarcode = useCallback(async (barcode: string) => {
    const requestId = serviceRequestIdRef.current + 1
    serviceRequestIdRef.current = requestId
    setDetectedBarcode(barcode)
    setLookupStatus('resolving')
    setLookupResult(null)
    setLookupError(null)

    try {
      const response = await Promise.resolve(
        callService<EverShelfBarcodeResult>({
          domain: 'evershelf',
          service: 'resolve_barcode',
          serviceData: { barcode },
          returnResponse: true,
        }),
      )
      if (serviceRequestIdRef.current !== requestId) return
      const payload = serviceResponsePayload(response)
      if (!payload) throw new Error('Barcode lookup did not return a response.')
      setLookupResult(payload)
      setLookupStatus(payload.found ? 'found' : 'not-found')
      if (payload.found && payload.product) {
        const nextName = productNameValue(payload.product)
        if (nextName) setItemName(nextName)
        setItemBrand(productBrand(payload.product))
        setAddStatus('idle')
        setAddError(null)
      }
    } catch (caughtError: unknown) {
      if (serviceRequestIdRef.current !== requestId) return
      setLookupStatus('error')
      setLookupError(caughtError instanceof Error ? caughtError.message : 'Unable to resolve barcode.')
    } finally {
      if (serviceRequestIdRef.current === requestId) setProcessingMode(null)
    }
  }, [callService])

  const startBarcodeScanner = useCallback(async (video: HTMLVideoElement) => {
    const scanSessionId = scanSessionIdRef.current + 1
    scanSessionIdRef.current = scanSessionId
    scannerControlsRef.current?.stop()
    scannerControlsRef.current = null
    setLookupStatus('scanning')
    setLookupError(null)

    const { BarcodeFormat, BrowserMultiFormatReader } = await import('@zxing/browser')
    const reader = new BrowserMultiFormatReader(undefined, {
      delayBetweenScanAttempts: 160,
      delayBetweenScanSuccess: 800,
      tryPlayVideoTimeout: 5000,
    })
    reader.possibleFormats = barcodeFormats(BarcodeFormat)
    const controls = await reader.decodeFromVideoElement(video, (result, scannerError, currentControls) => {
      if (scanSessionIdRef.current !== scanSessionId) return
      if (result) {
        const barcode = result.getText().trim()
        if (!barcode || lastScannedBarcodeRef.current === barcode) return
        lastScannedBarcodeRef.current = barcode
        setProcessingMode('barcode')
        setBarcodeCameraHidden(true)
        currentControls.stop()
        scannerControlsRef.current = null
        scanSessionIdRef.current += 1
        hideActiveCamera()
        void resolveBarcode(barcode)
        return
      }

      if (scannerError && !isTransientScannerError(scannerError)) {
        setLookupStatus('error')
        setLookupError(scannerErrorMessage(scannerError))
      }
    })
    if (scanSessionIdRef.current !== scanSessionId || lastScannedBarcodeRef.current) {
      controls.stop()
      return
    }
    scannerControlsRef.current = controls
  }, [hideActiveCamera, resolveBarcode])

  const startCamera = useCallback(async (mode: CameraMode, options: { resetScan?: boolean, resetExpiry?: boolean } = {}) => {
    stopActiveStream()
    const requestId = cameraRequestIdRef.current + 1
    cameraRequestIdRef.current = requestId
    setActiveMode(mode)
    setStatus('starting')
    setError(null)
    if (mode === 'barcode') {
      setBarcodeCameraHidden(false)
      serviceRequestIdRef.current += 1
      if (options.resetScan || !detectedBarcode) {
        lastScannedBarcodeRef.current = null
        if (options.resetScan) setDetectedBarcode(null)
        setLookupResult(null)
        setLookupError(null)
        setLookupStatus('idle')
      }
    } else {
      setExpiryCameraHidden(false)
      serviceRequestIdRef.current += 1
      if (options.resetExpiry || !expiryResult) {
        if (options.resetExpiry) setExpiryResult(null)
        setExpiryError(null)
        setExpiryStatus('idle')
      }
    }

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setStatus('error')
      setError(SECURE_CONTEXT_MESSAGE)
      return
    }

    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setStatus('error')
      setError(UNSUPPORTED_CAMERA_MESSAGE)
      return
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    if (cameraRequestIdRef.current !== requestId) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
      if (cameraRequestIdRef.current !== requestId) {
        stopStream(stream)
        return
      }

      streamRef.current = stream
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      if (cameraRequestIdRef.current !== requestId || !videoRef.current) {
        stopStream(stream)
        return
      }
      setStatus('ready')
      if (mode === 'barcode') {
        void startBarcodeScanner(videoRef.current).catch((caughtError: unknown) => {
          if (cameraRequestIdRef.current !== requestId) return
          setLookupStatus('error')
          setLookupError(scannerErrorMessage(caughtError))
        })
      } else {
        setExpiryStatus('ready')
      }
    } catch (caughtError: unknown) {
      if (cameraRequestIdRef.current !== requestId) return
      stopActiveStream()
      setStatus('error')
      setError(cameraAccessErrorMessage(caughtError))
    }
  }, [detectedBarcode, expiryResult, startBarcodeScanner, stopActiveStream])

  useEffect(() => {
    if (open) return undefined
    stopActiveStream()
    return undefined
  }, [open, stopActiveStream])

  useEffect(() => {
    if (!open || activeMode || status !== 'idle') return
    let mode: CameraMode | null = null
    if (step === 'barcode' && !barcodeCameraHidden) {
      mode = 'barcode'
    } else if (step === 'expiry' && !expiryCameraHidden) {
      mode = 'expiry'
    }

    if (!mode) return
    const timeout = window.setTimeout(() => void startCamera(mode), 0)
    return () => window.clearTimeout(timeout)
  }, [activeMode, barcodeCameraHidden, detectedBarcode, expiryCameraHidden, expiryResult, expiryStatus, lookupStatus, open, startCamera, status, step])

  useEffect(() => {
    if (!open || step !== 'barcode' || activeMode !== 'barcode' || status !== 'ready' || detectedBarcode || lookupStatus !== 'idle') return

    const timeout = window.setTimeout(() => {
      if (!videoRef.current || !streamRef.current || scannerControlsRef.current) return
      void startBarcodeScanner(videoRef.current).catch((caughtError: unknown) => {
        setLookupStatus('error')
        setLookupError(scannerErrorMessage(caughtError))
      })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [activeMode, detectedBarcode, lookupStatus, open, startBarcodeScanner, status, step])

  useEffect(() => {
    if (!open || !videoRef.current || !streamRef.current || activeMode !== step || status !== 'ready') return
    if (videoRef.current.srcObject === streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play()
  }, [activeMode, open, processingMode, status, step])

  const handleClose = () => {
    stopActiveStream()
    resetAll()
    onClose()
  }

  const goToBarcodeStep = () => {
    cameraRequestIdRef.current += 1
    serviceRequestIdRef.current += 1
    stopBarcodeScanner()
    setStep('barcode')
    if (barcodeCameraHidden) {
      hideActiveCamera()
    } else {
      setActiveMode(streamRef.current ? 'barcode' : null)
      setStatus(streamRef.current ? 'ready' : 'idle')
    }
    setError(null)
    setProcessingMode(null)
    if (!detectedBarcode) {
      lastScannedBarcodeRef.current = null
      setLookupStatus('idle')
      setLookupError(null)
    }
    if (!expiryResult) {
      setExpiryStatus('idle')
      setExpiryError(null)
    }
  }

  const goToExpiryStep = () => {
    cameraRequestIdRef.current += 1
    serviceRequestIdRef.current += 1
    stopBarcodeScanner()
    hideActiveCamera()
    setStep('expiry')
    setExpiryCameraHidden(true)
    setError(null)
    setProcessingMode(null)
    if (!detectedBarcode) {
      setLookupStatus('idle')
      setLookupError(null)
    }
    if (!expiryResult) {
      setExpiryStatus('idle')
      setExpiryError(null)
    }
  }

  const goToReviewStep = () => {
    cameraRequestIdRef.current += 1
    serviceRequestIdRef.current += 1
    stopActiveStream()
    setStep('review')
    setActiveMode(null)
    setStatus('idle')
    setError(null)
    setProcessingMode(null)
  }

  const manuallyEnterName = () => {
    setBarcodeCameraHidden(true)
    hideActiveCamera()
    setError(null)
    if (!detectedBarcode) {
      lastScannedBarcodeRef.current = null
      setLookupStatus('idle')
      setLookupError(null)
    }
  }

  const scanBarcodeAgain = () => {
    serviceRequestIdRef.current += 1
    lastScannedBarcodeRef.current = null
    setBarcodeCameraHidden(false)
    setDetectedBarcode(null)
    setLookupResult(null)
    setLookupError(null)
    setLookupStatus('idle')
    setError(null)
    void startCamera('barcode', { resetScan: true })
  }

  const manuallyEnterExpirationDate = () => {
    setExpiryCameraHidden(true)
    hideActiveCamera()
    setError(null)
    if (!itemExpiryDate) {
      setExpiryStatus('idle')
      setExpiryError(null)
    }
  }

  const readExpirationDateAgain = () => {
    serviceRequestIdRef.current += 1
    setExpiryCameraHidden(false)
    setExpiryStatus('idle')
    setExpiryError(null)
    setError(null)
    void startCamera('expiry', { resetExpiry: true })
  }

  const updateItemQuantity = (value: string) => {
    const nextQuantity = Number(value)
    if (!Number.isFinite(nextQuantity)) {
      setItemQuantity('1')
      return
    }
    setItemQuantity(String(Math.max(1, Math.floor(nextQuantity))))
  }

  const updateItemExpiryDate = (value: string) => {
    setItemExpiryDate(value)
    setExpiryError(null)
    setAddStatus('idle')
    setAddError(null)
    if (expiryStatus === 'error' || expiryStatus === 'not-found') setExpiryStatus('idle')
  }

  const selectQuickExpirationDate = (value: QuickExpirationValue) => {
    updateItemExpiryDate(quickExpirationDateValue(value))
  }

  const captureCurrentFrame = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight || video.readyState < 2) {
      setError('The camera is still warming up. Try again in a moment.')
      return null
    }

    const canvas = document.createElement('canvas')
    const crop = visibleVideoCrop(video)
    canvas.width = crop.sourceWidth
    canvas.height = crop.sourceHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setError('Unable to capture an image from this camera feed.')
      return null
    }

    context.drawImage(video, crop.sourceX, crop.sourceY, crop.sourceWidth, crop.sourceHeight, 0, 0, canvas.width, canvas.height)
    setError(null)
    return canvas.toDataURL('image/jpeg')
  }

  const readExpirationDate = async () => {
    const image = captureCurrentFrame()
    if (!image) return

    const requestId = serviceRequestIdRef.current + 1
    serviceRequestIdRef.current = requestId
    setProcessingMode('expiry')
    setExpiryCameraHidden(true)
    hideActiveCamera()
    setExpiryStatus('reading')
    setExpiryResult(null)
    setExpiryError(null)

    try {
      const response = await Promise.resolve(
        callService<EverShelfExpiryResult>({
          domain: 'evershelf',
          service: 'read_expiry_image',
          serviceData: { image },
          returnResponse: true,
        }),
      )
      if (serviceRequestIdRef.current !== requestId) return
      const payload = serviceResponsePayload(response)
      if (!payload) throw new Error('Expiration reader did not return a response.')
      setExpiryResult(payload)
      if (expiryResultFound(payload)) {
        setExpiryStatus('found')
        setItemExpiryDate(expiryDateValue(payload) ?? '')
        setHasSuccessfulExpiryRead(true)
        setAddStatus('idle')
        setAddError(null)
      } else if (payload.error) {
        setExpiryStatus('error')
        setExpiryError(expirationReadErrorMessage(String(payload.error), payload.http_code))
      } else {
        setExpiryStatus('not-found')
      }
    } catch (caughtError: unknown) {
      if (serviceRequestIdRef.current !== requestId) return
      setExpiryStatus('error')
      setExpiryError(expirationReadErrorMessage(caughtError instanceof Error ? caughtError.message : 'Unable to read expiration date.'))
    } finally {
      if (serviceRequestIdRef.current === requestId) setProcessingMode(null)
    }
  }

  const addScannedItem = async () => {
    const name = itemName.trim()
    const quantity = Number(itemQuantity)
    if (!name) {
      setAddStatus('error')
      setAddError(`Product name is required before adding to ${addedLocation}.`)
      return
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAddStatus('error')
      setAddError('Quantity must be greater than zero.')
      return
    }

    const product = lookupResult?.found ? lookupResult.product : undefined
    const serviceData: Record<string, unknown> = {
      location: itemLocation,
      name,
      quantity,
    }
    const existingProductId = productId(product)
    const barcode = stringValue(detectedBarcode ?? lookupResult?.barcode ?? product?.barcode)
    const brand = itemBrand.trim() || productBrand(product)
    const category = productCategory(product)
    const imageUrl = productImage(product)
    const defaultQuantity = productDefaultQuantity(product)
    const expiryDate = itemExpiryDate.trim()

    if (existingProductId) serviceData.product_id = existingProductId
    if (barcode) serviceData.barcode = barcode
    if (brand) serviceData.brand = brand
    if (category) serviceData.category = category
    if (imageUrl) serviceData.image_url = imageUrl
    if (defaultQuantity) serviceData.default_quantity = defaultQuantity
    if (expiryDate) {
      serviceData.expiry_date = expiryDate
      serviceData.expiry_user_set = true
    }

    const requestId = serviceRequestIdRef.current + 1
    serviceRequestIdRef.current = requestId
    setAddStatus('adding')
    setAddError(null)
    setStep('adding')

    try {
      const response = await Promise.resolve(
        callService<EverShelfAddItemResult>({
          domain: 'evershelf',
          service: 'add_scanned_item',
          serviceData,
          returnResponse: true,
        }),
      )
      if (serviceRequestIdRef.current !== requestId) return
      const payload = serviceResponsePayload(response)
      if (!payload || payload.success === false) throw new Error(payload?.message ?? payload?.error ?? `Could not add this item to ${addedLocation}.`)
      setAddStatus('added')
    } catch (caughtError: unknown) {
      if (serviceRequestIdRef.current !== requestId) return
      setAddStatus('error')
      setAddError(caughtError instanceof Error ? caughtError.message : `Unable to add this item to ${addedLocation}.`)
      setStep('review')
    }
  }

  const barcodeStatusText = () => {
    if (lookupStatus === 'resolving' && detectedBarcode) return `Looking up ${detectedBarcode}...`
    if (lookupStatus === 'found' && detectedBarcode) return `Barcode matched ${detectedBarcode}.`
    if (lookupStatus === 'not-found' && detectedBarcode) return `No barcode match found for ${detectedBarcode}.`
    if (lookupStatus === 'error') return lookupError ?? 'Unable to scan this barcode.'
    return 'Scanning for a barcode...'
  }

  const expiryStatusText = () => {
    const expiryDate = expiryDateValue(expiryResult)
    if (expiryStatus === 'ready') return 'Camera ready. Capture the printed expiration date when it is readable.'
    if (expiryStatus === 'reading') return 'Reading expiration date...'
    if (expiryStatus === 'found' && expiryDate) return `Expiration date found: ${formatExpiryDate(expiryDate)}.`
    if (expiryStatus === 'not-found') return 'No expiration date found in that image.'
    if (expiryStatus === 'error') return expiryError ?? 'Unable to read expiration date.'
    return 'Frame the printed expiration date inside the camera window.'
  }

  const isBarcodeCameraVisible = step === 'barcode' && !barcodeCameraHidden && activeMode === 'barcode' && status !== 'idle'
  const isExpiryCameraVisible = step === 'expiry' && !expiryCameraHidden && activeMode === 'expiry' && status !== 'idle'
  const isCameraVisible = isBarcodeCameraVisible || isExpiryCameraVisible
  const showBarcodeNameField = step === 'barcode' && barcodeCameraHidden
  const showExpiryDateField = step === 'expiry' && expiryCameraHidden
  const activeStatus = step === 'expiry' ? expiryStatus : lookupStatus
  const isProcessing = processingMode === step && (lookupStatus === 'resolving' || expiryStatus === 'reading')
  const showBarcodeScanStatus = step === 'barcode' && (lookupStatus === 'error' || lookupStatus === 'not-found')
  const showExpiryScanStatus = step === 'expiry' && (expiryStatus === 'error' || expiryStatus === 'not-found')
  const itemQuantityValue = Number(itemQuantity)
  const canAddItem = itemName.trim().length > 0 && Number.isFinite(itemQuantityValue) && itemQuantityValue >= 1 && addStatus !== 'adding' && expiryStatus !== 'reading'
  const canReadExpiry = addStatus !== 'added' && isExpiryCameraVisible && status === 'ready' && expiryStatus !== 'reading'
  const readExpiryLabel = hasSuccessfulExpiryRead ? 'Read Expiration Date Again' : 'Read Expiration Date'
  const hasBarcodeForwardValue = Boolean(itemName.trim() || detectedBarcode || lookupResult)
  const hasExpiryForwardValue = Boolean(itemExpiryDate.trim() || expiryResultFound(expiryResult))
  const barcodeForwardLabel = barcodeCameraHidden || hasBarcodeForwardValue ? 'Next' : 'Skip Barcode'
  const barcodeForwardDisabled = lookupStatus === 'resolving' || (barcodeCameraHidden && !itemName.trim())
  const barcodeScanButtonLabel = detectedBarcode ? 'Scan Barcode Again' : 'Scan Barcode'
  const expiryReadButtonLabel = hasSuccessfulExpiryRead ? 'Read Expiration Date Again' : 'Read Expiration Date'
  const selectedQuickExpiration = selectedQuickExpirationValue(itemExpiryDate)
  const expiryForwardLabel = expiryCameraHidden || hasExpiryForwardValue ? 'Next' : 'Skip Expiration'
  const expiryForwardDisabled = expiryStatus === 'reading' || (expiryCameraHidden && !hasExpiryForwardValue)
  const addedLocation = locationLabel(itemLocation)
  const reviewDestination = locationDestination(itemLocation)
  const backLabel = step === 'expiry' ? 'Back to barcode scan' : step === 'review' ? 'Back to expiration date' : undefined
  const onBack = step === 'expiry' ? goToBarcodeStep : step === 'review' ? goToExpiryStep : undefined
  const subtitle = step === 'barcode'
    ? `${barcodeCameraHidden ? 'Enter Product Name' : 'Scan Barcode'} · Step 1 of 3`
    : step === 'expiry'
      ? 'Expiration Date · Step 2 of 3'
      : step === 'review'
        ? 'Review Item · Step 3 of 3'
        : addStatus === 'added'
          ? 'Item Added'
          : 'Adding Item'
  const barcodeDescription = barcodeCameraHidden
    ? 'Review or enter the product name before continuing.'
    : 'Use the product barcode to look up item details\n\nCenter the barcode inside the camera window and hold steady.'
  const expiryDescription = expiryCameraHidden
    ? hasSuccessfulExpiryRead
      ? 'Review or adjust the expiration date before continuing.'
      : 'Enter the expiration date manually, or read it from the camera.'
    : 'Take a clear photo of the printed expiration date\n\nCenter the printed expiration date inside the camera window and keep the label flat.'

  const footer = isProcessing || (step === 'adding' && addStatus === 'adding') ? undefined : (
    <div className={styles.actions} data-layout={step} data-has-preview={detectedBarcode ? 'true' : 'false'}>
      {step === 'barcode' && (
        <button className={hasBarcodeForwardValue ? styles.primaryAction : styles.secondaryAction} disabled={barcodeForwardDisabled} onClick={goToExpiryStep} type="button">
          {barcodeForwardLabel}
        </button>
      )}
      {step === 'expiry' && canReadExpiry && (
        <button className={styles.primaryAction} onClick={() => void readExpirationDate()} type="button">
          {readExpiryLabel}
        </button>
      )}
      {step === 'expiry' && (
        <button className={hasExpiryForwardValue ? styles.primaryAction : styles.secondaryAction} disabled={expiryForwardDisabled} onClick={goToReviewStep} type="button">
          {expiryForwardLabel}
        </button>
      )}
      {step === 'review' && (
        <button className={styles.primaryAction} disabled={!canAddItem} onClick={() => void addScannedItem()} type="button">
          Add
        </button>
      )}
      {step === 'adding' && addStatus === 'added' && (
        <button className={styles.primaryAction} onClick={handleClose} type="button">
          Done
        </button>
      )}
    </div>
  )

  return (
    <ModalSheet
      backLabel={backLabel}
      contentStyle={SCAN_ITEM_MODAL_STYLE}
      footer={footer}
      onBack={onBack}
      onClose={handleClose}
      open={open}
      scrollResetKey={step}
      subtitle={subtitle}
      title="Add Item"
    >
      <div className={styles.sheet} data-processing={isProcessing ? 'true' : 'false'} data-step={step}>
        {isProcessing && (
          <section className={styles.processingPage} aria-live="polite" role="status">
            <div className={styles.spinner} aria-hidden="true" />
            <strong>Processing...</strong>
          </section>
        )}

        {!isProcessing && step === 'barcode' && (
          <Description className={styles.description}>{barcodeDescription}</Description>
        )}

        {!isProcessing && step === 'expiry' && (
          <Description className={styles.description}>{expiryDescription}</Description>
        )}

        {!isProcessing && step === 'review' && (
          <Description className={styles.description}>Confirm the item details before adding it to your {reviewDestination}.</Description>
        )}

        {!isProcessing && isCameraVisible && (
          <div className={styles.cameraFrame} data-status={status}>
            <video aria-label={step === 'barcode' ? 'Live item scan camera feed' : 'Live expiration date camera feed'} autoPlay className={styles.video} muted playsInline ref={videoRef} />
            {status !== 'ready' && (
              <div className={styles.cameraOverlay}>
                <div className={styles.cameraStatus} aria-live="polite">
                  <MaterialIcon name={status === 'error' ? 'mdi:alert-circle' : step === 'barcode' ? 'mdi:barcode-scan' : 'mdi:camera'} size={42} />
                  <span>{status === 'error' ? 'Camera unavailable' : 'Starting camera...'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!isProcessing && isBarcodeCameraVisible && (
          <button className={`${styles.primaryAction} ${styles.fieldAction}`} onClick={manuallyEnterName} type="button">
            Manually Enter Name
          </button>
        )}

        {!isProcessing && isExpiryCameraVisible && (
          <button className={`${styles.primaryAction} ${styles.fieldAction}`} onClick={manuallyEnterExpirationDate} type="button">
            Manually Enter Expiration Date
          </button>
        )}

        {!isProcessing && showBarcodeScanStatus && (
          <div className={styles.scanStatus} data-status={activeStatus} role="status">
            <MaterialIcon name={lookupStatus === 'error' ? 'mdi:alert-circle' : 'mdi:barcode-scan'} size={18} />
            <span>{barcodeStatusText()}</span>
          </div>
        )}

        {!isProcessing && showExpiryScanStatus && (
          <div className={styles.scanStatus} data-status={activeStatus} role="status">
            <MaterialIcon name={expiryStatus === 'error' ? 'mdi:alert-circle' : 'mdi:calendar'} size={18} />
            <span>{expiryStatusText()}</span>
          </div>
        )}

        {!isProcessing && error && <div className={styles.error} role="alert">{error}</div>}

        {!isProcessing && showBarcodeNameField && (
          <>
            <label className={styles.field}>
              <span>What item are you adding?</span>
              <input aria-label="Product name" autoComplete="off" onChange={(event) => setItemName(event.target.value)} type="text" value={itemName} />
            </label>
            <button className={`${styles.primaryAction} ${styles.fieldAction}`} onClick={scanBarcodeAgain} type="button">
              {barcodeScanButtonLabel}
            </button>
          </>
        )}

        {!isProcessing && showExpiryDateField && (
          <>
            <NativePickerField ariaLabel="Expiration date" label="When does it expire?" onChange={updateItemExpiryDate} type="date" value={itemExpiryDate} />
            <fieldset className={styles.quickExpirationFieldset}>
              <legend>Quick Expiration Dates</legend>
              <div className={styles.quickExpirationOptions} role="radiogroup">
                {QUICK_EXPIRATION_OPTIONS.map((option) => (
                  <RadioRow active={selectedQuickExpiration === option.value} key={option.value} onClick={() => selectQuickExpirationDate(option.value)} title={option.label} />
                ))}
              </div>
            </fieldset>
            <button className={`${styles.primaryAction} ${styles.fieldAction}`} onClick={readExpirationDateAgain} type="button">
              {expiryReadButtonLabel}
            </button>
          </>
        )}

        {!isProcessing && step === 'review' && (
          <>
            <label className={styles.field}>
              <span>What item are you adding?</span>
              <input aria-label="Product name" autoComplete="off" onChange={(event) => setItemName(event.target.value)} type="text" value={itemName} />
            </label>
            <label className={styles.field}>
              <span>How many are you adding?</span>
              <input aria-label="Quantity" inputMode="numeric" min="1" onChange={(event) => updateItemQuantity(event.target.value)} step="1" type="number" value={itemQuantity} />
            </label>
            <fieldset className={styles.locationFieldset}>
              <legend>Where should it be stored?</legend>
              <div className={styles.locationOptions} role="radiogroup">
                {EVERSHELF_LOCATIONS.map((location) => (
                  <RadioRow active={itemLocation === location.value} key={location.value} onClick={() => setItemLocation(location.value)} title={location.label} />
                ))}
              </div>
            </fieldset>
            <NativePickerField ariaLabel="Expiration date" label="When does it expire?" onChange={updateItemExpiryDate} type="date" value={itemExpiryDate} />
            {addStatus === 'error' && <div className={styles.error} role="alert">{addError ?? `Unable to add this item to ${addedLocation}.`}</div>}
          </>
        )}

        {step === 'adding' && (
          <section className={styles.addingPage} aria-live="polite">
            {addStatus === 'added' ? (
              <>
                <div className={styles.successIcon} aria-hidden="true">
                  <MaterialIcon name="mdi:check" size={78} />
                </div>
                <strong>Added to {addedLocation}</strong>
              </>
            ) : (
              <>
                <div className={styles.spinner} aria-hidden="true" />
                <strong>Adding to {addedLocation}...</strong>
              </>
            )}
          </section>
        )}
      </div>
    </ModalSheet>
  )
}
