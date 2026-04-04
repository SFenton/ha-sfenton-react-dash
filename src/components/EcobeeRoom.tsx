import { css } from '@emotion/react';
import { useEntity } from '@hakit/core';
import { frostedGlass, frostedGlassHover } from '../styles';
import { useNavigation } from '../store';
import type { AreaRoute } from '../routes';

const cardStyles = css`
  ${frostedGlass};
  ${frostedGlassHover};
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;

  &:active {
    transform: scale(0.97);
  }
`;

const iconStyles = (occupied: boolean) => css`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${occupied ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  transition: background 0.3s;
`;

const infoStyles = css`
  flex: 1;
  min-width: 0;
`;

const nameStyles = css`
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const tempStyles = css`
  font-size: 12px;
  opacity: 0.6;
`;

interface EcobeeRoomProps {
  entityId: string;
  name: string;
  occupancyEntity?: string;
  /** Navigate to this area's popup hash when clicked */
  popupHash?: string;
}

export function EcobeeRoom({ entityId, name, occupancyEntity, popupHash }: EcobeeRoomProps) {
  const entity = useEntity(entityId);
  const occupancy = useEntity(occupancyEntity ?? entityId);
  const { openPopup } = useNavigation();
  const temp = entity?.state ?? '—';
  const unit = entity?.attributes?.unit_of_measurement ?? '°F';
  const isOccupied = occupancyEntity ? occupancy?.state === 'on' : false;

  const handleClick = () => {
    if (popupHash) openPopup(popupHash);
  };

  return (
    <div css={cardStyles} onClick={handleClick}>
      <div css={iconStyles(isOccupied)}>🏠</div>
      <div css={infoStyles}>
        <div css={nameStyles}>{name}</div>
        <div css={tempStyles}>
          {temp}{unit} {isOccupied && '• Occupied'}
        </div>
      </div>
    </div>
  );
}
