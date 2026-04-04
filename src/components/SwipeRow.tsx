import { css } from '@emotion/react';
import type { ReactNode } from 'react';

const swipeRowStyles = css`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 12px;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const swipeItemStyles = css`
  scroll-snap-align: start;
  flex-shrink: 0;
`;

interface SwipeRowProps {
  children: ReactNode;
}

export function SwipeRow({ children }: SwipeRowProps) {
  return (
    <div css={swipeRowStyles}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <div key={i} css={swipeItemStyles}>{child}</div>
          ))
        : <div css={swipeItemStyles}>{children}</div>
      }
    </div>
  );
}
