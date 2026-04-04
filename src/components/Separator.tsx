import { css } from '@emotion/react';
import { useEntity, useService } from '@hakit/core';
import { sectionSeparator, sectionTitle } from '../styles';

const toggleButtonStyles = css`
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  color: white;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

interface SeparatorProps {
  title: string;
  /** Optional entity to show a toggle button for (e.g. light group) */
  toggleEntity?: string;
}

export function Separator({ title, toggleEntity }: SeparatorProps) {
  const entity = useEntity(toggleEntity ?? 'sun.sun');
  const { callService } = useService();
  const hasToggle = !!toggleEntity;
  const isOn = hasToggle && entity?.state === 'on';

  const handleToggle = () => {
    if (!toggleEntity) return;
    callService({
      domain: 'homeassistant',
      service: 'toggle',
      target: { entity_id: toggleEntity },
    });
  };

  return (
    <div css={sectionSeparator}>
      <span css={sectionTitle}>{title}</span>
      {hasToggle && (
        <button css={toggleButtonStyles} onClick={handleToggle}>
          {isOn ? 'Turn Off' : 'Turn On'}
        </button>
      )}
    </div>
  );
}
