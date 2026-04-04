import { css } from '@emotion/react';
import { useService } from '@hakit/core';
import { ViewHeader, Separator } from '../components';
import { frostedGlass, frostedGlassHover } from '../styles';

const sectionStyles = css`
  margin-bottom: 24px;
`;

const cardStyles = css`
  ${frostedGlass};
  ${frostedGlassHover};
  padding: 16px;
  cursor: pointer;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;

  &:active {
    transform: scale(0.98);
  }
`;

const iconStyles = css`
  font-size: 24px;
`;

const nameStyles = css`
  font-size: 14px;
  font-weight: 500;
`;

const descStyles = css`
  font-size: 12px;
  opacity: 0.5;
`;

export function ChoresView() {
  const { callService } = useService();

  const runScript = (entityId: string) => {
    callService({
      domain: 'script',
      service: 'turn_on',
      target: { entity_id: entityId },
    });
  };

  return (
    <>
      <ViewHeader title="Tasks" />

      <div css={sectionStyles}>
        <Separator title="Quick Actions" />
        <div
          css={cardStyles}
          onClick={() => runScript('script.create_donetick_task')}
        >
          <span css={iconStyles}>📝</span>
          <div>
            <div css={nameStyles}>Create Task</div>
            <div css={descStyles}>Add a new task to Donetick</div>
          </div>
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Vacuum" />
        <div
          css={cardStyles}
          onClick={() => callService({
            domain: 'vacuum',
            service: 'start',
            target: { entity_id: 'vacuum.valetido_politefatherlykingfisher' },
          })}
        >
          <span css={iconStyles}>🤖</span>
          <div>
            <div css={nameStyles}>Start Vacuum</div>
            <div css={descStyles}>Begin full clean</div>
          </div>
        </div>
        <div
          css={cardStyles}
          onClick={() => callService({
            domain: 'vacuum',
            service: 'return_to_base',
            target: { entity_id: 'vacuum.valetido_politefatherlykingfisher' },
          })}
        >
          <span css={iconStyles}>🏠</span>
          <div>
            <div css={nameStyles}>Return to Dock</div>
            <div css={descStyles}>Send vacuum home</div>
          </div>
        </div>
      </div>
    </>
  );
}
