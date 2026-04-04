import { css } from '@emotion/react';
import { useNavigation } from '../store';
import type { ReactNode } from 'react';

const headerStyles = css`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const backButtonStyles = css`
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 12px;
  color: white;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 18px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const titleStyles = css`
  font-size: 24px;
  font-weight: 700;
  margin: 0;
`;

interface ViewHeaderProps {
  title: string;
  showBack?: boolean;
  children?: ReactNode;
}

export function ViewHeader({ title, showBack = false, children }: ViewHeaderProps) {
  const { goBack } = useNavigation();

  return (
    <div css={headerStyles}>
      {showBack && (
        <button css={backButtonStyles} onClick={goBack}>
          ←
        </button>
      )}
      <h1 css={titleStyles}>{title}</h1>
      {children}
    </div>
  );
}
