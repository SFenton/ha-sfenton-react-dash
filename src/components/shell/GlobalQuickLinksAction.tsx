import { useMemo, useState } from 'react'
import { useHass } from '@hakit/core'
import { DynamicGrid } from '../core/DynamicGrid'
import { FloatingActionButton } from '../core/FloatingActionButton'
import { ModalSheet, type ModalCenteredGeometry } from '../core/ModalSheet'
import { useModalSheetPresentation } from '../core/modalSheetPresentation'
import {
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

type GlobalDetailPage = QuickAccessModalPage

const QUICK_LINKS_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '500px',
  id: 'global-quick-links',
  inlineSize: '720px',
} satisfies ModalCenteredGeometry

interface GlobalQuickLinksActionProps {
  onNavigate: (path: string) => void
}

export function GlobalQuickLinksAction({ onNavigate }: GlobalQuickLinksActionProps) {
  const translate = useCopy('shell')
  const quickLinksName = translate('quickLinks.title')
  const [open, setOpen] = useState(false)
  const [detailPage, setDetailPage] = useState<GlobalDetailPage | null>(null)
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
  const presentation = useModalSheetPresentation()
  const portraitSheet = presentation === 'sheet'
  const { bodyElementRef, enterDetailPage, leaveDetailPage, resetDetailPageScroll } = useModalDetailPageScroll(detailPage)
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

  const handleOpenDetail = (detailPage: GlobalDetailPage, returnFocusKey: string) => {
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
        centeredGeometry={QUICK_LINKS_CENTERED_GEOMETRY}
        contentWidth={detailPage === 'security-system' ? 'full' : 'readable'}
        landscapeDensity={detailPage === roomsPage ? 'regular' : 'compact'}
        onBack={detailPage === null ? undefined : handleBack}
        onClose={() => setOpen(false)}
        open={open}
        scrollMode={detailPage === roomsPage ? 'panes' : 'body'}
        scrollResetKey={detailPage ?? 'root'}
        size="media"
        subtitle={detailPage === 'security-system' ? securitySubtitle : undefined}
        title={modalTitle}
      >
        <div className={detailPage === roomsPage ? styles.panePanel : undefined}>
        {detailPage === null ? (
          <DynamicGrid
            ariaLabel={quickLinksName}
            columns={2}
            fillRows={portraitSheet ? true : 'except-last'}
            itemSizing="content-aware"
            maxCellWidth={portraitSheet ? undefined : 200}
          >
            {visibleItems.map((item) => (
              <div
                className={styles.cell}
                data-modal-detail-trigger={item.action.kind === 'modal' ? item.id : undefined}
                key={item.id}
              >
                <QuickLinkTile
                  compact={!portraitSheet}
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
        </div>
      </ModalSheet>
    </>
  )
}
