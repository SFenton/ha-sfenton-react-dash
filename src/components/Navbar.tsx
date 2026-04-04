import { css } from '@emotion/react';
import { useNavigation } from '../store';
import { TOP_LEVEL_ROUTES } from '../routes';

const ICON_MAP: Record<string, string> = {
  'mdi:home': '🏠',
  'mdi:shield': '🛡',
  'mdi:thermostat': '🌡',
  'mdi:checkbox-marked-outline': '📋',
  'mdi:cog': '⚙️',
};

const navbarStyles = css`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 64px;
  background: rgba(20, 20, 20, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: env(safe-area-inset-bottom, 0px);
`;

const navItemStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 10px;
  cursor: pointer;
  transition: color 0.2s, transform 0.15s;
  -webkit-tap-highlight-color: transparent;
  border-radius: 12px;

  &:hover {
    color: rgba(255, 255, 255, 0.7);
  }
  &:active {
    transform: scale(0.92);
  }
`;

const navItemActiveStyles = css`
  color: rgba(255, 255, 255, 1);
`;

const iconStyles = css`
  font-size: 20px;
  line-height: 1;
`;

export function Navbar() {
  const { currentRoute, navigate } = useNavigation();

  return (
    <nav css={navbarStyles}>
      {TOP_LEVEL_ROUTES.map(({ route, label, icon }) => (
        <button
          key={route}
          css={[navItemStyles, currentRoute === route && navItemActiveStyles]}
          onClick={() => navigate(route)}
        >
          <span css={iconStyles}>{ICON_MAP[icon] ?? '•'}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
