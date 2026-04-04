import { css } from '@emotion/react';
import { ViewHeader, ErrorBoundary, SwipeRow, PopupPanel, Separator } from '../components';
import { LightPopupContent } from '../components/LightPopupContent';
import { ClimatePopupContent } from '../components/ClimatePopupContent';
import { OccupancyPopupContent } from '../components/OccupancyPopupContent';
import { ContactPopupContent } from '../components/ContactPopupContent';
import { VentPopupContent } from '../components/VentPopupContent';
import { AqiPopupContent } from '../components/AqiPopupContent';
import { useNavigation } from '../store';
import { useService } from '@hakit/core';
import type { AreaRoute } from '../routes';
import { AREA_ROUTES } from '../routes';
import { AREA_ENTITIES } from '../areaEntities';
import { AREA_INLINE } from '../areaInline';
import { frostedGlass, frostedGlassHover } from '../styles';

const chipStyles = css`
  flex-shrink: 0;
  padding: 8px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const sectionStyles = css`
  margin-bottom: 20px;
`;

const buttonGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
`;

const inlineButtonStyles = css`
  ${frostedGlass};
  ${frostedGlassHover};
  padding: 14px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background 0.2s, transform 0.15s;

  &:active {
    transform: scale(0.97);
  }
`;

const btnIconStyles = css`
  font-size: 18px;
`;

const btnLabelStyles = css`
  font-size: 13px;
  font-weight: 500;
`;

interface AreaDetailViewProps {
  area: AreaRoute;
}

export function AreaDetailView({ area }: AreaDetailViewProps) {
  const areaInfo = AREA_ROUTES.find((a) => a.route === area);
  const title = areaInfo?.label ?? area;
  const config = AREA_ENTITIES[area];
  const inlineConfig = AREA_INLINE[area];
  const { openPopup } = useNavigation();
  const { callService } = useService();

  // Build chip list based on what this room actually has
  const chips: { label: string; hash: string }[] = [];
  if (config.lights.length > 0) chips.push({ label: '💡 Lights', hash: `${area}-lights` });
  if (config.climate.length > 0) chips.push({ label: '🌡 Climate', hash: `${area}-climate` });
  if (config.occupancy.length > 0) chips.push({ label: '👤 Occupancy', hash: `${area}-occupancy` });
  if (config.doors.length > 0 || config.windows.length > 0) chips.push({ label: '🚪 Contacts', hash: `${area}-contacts` });
  if (config.vents.length > 0) chips.push({ label: '🌀 Vents', hash: `${area}-vents` });
  if (config.aqi.length > 0) chips.push({ label: '🌬 Air Quality', hash: `${area}-aqi` });

  return (
    <>
      <ViewHeader title={title} showBack />

      {/* Chip bar for room-specific popups */}
      {chips.length > 0 && (
        <SwipeRow>
          {chips.map(({ label, hash }) => (
            <button key={hash} css={chipStyles} onClick={() => openPopup(hash)}>
              {label}
            </button>
          ))}
        </SwipeRow>
      )}

      {/* ===== Inline Sections (visible on page) ===== */}
      {inlineConfig?.sections.map((section) => (
        <div key={section.title} css={sectionStyles}>
          <Separator title={section.title} />
          {section.buttons && (
            <div css={buttonGridStyles}>
              {section.buttons.map((btn) => (
                <div
                  key={btn.label}
                  css={inlineButtonStyles}
                  onClick={() => {
                    if (btn.action.startsWith('#')) {
                      openPopup(btn.action.slice(1));
                    } else {
                      callService({
                        domain: 'homeassistant',
                        service: 'toggle',
                        target: { entity_id: btn.action },
                      });
                    }
                  }}
                >
                  {btn.icon && <span css={btnIconStyles}>{btn.icon}</span>}
                  <span css={btnLabelStyles}>{btn.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* ===== Room-specific Popup Panels ===== */}

      {config.lights.length > 0 && (
        <PopupPanel hash={`${area}-lights`}>
          <LightPopupContent
            title={`${title} Lights`}
            sections={[{
              title,
              toggleEntity: config.groupLight,
              lights: config.lights.map((l) => ({ entityId: l.entityId, name: l.name })),
            }]}
          />
        </PopupPanel>
      )}

      {config.climate.length > 0 && (
        <PopupPanel hash={`${area}-climate`}>
          <ClimatePopupContent
            title={`${title} Climate`}
            sensors={config.climate}
          />
        </PopupPanel>
      )}

      {config.occupancy.length > 0 && (
        <PopupPanel hash={`${area}-occupancy`}>
          <OccupancyPopupContent
            title={`${title} Occupancy`}
            sensors={config.occupancy}
          />
        </PopupPanel>
      )}

      {(config.doors.length > 0 || config.windows.length > 0) && (
        <PopupPanel hash={`${area}-contacts`}>
          <ContactPopupContent
            title={`${title} Contact Sensors`}
            doors={config.doors}
            windows={config.windows}
          />
        </PopupPanel>
      )}

      {config.vents.length > 0 && (
        <PopupPanel hash={`${area}-vents`}>
          <VentPopupContent
            title={`${title} Vents`}
            vents={config.vents}
          />
        </PopupPanel>
      )}

      {config.aqi.length > 0 && (
        <PopupPanel hash={`${area}-aqi`}>
          <AqiPopupContent
            title={`${title} Air Quality`}
            sensors={config.aqi}
          />
        </PopupPanel>
      )}
    </>
  );
}
