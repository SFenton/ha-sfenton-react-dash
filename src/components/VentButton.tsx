import { css } from '@emotion/react';
import { useEntity, useService } from '@hakit/core';
import { frostedGlass, activeGlow } from '../styles';

const cardStyles = css`
  ${frostedGlass};
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const iconStyles = css`
  font-size: 18px;
  flex-shrink: 0;
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

interface VentButtonProps {
  entityId: string;
  name: string;
}

export function VentButton({ entityId, name }: VentButtonProps) {
  const entity = useEntity(entityId);
  const { callService } = useService();
  const isOpen = entity?.state === 'open';
  const position = entity?.attributes?.current_position ?? (isOpen ? 100 : 0);

  const handleToggle = () => {
    callService({
      domain: 'cover',
      service: isOpen ? 'close_cover' : 'open_cover',
      target: { entity_id: entityId },
    });
  };

  return (
    <div css={[cardStyles, isOpen && activeGlow('rgba(100, 181, 246, 0.2)')]} onClick={handleToggle}>
      <span css={iconStyles}>{isOpen ? '🌀' : '⬛'}</span>
      <span css={nameStyles}>{name}</span>
      <span css={stateStyles}>{isOpen ? `${position}%` : 'Closed'}</span>
    </div>
  );
}
