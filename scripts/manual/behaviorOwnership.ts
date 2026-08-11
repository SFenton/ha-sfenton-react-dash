import { createHash } from 'node:crypto'
import type { ManualArticle, ManualHaInventory } from '../../src/manual/types'

export interface ManualBehaviorOwnershipRule {
  ownerArticleId: string | null
  category: string
  rationale: string
  itemIds: readonly string[]
  internalReview?: string
  internalUserFacingReview?: string
}

export interface ManualBehaviorOwnershipRecord {
  id: string
  name: string
  sourceKind: 'automation' | 'script'
  inventoryCategory: string
  classification: 'app-facing' | 'background-user-facing' | 'internal'
  ownerArticleId: string | null
  ownershipCategory: string
  rationale: string
  internalReview?: string
  internalUserFacingReview?: string
}

export interface ManualBehaviorOwnershipAudit {
  schemaVersion: 1
  generatedAt: string
  inventoryFingerprint: string
  counts: {
    total: number
    userFacing: number
    internal: number
    mappedUserFacing: number
    reviewedInternal: number
    behaviorGuides: number
  }
  records: ManualBehaviorOwnershipRecord[]
}

export interface ManualBehaviorOwnershipResult {
  audit: ManualBehaviorOwnershipAudit
  errors: string[]
}

export const REVIEWED_HA_BEHAVIOR_INVENTORY_FINGERPRINT = '028635c74be929bfdc4259d46e8767ebb339e6eaabefaa67e452bfbd614d9af8'

export const MANUAL_BEHAVIOR_OWNERSHIP_RULES: readonly ManualBehaviorOwnershipRule[] = [
  {
    ownerArticleId: 'behavior-presence-lighting',
    category: 'Presence lighting',
    rationale: 'Interprets occupancy lighting state or performs the supported room light override and wall-control behavior.',
    itemIds: [
      'automation.downstairs_hallway_light_switch',
      'automation.keep_the_kitchen_lights_on',
      'automation.light_switch_automations',
      'automation.presence_lighting_status_tracker',
      'automation.resume_the_selected_lights_automation',
      'script.keep_selected_lights_on',
      'script.resume_selected_lights_automation',
      'script.toggle_light_with_full_brightness',
      'script.toggle_presence_lighting_override',
    ],
  },
  {
    ownerArticleId: 'behavior-presence-overnight-reset',
    category: 'Presence reset',
    rationale: 'Tracks or evaluates whether the configured bedroom presence-lighting state is eligible for the overnight restore policy.',
    itemIds: ['automation.is_master_bedroom_presence_lighting_enabled'],
  },
  {
    ownerArticleId: 'behavior-outdoor-lighting',
    category: 'Outdoor lighting',
    rationale: 'Owns exterior darkness, scene, visibility, landscaper, or special-event lighting selection and restoration.',
    itemIds: [
      'automation.front_door_exterior_light_switch_automation',
      'automation.front_yard_default_lights',
      'automation.disable_enable_front_yard_lighting',
      'automation.turn_on_outdoor_lighting_when_illuminance_under_50',
      'automation.landscapers_presence_coordinator',
      'automation.seahawks_front_yard_lighting',
      'automation.set_is_outdoor_illuminance_low_enough_for_outdoor_lighting',
      'automation.set_valentine_s_day_front_yard_lights',
      'automation.front_yard_visibility_override_activate',
      'automation.front_yard_visibility_override_enforce',
      'automation.front_yard_visibility_override_restore',
      'automation.landscapers_evidence_window_reset',
    ],
  },
  {
    ownerArticleId: 'behavior-relay-power-recovery',
    category: 'Relay and power recovery',
    rationale: 'Applies house-wide relay policy or the bounded Living Room smart-light power recovery sequence.',
    itemIds: [
      'automation.relay_control_mode_apply',
      'automation.attempt_to_turn_power_back_on_in_living_room',
      'script.apply_relay_control_mode',
    ],
  },
  {
    ownerArticleId: 'behavior-thermostat-comfort',
    category: 'Thermostat comfort',
    rationale: 'Calculates or changes contact, occupancy, room tracking, temperature-range, or vent participation used by comfort control.',
    itemIds: [
      'automation.disable_guest_room_temperature_regulation_during_sleep',
      'automation.disable_master_bedroom_temperature_regulation_during_sleep',
      'automation.disable_music_room_temperature_regulation_during_sleep',
      'automation.disable_theater_room_temperature_regulation_during_sleep',
      'automation.pause_thermostat_contact_sensors_when_toggled',
      'automation.climate_range_calculation',
      'automation.start_tracking_master_bedroom_temperature_in_the_morning',
      'automation.track_theater_room_temperature_when_projector_on',
      'script.toggle_living_room_vents',
    ],
  },
  {
    ownerArticleId: 'behavior-air-and-humidity',
    category: 'Air and humidity',
    rationale: 'Runs bathroom moisture ventilation or derives and restores indoor-air values used by household summaries.',
    itemIds: [
      'automation.guest_bathroom_fan_switch_automation_humidity_over_50',
      'automation.auto_master_bathroom_fan_turn_on',
      'automation.set_office_pm2_5_after_reboot',
      'automation.set_aqi_values',
    ],
  },
  {
    ownerArticleId: 'behavior-humidifier-activities',
    category: 'Humidifier schedules',
    rationale: 'Applies recurring humidifier profiles, reflects the active profile, or clears stale one-shot timer state.',
    itemIds: [
      'automation.master_bedroom_humidifier_active_profile_updates',
      'automation.master_bedroom_humidifier_clear_timer_when_off',
      'automation.master_bedroom_humidifier_schedule',
      'script.master_bedroom_humidifier_apply_profile',
      'script.master_bedroom_humidifier_reconcile_schedule',
      'script.master_bedroom_humidifier_set_level',
    ],
  },
  {
    ownerArticleId: 'behavior-sleepypod-schedules',
    category: 'Sleep and wake',
    rationale: 'Owns bed-side recurring stages, tonight targets, wake alarms, temporary thermal modes, or the bedtime preparation scene.',
    itemIds: [
      'automation.eight_sleep_steph_hot_flash_mode',
      'automation.eight_sleep_stephen_hot_flash_mode',
      'automation.get_ready_for_bed',
      'automation.sleepypod_bed_stage_schedules_to_mqtt',
      'automation.free_sleep_steph_bed_alarms_to_mqtt',
      'automation.free_sleep_stephen_bed_alarms_to_mqtt',
      'automation.steph_sleepypod_one_time_alarm_2026_07_28_11_10',
      'script.sleepypod_steph_asleep_temperature_all_nights',
      'script.sleepypod_steph_bedtime_temperature_all_nights',
      'script.sleepypod_steph_dawn_temperature_all_nights',
      'script.sleepypod_steph_temperature_outside_schedule',
      'script.sleepypod_steph_temperature_tonight',
      'script.sleepypod_stephen_asleep_temperature_all_nights',
      'script.sleepypod_stephen_bedtime_temperature_all_nights',
      'script.sleepypod_stephen_dawn_temperature_all_nights',
      'script.sleepypod_stephen_temperature_outside_schedule',
      'script.sleepypod_stephen_temperature_tonight',
    ],
  },
  {
    ownerArticleId: 'behavior-security-away-routine',
    category: 'Security presence routine',
    rationale: 'Coordinates household arrival, departure, alarm status, triggered response, or security-notification actions.',
    itemIds: [
      'automation.alarm_trigger_turn_on_lights',
      'automation.presence_all_home_members_away',
      'automation.presence_any_home_members_home',
      'automation.aqara_arm_notification',
      'automation.security_system_triggered_notification',
      'automation.handle_security_notification_actions',
    ],
  },
  {
    ownerArticleId: 'behavior-access-auto-lock',
    category: 'Access and auto-lock',
    rationale: 'Owns front-door auto-lock, lock or garage status, direct external lock control, or door and window status notifications.',
    itemIds: [
      'automation.auto_lock_disabled_notifications',
      'automation.auto_lock_front_door_after_30_seconds',
      'automation.front_door_auto_lock_disabled',
      'automation.front_door_lock_status',
      'automation.garage_door_status_2',
      'automation.stream_deck_lock_unlock_front_door',
      'automation.new_automation_2_2',
    ],
  },
  {
    ownerArticleId: 'behavior-camera-alerts',
    category: 'Camera alerts and recording',
    rationale: 'Translates camera or doorbell evidence into occupancy, alerts, correlated logs, or camera-specific manual recording.',
    itemIds: [
      'automation.doorbell_rang',
      'automation.frigate_driveway_car_notification',
      'automation.frigate_notification',
      'automation.frigate_lower_deck_notification',
      'automation.frigate_driveway_notification',
      'automation.frigate_upper_deck',
      'automation.front_door_camera_mqtt_occupancy_automation',
      'automation.garage_camera_mqtt_occupancy_automation',
      'automation.perimeter_camera_notification_coordinator',
      'automation.front_entry_journey_classifier_shadow',
      'automation.mqtt_occupancy_automation',
      'script.camera_manual_recording',
      'script.driveway_manual_recording',
      'script.front_door_manual_recording',
      'script.lower_deck_manual_recording',
      'script.upper_deck_manual_recording',
    ],
  },
  {
    ownerArticleId: 'behavior-guest-safeguards',
    category: 'Guest safeguards',
    rationale: 'Applies or synchronizes guest-specific lighting, relay, thermostat, vacuum, security, and overnight-reset guards.',
    itemIds: [
      'automation.guest_stay_presence_reset_guard',
      'automation.guest_stay_thermostat_guard_sync',
      'automation.guests_staying_in_guest_room_toggled',
      'automation.guests_staying_in_music_room_toggled',
      'automation.guests_staying_in_theater_room_toggled',
      'automation.track_guest_room_when_guests_present',
      'automation.guest_stay_pause_main_floor_vacuum_away_auto_clean',
      'automation.guest_stay_vacuum_guard_startup_sync',
    ],
  },
  {
    ownerArticleId: 'behavior-vacation-lifecycle',
    category: 'Vacation lifecycle',
    rationale: 'Owns trip date defaults, validation, automatic end, checklist reset, relay transition, or humidifier schedule pause.',
    itemIds: [
      'automation.relay_control_mode_vacation_sync',
      'automation.pause_master_bedroom_humidifier_schedule_during_vacation',
      'automation.vacation_reset_pre_vacation_checklist',
      'automation.vacation_mode_auto_disable',
      'automation.vacation_mode_default_dates',
    ],
  },
  {
    ownerArticleId: 'behavior-chore-recurrence',
    category: 'Chore ownership',
    rationale: 'Creates or completes authoritative household tasks and synchronizes the current occurrence without duplicating recurrence in React.',
    itemIds: [
      'automation.sync_completed_tasks_to_donetick',
      'script.complete_admin_todo_item',
      'script.create_donetick_task',
    ],
  },
  {
    ownerArticleId: 'behavior-daily-report-reminders',
    category: 'Reports and reminders',
    rationale: 'Sends or recalls a Daily Report, past-due task alert, or location-based grocery reminder from live source lists.',
    itemIds: [
      'automation.location_based_grocery_notifications',
      'automation.notify_on_past_due_chores',
      'automation.daily_summary_morning_and_evening_reports',
      'automation.daily_summary_recall_report_when_nothing_left',
    ],
  },
  {
    ownerArticleId: 'behavior-food-expiration-alerts',
    category: 'Food expiration alerts',
    rationale: 'Owns digest and critical notification cycles, snooze actions, debounce, refresh, and resolved-notification cleanup.',
    itemIds: [
      'automation.food_inventory_clear_critical_when_resolved',
      'automation.food_inventory_clear_digest_when_resolved',
      'automation.food_inventory_critical_daily_reset',
      'automation.food_inventory_critical_snooze_action',
      'automation.food_inventory_debounce_critical_cleanup',
      'automation.food_inventory_debounce_inventory_cleanup',
      'automation.food_inventory_digest_daily_reset',
      'automation.food_inventory_digest_snooze_action',
      'automation.food_inventory_evening_critical_notification',
      'automation.food_inventory_morning_digest',
      'script.food_inventory_clear_resolved_critical',
      'script.food_inventory_clear_resolved_digest',
      'script.food_inventory_send_evening_critical',
      'script.food_inventory_send_morning_digest',
    ],
  },
  {
    ownerArticleId: 'behavior-vacuum-auto-clean',
    category: 'Vacuum auto-clean',
    rationale: 'Owns scheduled or coordinated cleaning, external launch state, guest-aware pause, completion, and robot error alerts.',
    itemIds: [
      'automation.automatically_vacuum_or_mop_music_room',
      'automation.automatically_vacuum_theater_room_on_schedule',
      'automation.music_room_vacuum_cleaning_complete_notification_2',
      'automation.music_room_vacuum_error_notification_2',
      'automation.stream_deck_vacuum_cancel',
      'automation.stream_deck_vacuum_launch',
      'automation.stream_deck_vacuum_startup_sync',
      'automation.stream_deck_vacuum_state_sync',
      'automation.vacuum_cleaning_complete_notifications',
      'automation.vacuum_error_notifications',
    ],
  },
  {
    ownerArticleId: 'behavior-vacuum-commands',
    category: 'Vacuum commands and dock',
    rationale: 'Owns manual mode, settings, zone or segment starts, pause or dock, mop maintenance, display text, or dock-task recovery.',
    itemIds: [
      'automation.main_floor_vacuum_mode',
      'automation.music_room_vacuum_mode_text',
      'automation.valetudo_dock_component_task_auto_clear',
      'script.main_floor_vacuum_clean_zone',
      'script.main_floor_vacuum_clean_selected_segments',
      'script.main_floor_vacuum_mop_dock_clean',
      'script.main_floor_vacuum_mop_dock_dry',
      'script.music_room_vacuum_clean_zone',
      'script.music_room_vacuum_clean_selected_segments',
      'script.music_room_vacuum_mop_dock_clean',
      'script.music_room_vacuum_mop_dock_dry',
      'script.roborock_pause_or_resume',
      'script.roborock_stop_and_dock',
      'script.set_roborock_manual_vacuum_and_mopping_settings',
      'script.theater_room_vacuum_clean_zone',
      'script.theater_room_vacuum_clean_selected_segments',
      'script.theater_room_vacuum_mop_dock_clean',
      'script.theater_room_vacuum_mop_dock_dry',
      'script.vacuum_mode_selector',
    ],
  },
  {
    ownerArticleId: 'behavior-media-source-coordination',
    category: 'Media coordination',
    rationale: 'Coordinates media power, apps, mute, receiver and projector inputs, or whole-room Theater source scenes.',
    itemIds: [
      'automation.change_avr_input_when_dropdown_changed',
      'automation.change_projector_input_on_dropdown_select',
      'automation.theater_room_auto_off_if_projector_auto_off',
      'automation.turn_off_tv_when_living_room_shield_turns_off',
      'script.apple_tv_power_on_off',
      'script.apple_tv_remote_send_command',
      'script.launch_app_on_apple_tv',
      'script.launch_app_on_media_player',
      'script.theater_room_nintendo_switch',
      'script.theater_room_tv_movie',
      'script.toggle_sonos_mute',
      'script.toggle_on_off_theater_room',
    ],
  },
  {
    ownerArticleId: 'behavior-computer-power',
    category: 'Computer power',
    rationale: 'Owns Wake-on-LAN, managed shutdown, timeouts, helper reconciliation, lock status, or Office tracking and window follow-up.',
    itemIds: [
      'automation.control_steph_s_pc',
      'automation.control_stephen_s_pc_button_pressed',
      'automation.control_theater_room_pc',
      'automation.notify_when_office_windows_are_open_and_all_pcs_are_shut_down',
      'automation.shutdown_steph_s_pc_after_timeout',
      'automation.shutdown_steph_s_pc',
      'automation.shutdown_stephen_s_pc_after_timeout',
      'automation.shutdown_stephen_s_pc_toggles',
      'automation.sync_pc_power_helpers_on_startup',
      'automation.theater_pc_shudown_toggles',
      'automation.track_office_when_a_pc_is_on_and_someone_is_home',
      'automation.turn_on_steph_s_pc_toggles',
      'automation.turn_on_stephen_s_pc_toggles',
      'automation.turn_on_theater_room_pc_toggles',
      'automation.flag_steph_s_pc_lock_status',
      'automation.flag_stephen_s_pc_lock_status',
    ],
  },
  {
    ownerArticleId: 'behavior-kitchen-appliances',
    category: 'Dishwasher behavior',
    rationale: 'Owns dishwasher start, clean and door state, rinse-aid reminders, and the prior unload-task completion path.',
    itemIds: [
      'automation.dishwasher_auto_complete_unload_task_on_run',
      'automation.dishwasher_clean_notification',
      'automation.dishwasher_clear_clean_unopened',
      'automation.dishwasher_rinse_aid_notifications',
      'automation.start_dishwasher_when_button_pressed',
    ],
  },
  {
    ownerArticleId: 'behavior-laundry-cycle',
    category: 'Laundry cycle detection',
    rationale: 'Derives washer or dryer running state from vibration and sends the matching completion reminder.',
    itemIds: [
      'automation.turn_off_dryer_boolean_on_vibration_cleared',
      'automation.turn_off_washer_boolean_on_vibration_cleared',
      'automation.turn_on_dryer_boolean_on_vibration_detection',
      'automation.turn_on_washer_boolean_on_vibration_detection',
      'automation.washer_dryer_notifications',
    ],
  },
  {
    ownerArticleId: 'behavior-grill-vehicle-status',
    category: 'Vehicle and grill status',
    rationale: 'Refreshes the household vehicle charge label used alongside direct, session-scoped grill and vehicle status surfaces.',
    itemIds: ['automation.update_mach_e_charge'],
  },
  {
    ownerArticleId: 'behavior-device-health',
    category: 'Device health',
    rationale: 'Detects a missing or stale household sensor, attempts bounded recovery, or reconciles the corresponding battery and maintenance task.',
    itemIds: [
      'automation.back_deck_motion_sensor_illuminance_health_creates_donetick_task',
      'automation.back_deck_motion_sensor_illuminance_numeric_change_tracker',
      'automation.reload_matter_when_w200_thermostat_missing',
      'automation.track_w200_thermostat_availability',
      'automation.low_battery_notifications_actions',
      'automation.zigbee_contact_sensor_stale_open_watch',
    ],
  },
  {
    ownerArticleId: 'behavior-app-housekeeping',
    category: 'Dashboard housekeeping',
    rationale: 'Maintains stale browser registrations, the default dashboard theme, or validated room-access ranking without controlling room devices.',
    itemIds: [
      'automation.weekly_browser_mod_cleanup',
      'automation.set_default_theme_to_dashboard_wallpaper',
      'script.increment_room_access',
    ],
  },
  {
    ownerArticleId: null,
    category: 'Internal navigation helpers',
    rationale: 'Navigation-only compatibility helpers do not represent a household behavior and are not presented as user-facing automation.',
    internalReview: 'Reviewed as internal navigation implementation; no behavior-guide owner is allowed.',
    itemIds: [
      'script.navigate_light_group_dashboard',
      'script.navigate_to_light_group',
    ],
  },
  {
    ownerArticleId: null,
    category: 'Internal guard workers',
    rationale: 'These scripts are implementation workers invoked by the user-facing guest safeguard automations and have no separate household contract.',
    internalReview: 'Reviewed as internal guest-guard implementation; the canonical behavior remains the guest safeguards guide.',
    itemIds: [
      'script.guest_stay_thermostat_guard_sync',
      'script.guest_stay_vacuum_guard_sync',
    ],
  },
  {
    ownerArticleId: null,
    category: 'Internal device workers',
    rationale: 'These scripts translate or apply low-level device details and are not independently user-nameable household behavior.',
    internalReview: 'Reviewed as internal worker implementation; no user-facing article ownership is permitted.',
    itemIds: [
      'script.valetudo_error_mapping',
      'script.cover_tilt_worker',
    ],
  },
  {
    ownerArticleId: null,
    category: 'Internal inert scratch item',
    rationale: 'Read-only configuration inspection confirmed this script immediately stops and performs no household action.',
    internalReview: 'Reviewed from live config as an intentionally inert accidental scratch script.',
    itemIds: ['script.front_entry_shadow_summary_unused'],
  },
]

function inventoryRecords(inventory: ManualHaInventory) {
  return [
    ...inventory.automations.map((item) => ({ ...item, sourceKind: 'automation' as const })),
    ...inventory.scripts.map((item) => ({ ...item, sourceKind: 'script' as const })),
  ].sort((left, right) => left.id.localeCompare(right.id))
}

export function behaviorInventoryFingerprint(inventory: ManualHaInventory) {
  const normalized = inventoryRecords(inventory).map((item) => ({
    kind: item.sourceKind,
    id: item.id,
    name: item.name,
    category: item.category,
    classification: item.classification,
  }))
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

export function buildBehaviorOwnershipAudit(
  inventory: ManualHaInventory,
  articles: readonly ManualArticle[],
  rules: readonly ManualBehaviorOwnershipRule[] = MANUAL_BEHAVIOR_OWNERSHIP_RULES,
  reviewedFingerprint = REVIEWED_HA_BEHAVIOR_INVENTORY_FINGERPRINT,
): ManualBehaviorOwnershipResult {
  const errors: string[] = []
  const articleById = new Map(articles.map((article) => [article.id, article]))
  const inventoryById = new Map(inventoryRecords(inventory).map((item) => [item.id, item]))
  const registryById = new Map<string, ManualBehaviorOwnershipRule>()

  for (const rule of rules) {
    if (!rule.category.trim() || !rule.rationale.trim()) errors.push(`Behavior ownership rule for ${rule.ownerArticleId ?? 'internal'} needs category and rationale.`)
    for (const id of rule.itemIds) {
      if (registryById.has(id)) errors.push(`Home Assistant item ${id} has multiple behavior ownership rules.`)
      registryById.set(id, rule)
    }
  }

  const records: ManualBehaviorOwnershipRecord[] = []
  for (const item of inventoryRecords(inventory)) {
    const rule = registryById.get(item.id)
    if (!rule) {
      errors.push(`Non-reviewed Home Assistant ${item.sourceKind} ${item.id} has no behavior ownership rule.`)
      continue
    }
    const owner = rule.ownerArticleId ? articleById.get(rule.ownerArticleId) : undefined
    if (rule.ownerArticleId && !owner) errors.push(`Home Assistant item ${item.id} references missing behavior owner ${rule.ownerArticleId}.`)
    else if (owner && owner.kind !== 'behavior-guide') errors.push(`Home Assistant item ${item.id} owner ${owner.id} is not a behavior-guide article.`)
    if (item.classification === 'internal') {
      if (rule.ownerArticleId && !rule.internalUserFacingReview?.trim()) {
        errors.push(`Internal Home Assistant item ${item.id} is mapped to user-facing guide ${rule.ownerArticleId} without explicit review.`)
      }
      if (!rule.ownerArticleId && !rule.internalReview?.trim()) errors.push(`Internal Home Assistant item ${item.id} lacks an explicit internal review.`)
    } else {
      if (!rule.ownerArticleId) errors.push(`Non-internal Home Assistant item ${item.id} has no behavior-guide owner.`)
    }
    records.push({
      id: item.id,
      name: item.name,
      sourceKind: item.sourceKind,
      inventoryCategory: item.category,
      classification: item.classification,
      ownerArticleId: rule.ownerArticleId,
      ownershipCategory: rule.category,
      rationale: rule.rationale,
      ...(rule.internalReview ? { internalReview: rule.internalReview } : {}),
      ...(rule.internalUserFacingReview ? { internalUserFacingReview: rule.internalUserFacingReview } : {}),
    })
  }

  for (const id of registryById.keys()) {
    if (!inventoryById.has(id)) errors.push(`Behavior ownership review contains removed or renamed Home Assistant item ${id}.`)
  }

  const inventoryFingerprint = behaviorInventoryFingerprint(inventory)
  if (inventoryFingerprint !== reviewedFingerprint) {
    errors.push(`Home Assistant behavior inventory fingerprint changed from the reviewed value ${reviewedFingerprint} to ${inventoryFingerprint}; review additions, removals, names, categories, and classifications before updating the fingerprint.`)
  }

  const userFacing = records.filter((record) => record.classification !== 'internal')
  const internal = records.filter((record) => record.classification === 'internal')
  return {
    audit: {
      schemaVersion: 1,
      generatedAt: inventory.generatedAt,
      inventoryFingerprint,
      counts: {
        total: inventory.automations.length + inventory.scripts.length,
        userFacing: userFacing.length,
        internal: internal.length,
        mappedUserFacing: userFacing.filter((record) => Boolean(record.ownerArticleId)).length,
        reviewedInternal: internal.filter((record) => Boolean(record.internalReview || record.internalUserFacingReview)).length,
        behaviorGuides: articles.filter((article) => article.kind === 'behavior-guide').length,
      },
      records,
    },
    errors,
  }
}

export function normalizedBehaviorOwnershipAudit(audit: ManualBehaviorOwnershipAudit) {
  return { ...audit, generatedAt: '' }
}
