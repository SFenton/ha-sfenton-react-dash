"""Regression tests for ID-less source scheduling and source suspension.

# @covers home-assistant/tests/fixtures/sleepypod-alarm-idless-live.json
"""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
import json
from pathlib import Path
import unittest
from zoneinfo import ZoneInfo

import test_wake_light_runtime_stub as runtime
from wake_light.commands import apply_command
from wake_light.model import (
    ProfileState,
    SourceSnapshot,
    SourceSuspension,
    WakeLightDefaults,
)
from wake_light.scheduler import parse_sleepypod_side, refresh_source_snapshot

IDLESS_FIXTURE = json.loads(
    (Path(__file__).parent / "fixtures/sleepypod-alarm-idless-live.json").read_text()
)


def _profile_with_source():
    return replace(
        runtime._profile(),
        sleepypod_schedule_entity_id="sensor.schedules",
        sleepypod_source_sides=("left", "right"),
        source_state_entity_ids={
            "sleepypod:left": "sensor.left_alarm",
            "sleepypod:right": "sensor.right_alarm",
        },
    )


class IdLessScheduleExecutionTests(unittest.IsolatedAsyncioTestCase):
    async def make(self, *, fixture=IDLESS_FIXTURE):
        clock = [datetime(2026, 9, 6, 13, 30, tzinfo=UTC)]
        profile = _profile_with_source()
        values = runtime._states(profile)
        values["sensor.schedules"] = runtime._State("ready", fixture)
        values["sensor.left_alarm"] = runtime._State("idle")
        values["sensor.right_alarm"] = runtime._State("idle")
        hass = runtime._Hass(values, lambda: clock[0])
        hass.config.time_zone = "America/Los_Angeles"
        coordinator = runtime.WakeLightCoordinator(hass, runtime._Entry(), profile)
        runtime.coordinator_module.utc_now = lambda: clock[0]
        coordinator._refresh_source_cache_locked(clock[0])
        return coordinator, hass, clock

    async def test_ids_absent_marks_identity_unavailable_but_schedule_stays_available(self):
        coordinator, _hass, _clock = await self.make()
        snapshot = coordinator.state.source_cache["sleepypod:right"]
        self.assertFalse(snapshot.available)
        self.assertTrue(snapshot.schedule_available)
        self.assertEqual(snapshot.failure_code, "source_identity_unavailable")
        self.assertEqual(len(snapshot.alarms), 2)

    async def test_reconcile_starts_a_run_from_id_less_schedule(self):
        coordinator, hass, clock = await self.make()
        await coordinator._reconcile_locked(clock[0], "start")
        self.assertIsNotNone(coordinator.state.active_run)
        self.assertTrue(
            any(
                item.schedule.source_ref == "sleepypod:right"
                for item in coordinator.state.active_run.occurrences
            )
        )

    async def test_recovery_does_not_abort_without_provider_ids(self):
        coordinator, hass, clock = await self.make()
        await coordinator._reconcile_locked(clock[0], "start")
        self.assertIsNotNone(coordinator.state.active_run)
        for entity_id in (
            coordinator.profile.root_light_entity_id,
            *coordinator.profile.target_light_entity_ids,
        ):
            hass.states.values[entity_id] = runtime._State("on", {"brightness": 3})
        clock[0] += timedelta(minutes=1)
        await coordinator._recover_locked(clock[0])
        self.assertIsNotNone(coordinator.state.active_run)

    async def test_capability_warning_is_surfaced_without_blocking_source(self):
        coordinator, _hass, clock = await self.make()
        from wake_light.read_model import build_sensor_read_model

        model = build_sensor_read_model(
            coordinator.state,
            coordinator.profile,
            entity_states={
                coordinator.profile.root_light_entity_id: "off",
                coordinator.profile.pbl_switch_entity_id: "on",
                coordinator.profile.vacation_entity_id: "off",
                coordinator.profile.blocker_entity_ids[0]: "off",
                "sensor.left_alarm": "idle",
                "sensor.right_alarm": "idle",
                **{eid: "off" for eid in coordinator.profile.target_light_entity_ids},
            },
            light_target_name="Master Bedroom Lights",
            next_occurrence=None,
            now=clock[0],
        )
        self.assertIn(
            "sleepypod:right", model.attributes["source_capability_warnings"]
        )
        self.assertEqual(
            model.attributes["source_capability_warnings"]["sleepypod:right"],
            "source_identity_unavailable",
        )
        self.assertNotIn("source_unavailable", model.attributes["current_blockers"])
        self.assertNotIn(
            "source_identity_unavailable", model.attributes["current_blockers"]
        )


class TemporaryBedAlarmIdentityGuardTests(unittest.TestCase):
    def test_provisioning_rejected_when_existing_row_at_same_time_lacks_an_id(self):
        import asyncio

        from wake_light.model import WakeLightAlarm

        async def run():
            clock = [datetime(2026, 9, 6, 13, 30, tzinfo=UTC)]
            profile = _profile_with_source()
            values = runtime._states(profile)
            values["sensor.schedules"] = runtime._State("ready", IDLESS_FIXTURE)
            values["sensor.left_alarm"] = runtime._State("idle")
            values["sensor.right_alarm"] = runtime._State("idle")
            hass = runtime._Hass(values, lambda: clock[0])
            coordinator = runtime.WakeLightCoordinator(hass, runtime._Entry(), profile)
            runtime.coordinator_module.utc_now = lambda: clock[0]
            alarm = WakeLightAlarm(
                id="nap",
                label="Nap",
                kind="once",
                date="2026-09-06",
                local_time="07:00",
                bed_sides=("right",),
                ramp_minutes=30,
            )
            with self.assertRaises(ValueError) as err:
                coordinator._validate_temporary_bed_alarm_locked(alarm)
            self.assertEqual(str(err.exception), "source_identity_unavailable")

        asyncio.run(run())


class SourceSuspensionCommandTests(unittest.TestCase):
    def _state_and_profile(self):
        profile = _profile_with_source()
        state = ProfileState.initial(profile)
        return state, profile

    def test_suspend_ignores_source_in_scheduling(self):
        state, profile = self._state_and_profile()
        alarms = parse_sleepypod_side(IDLESS_FIXTURE, "right", WakeLightDefaults())
        state = replace(
            state,
            source_cache={
                **state.source_cache,
                "sleepypod:right": SourceSnapshot(
                    alarms=alarms, available=False, schedule_available=True,
                ),
            },
        )
        self.assertTrue(state.has_linked_alarms("sleepypod:right"))
        decision = apply_command(state, profile, {
            "profile_id": profile.profile_id,
            "expected_revision": 0,
            "request_id": "suspend-1",
            "operation": "set_source_suspension",
            "source_ref": "sleepypod:right",
            "suspended": True,
            "owner_ref": "household_away:trip-1",
        })
        self.assertEqual(decision.response["outcome"], "accepted")
        self.assertTrue(decision.state.source_suspended("sleepypod:right"))
        self.assertFalse(decision.state.has_linked_alarms("sleepypod:right"))

    def test_owner_mismatch_cannot_clear_a_newer_suspension(self):
        state, profile = self._state_and_profile()
        suspended = apply_command(state, profile, {
            "profile_id": profile.profile_id,
            "expected_revision": 0,
            "request_id": "suspend-a",
            "operation": "set_source_suspension",
            "source_ref": "sleepypod:right",
            "suspended": True,
            "owner_ref": "owner-a",
        }).state
        reclaimed = apply_command(suspended, profile, {
            "profile_id": profile.profile_id,
            "expected_revision": suspended.revision,
            "request_id": "suspend-b",
            "operation": "set_source_suspension",
            "source_ref": "sleepypod:right",
            "suspended": True,
            "owner_ref": "owner-b",
        }).state
        self.assertEqual(
            reclaimed.source_suspensions["sleepypod:right"].owner_ref, "owner-b"
        )
        stale_clear = apply_command(reclaimed, profile, {
            "profile_id": profile.profile_id,
            "expected_revision": reclaimed.revision,
            "request_id": "clear-stale",
            "operation": "set_source_suspension",
            "source_ref": "sleepypod:right",
            "suspended": False,
            "owner_ref": "owner-a",
        })
        self.assertEqual(stale_clear.response["outcome"], "owner_mismatch")
        self.assertTrue(stale_clear.state.source_suspended("sleepypod:right"))
        valid_clear = apply_command(reclaimed, profile, {
            "profile_id": profile.profile_id,
            "expected_revision": reclaimed.revision,
            "request_id": "clear-valid",
            "operation": "set_source_suspension",
            "source_ref": "sleepypod:right",
            "suspended": False,
            "owner_ref": "owner-b",
        })
        self.assertEqual(valid_clear.response["outcome"], "accepted")
        self.assertFalse(valid_clear.state.source_suspended("sleepypod:right"))

    def test_does_not_rewrite_alarm_links(self):
        state, profile = self._state_and_profile()
        state = replace(state, alarm_links={"sleepypod:right#sunday#07:00": False})
        decision = apply_command(state, profile, {
            "profile_id": profile.profile_id,
            "expected_revision": 0,
            "request_id": "suspend-preserve",
            "operation": "set_source_suspension",
            "source_ref": "sleepypod:right",
            "suspended": True,
            "owner_ref": "owner-a",
        })
        self.assertEqual(
            decision.state.alarm_links, {"sleepypod:right#sunday#07:00": False}
        )

    def test_suspending_one_source_leaves_the_other_sources_lease_intact(self):
        clock = datetime(2026, 9, 6, 13, 30, tzinfo=UTC)
        profile = _profile_with_source()
        alarms_left = parse_sleepypod_side(
            {"left": {"sunday": {"alarms": [{"time": "07:00", "enabled": True}]}}},
            "left",
            WakeLightDefaults(),
        )
        alarms_right = parse_sleepypod_side(IDLESS_FIXTURE, "right", WakeLightDefaults())
        from wake_light.engine import start_run
        from wake_light.scheduler import calendar_windows

        state = ProfileState.initial(profile)
        state = replace(
            state,
            source_cache={
                "sleepypod:left": SourceSnapshot(
                    alarms=alarms_left, available=False, schedule_available=True,
                ),
                "sleepypod:right": SourceSnapshot(
                    alarms=alarms_right, available=False, schedule_available=True,
                ),
            },
        )
        windows = calendar_windows(
            profile.profile_id,
            (*alarms_left, *alarms_right),
            clock,
            ZoneInfo("America/Los_Angeles"),
            state.defaults,
        )
        run = start_run(profile, windows, now=clock, observed_floor_pct=1)
        state = replace(state, active_run=run)
        remaining_before = len(state.active_run.occurrences)
        decision = apply_command(state, profile, {
            "profile_id": profile.profile_id,
            "expected_revision": 0,
            "request_id": "suspend-right-only",
            "operation": "set_source_suspension",
            "source_ref": "sleepypod:right",
            "suspended": True,
            "owner_ref": "owner-a",
        }, now=clock)
        self.assertIsNotNone(decision.state.active_run)
        remaining = decision.state.active_run.occurrences
        self.assertTrue(remaining)
        self.assertTrue(
            all(item.schedule.source_ref != "sleepypod:right" for item in remaining)
        )
        self.assertTrue(
            any(item.schedule.source_ref == "sleepypod:left" for item in remaining)
        )
        self.assertLess(len(remaining), remaining_before)

    def test_persists_across_restart(self):
        state, profile = self._state_and_profile()
        suspended = apply_command(state, profile, {
            "profile_id": profile.profile_id,
            "expected_revision": 0,
            "request_id": "suspend-persist",
            "operation": "set_source_suspension",
            "source_ref": "sleepypod:right",
            "suspended": True,
            "owner_ref": "owner-a",
        }).state
        restored = ProfileState.from_dict(json.loads(json.dumps(suspended.to_dict())), profile)
        self.assertTrue(restored.source_suspended("sleepypod:right"))
        self.assertEqual(
            restored.source_suspensions["sleepypod:right"].owner_ref, "owner-a"
        )

    def test_summary_contract_exposes_suspensions(self):
        from wake_light.read_model import build_sensor_read_model

        state, profile = self._state_and_profile()
        suspended = apply_command(state, profile, {
            "profile_id": profile.profile_id,
            "expected_revision": 0,
            "request_id": "suspend-summary",
            "operation": "set_source_suspension",
            "source_ref": "sleepypod:right",
            "suspended": True,
            "owner_ref": "household_away:trip-1",
        }).state
        model = build_sensor_read_model(
            suspended,
            profile,
            entity_states={
                profile.root_light_entity_id: "off",
                profile.pbl_switch_entity_id: "on",
                profile.vacation_entity_id: "off",
                profile.blocker_entity_ids[0]: "off",
                "sensor.left_alarm": "idle",
                "sensor.right_alarm": "idle",
                **{eid: "off" for eid in profile.target_light_entity_ids},
            },
            light_target_name="Master Bedroom Lights",
            next_occurrence=None,
            now=datetime(2026, 9, 6, 13, 30, tzinfo=UTC),
        )
        self.assertEqual(
            model.attributes["source_suspensions"]["sleepypod:right"],
            {"suspended": True, "owner_ref": "household_away:trip-1"},
        )
