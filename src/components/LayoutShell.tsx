import { css } from '@emotion/react';
import type { ReactNode } from 'react';

const shellStyles = css`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #111;
  color: white;
`;

const contentStyles = css`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  padding-bottom: 80px; /* space for navbar */
  -webkit-overflow-scrolling: touch;
`;

interface LayoutShellProps {
  children: ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
  return (
    <div css={shellStyles}>
      <div css={contentStyles}>
        {children}
      </div>
    </div>
  );
}
