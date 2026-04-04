import { css } from '@emotion/react';
import { frostedGlass } from '../styles';
import { useDoorState } from '../hooks';

const cardStyles = css`
  ${frostedGlass};
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const iconStyles = (isOpen: boolean) => css`
  font-size: 18px;
  flex-shrink: 0;
  transition: transform 0.3s;
  ${isOpen ? 'transform: rotate(30deg);' : ''}
`;

const nameStyles = css`
  font-size: 13px;
  font-weight: 500;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const stateStyles = (isOpen: boolean) => css`
  font-size: 11px;
  font-weight: 600;
  color: ${isOpen ? '#ef5350' : 'rgba(255, 255, 255, 0.5)'};
`;

interface ContactSensorProps {
  entityId: string;
  name: string;
  type: 'door' | 'window';
}

export function ContactSensor({ entityId, name, type }: ContactSensorProps) {
  const { isOpen, bgColor, label } = useDoorState(entityId, type);
  const icon = type === 'door' ? (isOpen ? '🚪' : '🔒') : (isOpen ? '🪟' : '🪟');

  return (
    <div css={[cardStyles, isOpen && css`box-shadow: 0 0 15px ${bgColor}; background: ${bgColor};`]}>
      <span css={iconStyles(isOpen)}>{icon}</span>
      <span css={nameStyles}>{name}</span>
      <span css={stateStyles(isOpen)}>{label}</span>
    </div>
  );
}

// Convenience wrappers matching the template names
export function DoorSensor(props: Omit<ContactSensorProps, 'type'>) {
  return <ContactSensor {...props} type="door" />;
}

export function WindowSensor(props: Omit<ContactSensorProps, 'type'>) {
  return <ContactSensor {...props} type="window" />;
}
