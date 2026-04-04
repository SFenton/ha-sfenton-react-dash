import { css } from '@emotion/react';
import { useService } from '@hakit/core';
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
  toggleEntity?: string;
}

export function Separator({ title, toggleEntity }: SeparatorProps) {
  return (
    <div css={sectionSeparator}>
      <span css={sectionTitle}>{title}</span>
      {toggleEntity && <SeparatorToggle entityId={toggleEntity} />}
    </div>
  );
}

/** Separate component so useEntity is only called when we actually have an entity */
function SeparatorToggle({ entityId }: { entityId: string }) {
  const { callService } = useService();

  const handleToggle = () => {
    callService({
      domain: 'homeassistant',
      service: 'toggle',
      target: { entity_id: entityId },
    });
  };

  return (
    <button css={toggleButtonStyles} onClick={handleToggle}>
      Toggle
    </button>
  );
}
