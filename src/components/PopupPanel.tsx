import { css } from '@emotion/react';
import { useNavigation } from '../store';
import type { ReactNode } from 'react';

const overlayStyles = css`
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const panelStyles = css`
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px 20px 0 0;
  padding: 24px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  animation: slideUp 0.25s ease-out;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: none;

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
`;

const handleStyles = css`
  width: 36px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  margin: 0 auto 16px;
`;

interface PopupPanelProps {
  hash: string;
  children: ReactNode;
}

export function PopupPanel({ hash, children }: PopupPanelProps) {
  const { popup, closePopup } = useNavigation();

  if (popup !== hash) return null;

  return (
    <div css={overlayStyles} onClick={closePopup}>
      <div css={panelStyles} onClick={(e) => e.stopPropagation()}>
        <div css={handleStyles} />
        {children}
      </div>
    </div>
  );
}
