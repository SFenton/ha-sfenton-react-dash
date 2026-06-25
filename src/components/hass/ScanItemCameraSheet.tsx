import { useCallback, useEffect, useRef, useState } from 'react'
import type { IScannerControls } from '@zxing/browser'
import { useHass } from '@hakit/core'
import { Description } from '../core/Description'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet, type ModalSheetStyle } from '../core/ModalSheet'
import styles from './ScanItemCameraSheet.module.css'

interface ScanItemCameraSheetProps {
  open: boolean
  onClose: () => void
}

type CameraMode = 'barcode' | 'expiry'
type CameraStatus = 'idle' | 'starting' | 'ready' | 'error'
type LookupStatus = 'idle' | 'scanning' | 'resolving' | 'found' | 'not-found' | 'error'
type ExpiryStatus = 'idle' | 'ready' | 'reading' | 'found' | 'not-found' | 'error'
type CallService = <Response extends object>(params: Record<string, unknown>) => Promise<{ response: Response }> | void
type BarcodeFormatEnum = typeof import('@zxing/browser')['BarcodeFormat']

interface EverShelfProduct {
  barcode?: number | string
  brand?: string
  brands?: string
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
  raw_text?: string
  service_response?: EverShelfExpiryResult
  source?: string
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

function productName(product?: EverShelfProduct) {
  return product?.name ?? product?.product_name ?? product?.title ?? 'Unknown item'
}

function productBrand(product?: EverShelfProduct) {
  return product?.brand ?? product?.brands
}

function productImage(product?: EverShelfProduct) {
  return product?.image_url ?? product?.image
}

function serviceResponsePayload<T extends { service_response?: T }>(response: { response: T } | void) {
  const payload = response?.response
  return payload?.service_response ?? payload
}

function scannerErrorName(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error ? String((error as { name?: unknown }).name) : ''
}

function scannerErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  const name = scannerErrorName(error)
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

function expiryRelativeLabel(dateValue: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue)
  if (!match) return null
  const [, year, month, day] = match
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(Number(year), Number(month) - 1, Number(day))
  const days = Math.round((expiry.getTime() - today.getTime()) / 86_400_000)
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  if (days > 1) return `Expires in ${days} days`
  if (days === -1) return 'Expired yesterday'
  return `Expired ${Math.abs(days)} days ago`
}

function expiryResultFound(result: EverShelfExpiryResult | null) {
  return Boolean(result && (result.success === true || result.found === true) && expiryDateValue(result))
}

export function ScanItemCameraSheet({ open, onClose }: ScanItemCameraSheetProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scannerControlsRef = useRef<IScannerControls | null>(null)
  const scanSessionIdRef = useRef(0)
  const cameraRequestIdRef = useRef(0)
  const serviceRequestIdRef = useRef(0)
  const lastScannedBarcodeRef = useRef<string | null>(null)
  const [step, setStep] = useState<CameraMode>('barcode')
  const [activeMode, setActiveMode] = useState<CameraMode | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null)
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null)
  const [lookupResult, setLookupResult] = useState<EverShelfBarcodeResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [expiryStatus, setExpiryStatus] = useState<ExpiryStatus>('idle')
  const [expiryResult, setExpiryResult] = useState<EverShelfExpiryResult | null>(null)
  const [expiryError, setExpiryError] = useState<string | null>(null)

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

  const resetAll = useCallback(() => {
    serviceRequestIdRef.current += 1
    lastScannedBarcodeRef.current = null
    setStep('barcode')
    setActiveMode(null)
    setStatus('idle')
    setError(null)
    setCapturedImageUrl(null)
    setLookupStatus('idle')
    setDetectedBarcode(null)
    setLookupResult(null)
    setLookupError(null)
    setExpiryStatus('idle')
    setExpiryResult(null)
    setExpiryError(null)
  }, [])

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
      if (!payload) throw new Error('EverShelf did not return a barcode lookup response.')
      setLookupResult(payload)
      setLookupStatus(payload.found ? 'found' : 'not-found')
    } catch (caughtError: unknown) {
      if (serviceRequestIdRef.current !== requestId) return
      setLookupStatus('error')
      setLookupError(caughtError instanceof Error ? caughtError.message : 'Unable to resolve barcode with EverShelf.')
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
        currentControls.stop()
        scannerControlsRef.current = null
        scanSessionIdRef.current += 1
        void resolveBarcode(barcode)
        return
      }

      if (scannerError && !TRANSIENT_SCAN_ERRORS.has(scannerErrorName(scannerError))) {
        setLookupStatus('error')
        setLookupError(scannerErrorMessage(scannerError))
      }
    })
    if (scanSessionIdRef.current !== scanSessionId || lastScannedBarcodeRef.current) {
      controls.stop()
      return
    }
    scannerControlsRef.current = controls
  }, [resolveBarcode])

  const startCamera = useCallback(async (mode: CameraMode) => {
    stopActiveStream()
    const requestId = cameraRequestIdRef.current + 1
    cameraRequestIdRef.current = requestId
    setActiveMode(mode)
    setStatus('starting')
    setError(null)
    setCapturedImageUrl(null)

    if (mode === 'barcode') {
      serviceRequestIdRef.current += 1
      lastScannedBarcodeRef.current = null
      setDetectedBarcode(null)
      setLookupResult(null)
      setLookupError(null)
      setLookupStatus('idle')
    } else {
      serviceRequestIdRef.current += 1
      setExpiryResult(null)
      setExpiryError(null)
      setExpiryStatus('idle')
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
  }, [startBarcodeScanner, stopActiveStream])

  useEffect(() => {
    if (open) return undefined
    stopActiveStream()
    return undefined
  }, [open, stopActiveStream])

  useEffect(() => {
    if (!open || activeMode || status !== 'idle') return
    let mode: CameraMode | null = null
    if (step === 'barcode' && !detectedBarcode && lookupStatus === 'idle') {
      mode = 'barcode'
    } else if (step === 'expiry' && !expiryResult && expiryStatus === 'idle') {
      mode = 'expiry'
    }

    if (!mode) return
    const timeout = window.setTimeout(() => void startCamera(mode), 0)
    return () => window.clearTimeout(timeout)
  }, [activeMode, detectedBarcode, expiryResult, expiryStatus, lookupStatus, open, startCamera, status, step])

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
    setActiveMode(streamRef.current ? 'barcode' : null)
    setStatus(streamRef.current ? 'ready' : 'idle')
    setError(null)
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
    setStep('expiry')
    setActiveMode(streamRef.current ? 'expiry' : null)
    setStatus(streamRef.current ? 'ready' : 'idle')
    setError(null)
    if (!detectedBarcode) {
      setLookupStatus('idle')
      setLookupError(null)
    }
    if (!expiryResult) {
      setExpiryStatus(streamRef.current ? 'ready' : 'idle')
      setExpiryError(null)
    }
  }

  const captureCurrentFrame = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight || video.readyState < 2) {
      setError('The camera is still warming up. Try again in a moment.')
      return null
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setError('Unable to capture an image from this camera feed.')
      return null
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setError(null)
    return canvas.toDataURL('image/jpeg', 0.86)
  }

  const readExpirationDate = async () => {
    const image = captureCurrentFrame()
    if (!image) return

    const requestId = serviceRequestIdRef.current + 1
    serviceRequestIdRef.current = requestId
    setCapturedImageUrl(image)
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
      if (!payload) throw new Error('EverShelf did not return an expiration image response.')
      setExpiryResult(payload)
      if (expiryResultFound(payload)) {
        setExpiryStatus('found')
      } else if (payload.error) {
        setExpiryStatus('error')
        setExpiryError(String(payload.error))
      } else {
        setExpiryStatus('not-found')
      }
    } catch (caughtError: unknown) {
      if (serviceRequestIdRef.current !== requestId) return
      setExpiryStatus('error')
      setExpiryError(caughtError instanceof Error ? caughtError.message : 'Unable to read expiration date with EverShelf.')
    }
  }

  const barcodeStatusText = () => {
    if (lookupStatus === 'resolving' && detectedBarcode) return `Looking up ${detectedBarcode} in EverShelf...`
    if (lookupStatus === 'found' && detectedBarcode) return `EverShelf matched barcode ${detectedBarcode}.`
    if (lookupStatus === 'not-found' && detectedBarcode) return `EverShelf did not find barcode ${detectedBarcode}.`
    if (lookupStatus === 'error') return lookupError ?? 'Unable to scan this barcode.'
    return 'Scanning for a barcode...'
  }

  const expiryStatusText = () => {
    const expiryDate = expiryDateValue(expiryResult)
    if (expiryStatus === 'ready') return 'Camera ready. Capture the printed expiration date when it is readable.'
    if (expiryStatus === 'reading') return 'Reading expiration date with EverShelf...'
    if (expiryStatus === 'found' && expiryDate) return `EverShelf read ${formatExpiryDate(expiryDate)}.`
    if (expiryStatus === 'not-found') return 'EverShelf did not find an expiration date in that image.'
    if (expiryStatus === 'error') return expiryError ?? 'Unable to read expiration date.'
    return 'Frame the printed expiration date inside the camera window.'
  }

  const activeStatus = step === 'expiry' ? expiryStatus : lookupStatus
  const expiryDate = expiryDateValue(expiryResult)
  const expiryRelative = expiryDate ? expiryRelativeLabel(expiryDate) : null

  const footer = (
    <div className={styles.actions} data-layout={step} data-has-preview={capturedImageUrl || detectedBarcode ? 'true' : 'false'}>
      {step === 'barcode' && (
        <button className={detectedBarcode ? styles.primaryAction : styles.secondaryAction} disabled={lookupStatus === 'resolving'} onClick={goToExpiryStep} type="button">
          {detectedBarcode ? 'Next' : 'Skip Barcode'}
        </button>
      )}
      {step === 'expiry' && expiryStatus === 'ready' && (
        <button className={styles.primaryAction} onClick={() => void readExpirationDate()} type="button">
          Read Expiration Date
        </button>
      )}
      {step === 'expiry' && (
        <button className={expiryResultFound(expiryResult) ? styles.primaryAction : styles.secondaryAction} disabled={expiryStatus === 'reading'} onClick={handleClose} type="button">
          {expiryResultFound(expiryResult) ? 'Done' : 'Skip Expiration'}
        </button>
      )}
    </div>
  )

  return (
    <ModalSheet
      backLabel="Back to barcode scan"
      contentStyle={SCAN_ITEM_MODAL_STYLE}
      footer={footer}
      onBack={step === 'expiry' ? goToBarcodeStep : undefined}
      onClose={handleClose}
      open={open}
      subtitle={step === 'barcode' ? 'Scan Barcode · Step 1 of 2' : 'Expiration Date · Step 2 of 2'}
      title="Scan Item"
    >
      <div className={styles.sheet}>
        {step === 'barcode' && (
          <Description className={styles.description}>{'Use the product barcode to look up item details\n\nCenter the barcode inside the camera window and hold steady.'}</Description>
        )}

        {step === 'expiry' && (
          <Description className={styles.description}>{'Take a clear photo of the printed expiration date\n\nCenter the printed expiration date inside the camera window and keep the label flat.'}</Description>
        )}

        {activeMode === step && status !== 'idle' && (
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

        {step === 'barcode' && (activeMode === 'barcode' || lookupStatus !== 'idle') && (
          <div className={styles.scanStatus} data-status={activeStatus} role="status">
            <MaterialIcon name={lookupStatus === 'found' ? 'mdi:check-circle' : lookupStatus === 'error' ? 'mdi:alert-circle' : 'mdi:barcode-scan'} size={18} />
            <span>{barcodeStatusText()}</span>
          </div>
        )}

        {step === 'expiry' && (activeMode === 'expiry' || expiryStatus !== 'idle') && (
          <div className={styles.scanStatus} data-status={activeStatus} role="status">
            <MaterialIcon name={expiryStatus === 'found' ? 'mdi:check-circle' : expiryStatus === 'error' ? 'mdi:alert-circle' : 'mdi:calendar'} size={18} />
            <span>{expiryStatusText()}</span>
          </div>
        )}

        {error && <div className={styles.error} role="alert">{error}</div>}

        {step === 'barcode' && lookupResult && (
          <div className={styles.resultCard} data-found={lookupResult.found ? 'true' : 'false'} data-has-image={productImage(lookupResult.product) ? 'true' : 'false'}>
            {productImage(lookupResult.product) && <img alt="" className={styles.productImage} src={productImage(lookupResult.product)} />}
            <div className={styles.productDetails}>
              <span className={styles.productEyebrow}>{lookupResult.found ? 'EverShelf item' : 'Barcode scanned'}</span>
              <strong>{lookupResult.found ? productName(lookupResult.product) : lookupResult.message ?? 'No product match found'}</strong>
              {lookupResult.found && productBrand(lookupResult.product) && <span>{productBrand(lookupResult.product)}</span>}
              {lookupResult.source && <span>Source: {lookupResult.source}</span>}
            </div>
          </div>
        )}

        {step === 'expiry' && expiryResult && (
          <div className={styles.resultCard} data-found={expiryResultFound(expiryResult) ? 'true' : 'false'} data-has-image="false">
            <div className={styles.productDetails}>
              <span className={styles.productEyebrow}>Expiration date</span>
              <strong>{expiryDate ? formatExpiryDate(expiryDate) : 'No expiration date found'}</strong>
              {expiryRelative && <span>{expiryRelative}</span>}
              {expiryResult.source && <span>Source: {expiryResult.source}</span>}
              {expiryResult.error && <span>Error: {expiryResult.error}</span>}
              {expiryResult.raw_text && <span className={styles.rawText}>Read: {expiryResult.raw_text}</span>}
            </div>
          </div>
        )}

        {step === 'expiry' && capturedImageUrl && (
          <figure className={styles.preview}>
            <img alt="Captured expiration date preview" src={capturedImageUrl} />
            <figcaption>Captured expiration date preview</figcaption>
          </figure>
        )}
      </div>
    </ModalSheet>
  )
}
