import { css } from '@emotion/react';
import { ViewHeader } from '../components';
import { useNavigation } from '../store';
import { frostedGlass, frostedGlassHover } from '../styles';

const linkListStyles = css`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
`;

const linkCardStyles = css`
  ${frostedGlass};
  ${frostedGlassHover};
  padding: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: background 0.2s, transform 0.15s;

  &:active {
    transform: scale(0.97);
  }
`;

const linkIconStyles = css`
  font-size: 20px;
`;

const linkLabelStyles = css`
  font-size: 14px;
  font-weight: 500;
`;

const SETTINGS_LINKS = [
  { label: 'Admin Controls', icon: '🔧', route: 'admin' },
  { label: 'Guest Controls', icon: '🏠', route: 'guests-staying-over' },
  { label: 'To-Do', icon: '📝', route: 'to-do' },
  { label: 'Mach-E', icon: '🚗', route: 'mach-e' },
  { label: 'Home Assistant Settings', icon: '⚙️', externalPath: '/config' },
];

export function SettingsView() {
  const { navigate } = useNavigation();

  return (
    <>
      <ViewHeader title="Settings" />

      <div css={linkListStyles}>
        {SETTINGS_LINKS.map((link) => (
          <div
            key={link.label}
            css={linkCardStyles}
            onClick={() => {
              if (link.externalPath) {
                window.location.href = link.externalPath;
              } else if (link.route) {
                navigate(link.route as any);
              }
            }}
          >
            <span css={linkIconStyles}>{link.icon}</span>
            <span css={linkLabelStyles}>{link.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
