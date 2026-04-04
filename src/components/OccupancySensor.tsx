import { css } from '@emotion/react';
import { frostedGlass } from '../styles';
import { useOccupancyState } from '../hooks';

const cardStyles = css`
  ${frostedGlass};
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const dotStyles = (active: boolean) => css`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${active ? '#4caf50' : 'rgba(255, 255, 255, 0.2)'};
  flex-shrink: 0;
  transition: background 0.3s;
  ${active ? 'box-shadow: 0 0 8px rgba(76, 175, 80, 0.6);' : ''}
`;

const nameStyles = css`
  font-size: 13px;
  font-weight: 500;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const stateStyles = css`
  font-size: 11px;
  opacity: 0.6;
`;

interface OccupancySensorProps {
  entityId: string;
  name: string;
}

export function OccupancySensor({ entityId, name }: OccupancySensorProps) {
  const { isDetected, bgColor, label } = useOccupancyState(entityId);

  return (
    <div css={[cardStyles, isDetected && css`box-shadow: 0 0 15px ${bgColor}; background: ${bgColor};`]}>
      <div css={dotStyles(isDetected)} />
      <span css={nameStyles}>{name}</span>
      <span css={stateStyles}>{label}</span>
    </div>
  );
}
