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

const toggleTrackStyles = (isOn: boolean) => css`
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: ${isOn ? 'rgba(76, 175, 80, 0.7)' : 'rgba(255, 255, 255, 0.15)'};
  position: relative;
  transition: background 0.3s;
  flex-shrink: 0;
`;

const toggleThumbStyles = (isOn: boolean) => css`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  position: absolute;
  top: 2px;
  left: ${isOn ? '18px' : '2px'};
  transition: left 0.3s;
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
  opacity: 0.5;
`;

interface EntityToggleProps {
  entityId: string;
  name: string;
  icon?: string;
}

export function EntityToggle({ entityId, name }: EntityToggleProps) {
  const entity = useEntity(entityId);
  const { callService } = useService();
  const isOn = entity?.state === 'on';

  const handleToggle = () => {
    callService({
      domain: 'homeassistant',
      service: 'toggle',
      target: { entity_id: entityId },
    });
  };

  return (
    <div css={[cardStyles, isOn && activeGlow('rgba(76, 175, 80, 0.15)')]} onClick={handleToggle}>
      <div css={toggleTrackStyles(isOn)}>
        <div css={toggleThumbStyles(isOn)} />
      </div>
      <span css={nameStyles}>{name}</span>
      <span css={stateStyles}>{isOn ? 'On' : 'Off'}</span>
    </div>
  );
}

/** Presence-based lighting automation switch */
export function PresenceSwitch(props: EntityToggleProps) {
  return <EntityToggle {...props} />;
}

/** Auto re-enable automation switch */
export function AutoReEnableSwitch(props: EntityToggleProps) {
  return <EntityToggle {...props} />;
}

/** Fan toggle switch */
export function FanSwitch(props: EntityToggleProps) {
  return <EntityToggle {...props} />;
}
