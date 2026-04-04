import { css } from '@emotion/react';
import { useNavigation } from '../store';
import { TOP_LEVEL_ROUTES } from '../routes';

const navbarStyles = css`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 60px;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: env(safe-area-inset-bottom, 0px);
`;

const navItemStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 10px;
  cursor: pointer;
  transition: color 0.2s;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    color: rgba(255, 255, 255, 0.7);
  }
`;

const navItemActiveStyles = css`
  color: rgba(255, 255, 255, 1);
`;

const iconStyles = css`
  font-size: 22px;
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
          <span css={iconStyles} className="mdi">
            {iconToChar(icon)}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Render MDI icon name as text for now — will use ha-icon or iconify later */
function iconToChar(icon: string): string {
  // Strip mdi: prefix and show as label for now
  return icon.replace('mdi:', '').replace(/-/g, ' ').charAt(0).toUpperCase();
}
