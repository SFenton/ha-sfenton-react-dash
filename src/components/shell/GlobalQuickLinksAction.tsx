import { useMemo, useState } from 'react'
import { useHass } from '@hakit/core'
import { DynamicGrid } from '../core/DynamicGrid'
import { FloatingActionButton } from '../core/FloatingActionButton'
import { ModalSheet, type ModalSheetStyle } from '../core/ModalSheet'
import {
  modalSquareGridModalStyle,
  modalSquareGridStyle,
  useModalSquareGridLayout,
} from '../core/modalSquareGrid'
import { QuickLinkTile } from '../hass/QuickLinkTile'
import { RoomNavigationGrid } from '../hass/RoomNavigationGrid'
import { SecurityControls } from '../hass/SecurityControls'
import { securitySystemModalSubtitle } from '../hass/securityControlsConfig'
import {
  AREA_ITEMS,
  QUICK_ACCESS_ITEMS,
  ROOMS_QUICK_ACCESS_ITEM,
  SECURITY_ENTITY,
  SECURITY_QUICK_ACCESS_ITEM,
  type QuickAccessModalPage,
} from '../../constants/atAGlance'
import { CHORE_BLUE } from '../../constants/portedDashboard'
import { useModalDetailPageScroll } from '../../hooks/useModalDetailPageScroll'
import { useCopy } from '../../i18n'
import styles from './GlobalQuickLinksAction.module.css'

const QUICK_LINKS_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-height': 'auto',
  '--modal-desktop-width': '900px',
}

interface GlobalQuickLinksActionProps {
  onNavigate: (path: string) => void
}

export function GlobalQuickLinksAction({ onNavigate }: GlobalQuickLinksActionProps) {
  const translate = useCopy('shell')
  const quickLinksName = translate('quickLinks.title')
  const [open, setOpen] = useState(false)
  const [detailPage, setDetailPage] = useState<QuickAccessModalPage | null>(null)
  const visibleItemIds = useHass((state) => QUICK_ACCESS_ITEMS
    .filter((item) => !item.visibilityEntityId || state.entities[item.visibilityEntityId]?.state === 'on')
    .map((item) => item.id)
    .join('|'))
  const securitySubtitle = useHass((state) => securitySystemModalSubtitle(state.entities[SECURITY_ENTITY]?.state))
  const visibleItems = useMemo(() => {
    const ids = new Set(visibleItemIds.split('|'))
    return QUICK_ACCESS_ITEMS.filter((item) => ids.has(item.id))
  }, [visibleItemIds])
  const roomsPage = ROOMS_QUICK_ACCESS_ITEM.action.page
  const roomsOpen = open && detailPage === roomsPage
  const [roomGridRef, roomGridLayout] = useModalSquareGridLayout(roomsOpen, AREA_ITEMS.length)
  const { bodyElementRef, enterDetailPage, leaveDetailPage, resetDetailPageScroll } = useModalDetailPageScroll(detailPage)
  const roomsModalStyle = {
    ...modalSquareGridModalStyle(roomGridLayout),
    '--modal-desktop-width': QUICK_LINKS_MODAL_STYLE['--modal-desktop-width'],
  }
  const contentStyle = detailPage === roomsPage ? roomsModalStyle : QUICK_LINKS_MODAL_STYLE
  const modalTitle = detailPage === roomsPage
    ? ROOMS_QUICK_ACCESS_ITEM.title
    : detailPage === 'security-system'
      ? SECURITY_QUICK_ACCESS_ITEM.title
      : quickLinksName

  const handleOpen = () => {
    resetDetailPageScroll()
    setDetailPage(null)
    setOpen(true)
  }

  const handleNavigate = (path: string) => {
    setOpen(false)
    onNavigate(path)
  }

  const handleOpenDetail = (detailPage: QuickAccessModalPage, returnFocusKey: string) => {
    enterDetailPage(returnFocusKey)
    setDetailPage(detailPage)
  }

  const handleBack = () => {
    leaveDetailPage()
    setDetailPage(null)
  }

  return (
    <>
      <FloatingActionButton
        ariaExpanded={open}
        ariaHasPopup="dialog"
        ariaLabel={quickLinksName}
        className={styles.globalAction}
        color={CHORE_BLUE}
        icon="mdi:menu"
        onClick={handleOpen}
        semantics={{ kind: 'modal' }}
        title={quickLinksName}
      />
      <ModalSheet
        bodyElementRef={bodyElementRef}
        contentStyle={contentStyle}
        onBack={detailPage === null ? undefined : handleBack}
        onClose={() => setOpen(false)}
        open={open}
        scrollResetKey={detailPage ?? false}
        subtitle={detailPage === 'security-system' ? securitySubtitle : undefined}
        title={modalTitle}
      >
        {detailPage === null ? (
          <DynamicGrid ariaLabel={quickLinksName} className={styles.grid} columns={2}>
            {visibleItems.map((item) => (
              <div
                className={styles.cell}
                data-modal-detail-trigger={item.action.kind === 'modal' ? item.id : undefined}
                key={item.id}
              >
                <QuickLinkTile
                  item={item}
                  onNavigate={handleNavigate}
                  onOpenDetail={(detailPage) => handleOpenDetail(detailPage, item.id)}
                />
              </div>
            ))}
          </DynamicGrid>
        ) : detailPage === roomsPage ? (
          <RoomNavigationGrid
            ariaLabel={ROOMS_QUICK_ACCESS_ITEM.title}
            gridRef={roomGridRef}
            gridStyle={modalSquareGridStyle(roomGridLayout)}
            onNavigate={handleNavigate}
          />
        ) : (
          <div className={styles.detail} data-modal-detail-autofocus="true" tabIndex={-1}>
            <SecurityControls />
          </div>
        )}
      </ModalSheet>
    </>
  )
}
