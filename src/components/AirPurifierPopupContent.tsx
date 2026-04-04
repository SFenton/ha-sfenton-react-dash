import { css } from '@emotion/react';
import { useEntity, useService } from '@hakit/core';
import { Separator } from './Separator';
import { ErrorBoundary } from './ErrorBoundary';
import { frostedGlass } from '../styles';

const popupTitleStyles = css`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: white;
`;

const modeGridStyles = css`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
`;

const modeButtonStyles = (isActive: boolean) => css`
  ${frostedGlass};
  padding: 14px 12px;
  text-align: center;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  background: ${isActive ? 'rgba(0, 150, 136, 0.5)' : 'rgba(255, 255, 255, 0.06)'};

  &:hover {
    background: ${isActive ? 'rgba(0, 150, 136, 0.6)' : 'rgba(255, 255, 255, 0.12)'};
  }
  &:active {
    transform: scale(0.96);
  }
`;

const modeIconStyles = css`
  font-size: 20px;
  display: block;
  margin-bottom: 4px;
`;

const modeLabelStyles = css`
  font-size: 12px;
  font-weight: 500;
`;

const fanToggleStyles = (isOn: boolean) => css`
  ${frostedGlass};
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  margin-bottom: 16px;
  background: ${isOn ? 'rgba(0, 150, 136, 0.25)' : 'rgba(255, 255, 255, 0.06)'};
  transition: background 0.2s;

  &:hover {
    background: ${isOn ? 'rgba(0, 150, 136, 0.35)' : 'rgba(255, 255, 255, 0.12)'};
  }
`;

export interface AirPurifierConfig {
  fanModeEntity: string;
  autoModeEntity: string;
  fanEntity: string;
}

interface AirPurifierPopupContentProps {
  title: string;
  config: AirPurifierConfig;
}

const FAN_MODES = [
  { option: 'Manual', icon: '🌀', label: 'Manual' },
  { option: 'Sleep', icon: '🌙', label: 'Sleep' },
  { option: 'Auto', icon: '🔄', label: 'Auto' },
];

const AUTO_MODES = [
  { option: 'Default', icon: '🌀', label: 'Default' },
  { option: 'Quiet', icon: '🔇', label: 'Quiet' },
  { option: 'Efficient', icon: '⚡', label: 'Efficient' },
];

export function AirPurifierPopupContent({ title, config }: AirPurifierPopupContentProps) {
  return (
    <ErrorBoundary>
      <p css={popupTitleStyles}>{title}</p>
      <AirPurifierControls config={config} />
    </ErrorBoundary>
  );
}

function AirPurifierControls({ config }: { config: AirPurifierConfig }) {
  const fanMode = useEntity(config.fanModeEntity);
  const autoMode = useEntity(config.autoModeEntity);
  const fan = useEntity(config.fanEntity);
  const { callService } = useService();

  const currentFanMode = fanMode?.state ?? '';
  const currentAutoMode = autoMode?.state ?? '';
  const isFanOn = fan?.state === 'on';
  const isAutoMode = currentFanMode === 'Auto';

  const selectFanMode = (option: string) => {
    callService({
      domain: 'select',
      service: 'select_option',
      target: { entity_id: config.fanModeEntity },
      serviceData: { option },
    });
  };

  const selectAutoMode = (option: string) => {
    callService({
      domain: 'select',
      service: 'select_option',
      target: { entity_id: config.autoModeEntity },
      serviceData: { option },
    });
  };

  const toggleFan = () => {
    callService({
      domain: 'fan',
      service: isFanOn ? 'turn_off' : 'turn_on',
      target: { entity_id: config.fanEntity },
    });
  };

  return (
    <>
      {/* Fan on/off toggle */}
      <div css={fanToggleStyles(isFanOn)} onClick={toggleFan}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          🌬 Air Purifier
        </span>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          {isFanOn ? 'On' : 'Off'}
        </span>
      </div>

      {/* Fan mode selection */}
      <Separator title="Fan Modes" />
      <div css={modeGridStyles}>
        {FAN_MODES.map((m) => (
          <div
            key={m.option}
            css={modeButtonStyles(currentFanMode === m.option)}
            onClick={() => selectFanMode(m.option)}
          >
            <span css={modeIconStyles}>{m.icon}</span>
            <span css={modeLabelStyles}>{m.label}</span>
          </div>
        ))}
      </div>

      {/* Auto mode selection — only visible when fan mode is Auto */}
      {isAutoMode && (
        <>
          <Separator title="Auto Modes" />
          <div css={modeGridStyles}>
            {AUTO_MODES.map((m) => (
              <div
                key={m.option}
                css={modeButtonStyles(currentAutoMode === m.option)}
                onClick={() => selectAutoMode(m.option)}
              >
                <span css={modeIconStyles}>{m.icon}</span>
                <span css={modeLabelStyles}>{m.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
