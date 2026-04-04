import { css } from '@emotion/react';
import { useEntity, useService } from '@hakit/core';
import { frostedGlass } from '../styles';
import { useLightGlow } from '../hooks';

const cardStyles = css`
  ${frostedGlass};
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const headerStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const nameStyles = css`
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`;

const stateStyles = css`
  font-size: 11px;
  opacity: 0.6;
  white-space: nowrap;
`;

const iconButtonStyles = css`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: background 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const sliderContainerStyles = css`
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
`;

const sliderFillStyles = (pct: number, interactive: boolean) => css`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${pct}%;
  border-radius: 3px;
  background: ${pct > 0 ? 'rgba(255, 200, 50, 0.8)' : 'transparent'};
  transition: width 0.3s ease;
  ${interactive ? 'cursor: pointer;' : ''}
`;

const sliderInputStyles = css`
  position: absolute;
  top: -6px;
  left: 0;
  width: 100%;
  height: 18px;
  opacity: 0;
  cursor: pointer;
  margin: 0;
`;

interface LightSliderProps {
  entityId: string;
  name: string;
  /** If true, slider is interactive (toggle mode). If false, read-only. */
  interactive?: boolean;
}

export function LightSlider({ entityId, name, interactive = true }: LightSliderProps) {
  const entity = useEntity(entityId);
  const { callService } = useService();
  const glow = useLightGlow(entityId);
  const isOn = entity?.state === 'on';
  const brightness = entity?.attributes?.brightness ?? 0;
  const brightnessPct = Math.round((brightness / 255) * 100);

  const handleToggle = () => {
    if (!interactive) return;
    callService({
      domain: 'light',
      service: 'toggle',
      target: { entity_id: entityId },
    });
  };

  const handleBrightness = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!interactive) return;
    const value = Number(e.target.value);
    if (value === 0) {
      callService({
        domain: 'light',
        service: 'turn_off',
        target: { entity_id: entityId },
      });
    } else {
      callService({
        domain: 'light',
        service: 'turn_on',
        target: { entity_id: entityId },
        serviceData: { brightness_pct: value },
      });
    }
  };

  return (
    <div css={[cardStyles, isOn && css`box-shadow: 0 0 20px ${glow.glowColor}; background: ${glow.bgTint};`]}>
      <div css={headerStyles}>
        <button css={iconButtonStyles} onClick={handleToggle}>
          💡
        </button>
        <span css={nameStyles}>{name}</span>
        <span css={stateStyles}>
          {isOn ? `${brightnessPct}%` : 'Off'}
        </span>
      </div>
      <div css={sliderContainerStyles}>
        <div css={sliderFillStyles(isOn ? brightnessPct : 0, interactive)} />
        {interactive && (
          <input
            type="range"
            min="0"
            max="100"
            value={isOn ? brightnessPct : 0}
            onChange={handleBrightness}
            css={sliderInputStyles}
          />
        )}
      </div>
    </div>
  );
}
