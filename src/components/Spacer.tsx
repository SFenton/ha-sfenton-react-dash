import { css } from '@emotion/react';

interface SpacerProps {
  height?: number;
}

export function Spacer({ height = 16 }: SpacerProps) {
  return <div css={css`height: ${height}px;`} />;
}
