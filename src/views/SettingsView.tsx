import { css } from '@emotion/react';
import { useHass } from '@hakit/core';
import { ViewHeader, Separator, EntityToggle } from '../components';
import { twoColumnGrid, frostedGlass } from '../styles';

const sectionStyles = css`
  margin-bottom: 24px;
`;

const infoCardStyles = css`
  ${frostedGlass};
  padding: 16px;
  margin-bottom: 8px;
`;

const labelStyles = css`
  font-size: 12px;
  opacity: 0.5;
`;

const valueStyles = css`
  font-size: 14px;
  font-weight: 500;
`;

export function SettingsView() {
  const { getAllEntities, getConfig } = useHass.getState().helpers;
  const entityCount = Object.keys(getAllEntities()).length;

  return (
    <>
      <ViewHeader title="Settings" />

      <div css={sectionStyles}>
        <Separator title="Instance Info" />
        <div css={infoCardStyles}>
          <div css={labelStyles}>Connected Entities</div>
          <div css={valueStyles}>{entityCount}</div>
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Display Toggles" />
        <div css={twoColumnGrid}>
          <EntityToggle entityId="input_boolean.show_christmas_lights" name="Christmas Lights" />
        </div>
      </div>

      <div css={sectionStyles}>
        <Separator title="Camera Recording" />
        <div css={twoColumnGrid}>
          <EntityToggle entityId="input_boolean.is_front_door_recording" name="Front Door Rec." />
          <EntityToggle entityId="input_boolean.is_driveway_recording" name="Driveway Rec." />
          <EntityToggle entityId="input_boolean.is_upper_deck_recording" name="Upper Deck Rec." />
          <EntityToggle entityId="input_boolean.is_lower_deck_recording" name="Lower Deck Rec." />
        </div>
      </div>
    </>
  );
}
