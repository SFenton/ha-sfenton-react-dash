import { css } from '@emotion/react';
import { frostedGlass, frostedGlassHover } from '../styles';
import { useNavigation } from '../store';
import type { AreaRoute } from '../routes';

const cardStyles = css`
  ${frostedGlass};
  ${frostedGlassHover};
  padding: 20px 16px;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &:active {
    transform: scale(0.97);
  }
`;

const iconStyles = css`
  font-size: 20px;
  opacity: 0.7;
`;

const nameStyles = css`
  font-size: 14px;
  font-weight: 600;
`;

interface AreaNavCardProps {
  area: AreaRoute;
  label: string;
  icon?: string;
}

export function AreaNavCard({ area, label }: AreaNavCardProps) {
  const { navigate } = useNavigation();

  return (
    <div css={cardStyles} onClick={() => navigate(area)}>
      <span css={nameStyles}>{label}</span>
    </div>
  );
}
