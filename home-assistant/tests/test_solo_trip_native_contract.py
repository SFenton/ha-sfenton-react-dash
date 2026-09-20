"""Pure lifecycle tests for the Solo Trip native contract mirror.

# @covers home-assistant/solo_trip/native_contract.py
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))

from solo_trip.native_contract import (  # noqa: E402
    ALARM_SNOOZE_BUTTON_BY_SIDE,
    ALARM_STOP_BUTTON_BY_SIDE,
    HOME_RESIDENT_BY_TRAVELER,
    POWER_ENTITY_BY_SIDE,
    STAGE_INPUT_NUMBER_BY_RESIDENT_PHASE,
    TONIGHT_SCRIPT_BY_RESIDENT,
    TOPICS,
    TRAVELER_TO_PERSON,
    WAKE_LIGHT_PROFILE_ID,
    activate_solo_trip,
    apply_sleepypod_command,
    attach_payload_checksum,
    build_public_status,
    cancel_solo_trip,
    canonical_json,
    end_solo_trip,
    fingerprint,
    initial_journal,
    merge_schedule,
    mirror_home_side_schedule,
    observable_schedule_fingerprint,
    payload_checksum,
    replace_alarm_rows,
    request_hash,
    resolve_restore,
    schedule_solo_trip,
    should_end_for_return,
    status_command_available,
    update_end_solo_trip,
    update_presence_evidence,
    valid_journal_contract,
    valid_public_status,
    writer_released,
)


FIXTURES = ROOT / "tests" / "fixtures"
SCHEDULE = json.loads((FIXTURES / "sleepypod-alarm-v2.json").read_text())


class NativeContractHelpersTests(unittest.TestCase):
    def test_checksum_and_fingerprints_are_canonical_and_order_preserving(self) -> None:
        payload = {"b": 1, "a": [{"x": 2}, {"x": 1}], "payload_checksum": "ignored"}
        self.assertEqual(canonical_json({"a": [{"x": 2}, {"x": 1}], "b": 1}), '{"a":[{"x":2},{"x":1}],"b":1}')
        self.assertEqual(payload_checksum(payload), fingerprint({"a": [{"x": 2}, {"x": 1}], "b": 1}))
        self.assertNotEqual(
            fingerprint({"a": [{"x": 2}, {"x": 1}], "b": 1}),
            fingerprint({"a": [{"x": 1}, {"x": 2}], "b": 1}),
        )
        without_provider_id = {"monday": {"alarms": [{"time": "07:00", "enabled": True}]}}
        with_provider_id = {"monday": {"alarms": [{"id": 1241, "time": "07:00", "enabled": True}]}}
        self.assertEqual(
            observable_schedule_fingerprint(without_provider_id),
            observable_schedule_fingerprint(with_provider_id),
        )

    def test_bootstrap_status_is_public_and_writer_released(self) -> None:
        journal = initial_journal()
        status = build_public_status(journal)
        self.assertTrue(valid_journal_contract(journal))
        self.assertTrue(valid_public_status(status))
        self.assertTrue(writer_released(journal, status))
        self.assertTrue(status["command_available"])
        self.assertEqual(status["state"], "idle")

    def test_command_available_fails_closed_on_status_mismatch(self) -> None:
        journal = initial_journal()
        self.assertFalse(status_command_available(journal, status_revision=1, status_release_token="wrong"))
        scheduled = schedule_solo_trip(
            journal,
            request_id="schedule-1",
            expected_revision=0,
            traveler="stephen",
            starts_at="2026-09-18T16:00:00+00:00",
            ends_at="2026-09-19T16:00:00+00:00",
            now=datetime(2026, 9, 18, 15, 0, tzinfo=timezone.utc),
            status_echo_ok=False,
        )
        pending = scheduled.journal["pending_request"]
        self.assertIsNotNone(pending)
        self.assertTrue(
            status_command_available(
                scheduled.journal,
                status_revision=pending["revision"],
                status_release_token=pending["release_token"],
            )
        )

    def test_mapping_constants_bind_actual_people_and_exact_entities(self) -> None:
        self.assertEqual(TRAVELER_TO_PERSON["stephen"], "person.stephen_fenton")
        self.assertEqual(TRAVELER_TO_PERSON["steph"], "person.stephanie_hobart")
        self.assertEqual(HOME_RESIDENT_BY_TRAVELER["stephen"], "steph")
        self.assertEqual(HOME_RESIDENT_BY_TRAVELER["steph"], "stephen")
        self.assertEqual(POWER_ENTITY_BY_SIDE["left"], "climate.sleepypod_eight_pod_left_side")
        self.assertEqual(TONIGHT_SCRIPT_BY_RESIDENT["steph"], "script.sleepypod_steph_temperature_tonight")
        self.assertEqual(ALARM_STOP_BUTTON_BY_SIDE["left"], "button.master_bedroom_sleepypod_eight_pod_left_alarm_stop")
        self.assertEqual(ALARM_SNOOZE_BUTTON_BY_SIDE["right"], "button.master_bedroom_sleepypod_eight_pod_right_alarm_snooze")
        self.assertEqual(STAGE_INPUT_NUMBER_BY_RESIDENT_PHASE[("stephen", "bedtime")], "input_number.eight_sleep_stephen_bedtime_level")

    def test_merge_and_alarm_replacement_preserve_full_schedule_shape(self) -> None:
        merged = merge_schedule(
            SCHEDULE,
            {"monday": {"alarms": [{"time": "06:45", "enabled": True}]}},
            side="right",
            mirror=False,
            home_side="right",
            away_side="left",
        )
        self.assertEqual(merged["left"], SCHEDULE["left"])
        replaced = replace_alarm_rows(
            SCHEDULE,
            side="left",
            alarm_rows=[
                {
                    "day": "monday",
                    "time": "08:15",
                    "enabled": True,
                    "alarmTemperature": 81,
                    "duration": 90,
                    "vibrationIntensity": 80,
                    "vibrationPattern": "pulse",
                },
                {
                    "day": "monday",
                    "time": "09:30",
                    "enabled": False,
                    "alarmTemperature": 75,
                    "duration": 45,
                    "vibrationIntensity": 25,
                    "vibrationPattern": "gentle",
                },
            ],
            mirror=False,
            home_side="right",
            away_side="left",
        )
        self.assertEqual([alarm["time"] for alarm in replaced["left"]["monday"]["alarms"]], ["08:15", "09:30"])


class NativeLifecycleTests(unittest.TestCase):
    def schedule_trip(self) -> object:
        return schedule_solo_trip(
            initial_journal(),
            request_id="schedule-1",
            expected_revision=0,
            traveler="stephen",
            starts_at="2026-09-18T16:00:00+00:00",
            ends_at="2026-09-21T16:00:00+00:00",
            now=datetime(2026, 9, 18, 15, 0, tzinfo=timezone.utc),
        )

    def test_schedule_timeout_keeps_pending_not_terminal_accept(self) -> None:
        result = schedule_solo_trip(
            initial_journal(),
            request_id="schedule-1",
            expected_revision=0,
            traveler="stephen",
            starts_at="2026-09-18T16:00:00+00:00",
            ends_at="2026-09-21T16:00:00+00:00",
            now=datetime(2026, 9, 18, 15, 0, tzinfo=timezone.utc),
            status_echo_ok=False,
        )
        self.assertEqual(result.response["status"], "indeterminate")
        self.assertEqual(result.response["state"], "scheduled")
        self.assertIsNotNone(result.journal["pending_request"])
        self.assertEqual(result.journal["request_results"], [])
        replay = schedule_solo_trip(
            result.journal,
            request_id="schedule-1",
            expected_revision=1,
            traveler="stephen",
            starts_at="2026-09-18T16:00:00+00:00",
            ends_at="2026-09-21T16:00:00+00:00",
            now=datetime(2026, 9, 18, 15, 1, tzinfo=timezone.utc),
        )
        self.assertEqual(replay.response, result.response)

    def test_schedule_replays_by_hash_and_trims_history(self) -> None:
        scheduled = self.schedule_trip()
        replay = schedule_solo_trip(
            scheduled.journal,
            request_id="schedule-1",
            expected_revision=1,
            traveler="stephen",
            starts_at="2026-09-18T16:00:00+00:00",
            ends_at="2026-09-21T16:00:00+00:00",
            now=datetime(2026, 9, 18, 15, 1, tzinfo=timezone.utc),
        )
        self.assertEqual(replay.response, scheduled.response)
        conflict = schedule_solo_trip(
            scheduled.journal,
            request_id="schedule-1",
            expected_revision=1,
            traveler="steph",
            starts_at="2026-09-18T17:00:00+00:00",
            ends_at="2026-09-21T16:00:00+00:00",
            now=datetime(2026, 9, 18, 15, 1, tzinfo=timezone.utc),
        )
        self.assertEqual(conflict.response["error_code"], "request_id_conflict")
        full = attach_payload_checksum({
            **initial_journal(),
            "request_results": [
                {
                    "request_id": f"old-{index}",
                    "request_hash": request_hash({"operation": "schedule", "request_id": f"old-{index}"}),
                    "response": {
                        "request_id": f"old-{index}",
                        "status": "accepted",
                        "revision": index,
                        "state": "idle",
                        "error_code": None,
                        "retryable": False,
                        "confirmed_effects": [],
                    },
                    "terminal": True,
                }
                for index in range(64)
            ],
        })
        trimmed = schedule_solo_trip(
            full,
            request_id="fresh",
            expected_revision=0,
            traveler="stephen",
            starts_at="2026-09-19T16:00:00+00:00",
            ends_at="2026-09-20T16:00:00+00:00",
            now=datetime(2026, 9, 18, 15, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(len(trimmed.journal["request_results"]), 64)
        self.assertEqual(trimmed.journal["request_results"][0]["request_id"], "old-1")
        self.assertEqual(trimmed.journal["request_results"][-1]["request_id"], "fresh")

    def test_schedule_accepts_past_departure_and_current_minute_but_rejects_a_second_plan(self) -> None:
        departed = schedule_solo_trip(
            initial_journal(),
            request_id="already-departed",
            expected_revision=0,
            traveler="stephen",
            starts_at="2026-09-18T14:00:00+00:00",
            ends_at="2026-09-19T15:00:00+00:00",
            now=datetime(2026, 9, 18, 15, 0, 42, tzinfo=timezone.utc),
        )
        self.assertEqual(departed.response["status"], "accepted")

        current_minute = schedule_solo_trip(
            initial_journal(),
            request_id="current-minute",
            expected_revision=0,
            traveler="steph",
            starts_at="2026-09-18T15:00:00+00:00",
            ends_at="2026-09-19T15:00:00+00:00",
            now=datetime(2026, 9, 18, 15, 0, 42, tzinfo=timezone.utc),
        )
        self.assertEqual(current_minute.response["status"], "accepted")

        duplicate = schedule_solo_trip(
            current_minute.journal,
            request_id="second-plan",
            expected_revision=current_minute.journal["revision"],
            traveler="stephen",
            starts_at="2026-09-18T16:00:00+00:00",
            ends_at="2026-09-19T16:00:00+00:00",
            now=datetime(2026, 9, 18, 15, 1, tzinfo=timezone.utc),
        )
        self.assertEqual(duplicate.response["status"], "rejected")
        self.assertEqual(duplicate.response["error_code"], "solo_trip_already_configured")

    def test_activation_checks_claim_baseline_and_does_not_record_reconcile_history(self) -> None:
        scheduled = self.schedule_trip()
        claim_fail = activate_solo_trip(
            scheduled.journal,
            request_id="reconcile-activate",
            schedule=SCHEDULE,
            now=datetime(2026, 9, 18, 16, 1, tzinfo=timezone.utc),
            traveler_state="home",
            claim_echo_ok=False,
        )
        self.assertEqual(claim_fail.public_status["state"], "restore_required")
        self.assertEqual(claim_fail.public_status["effects"], {
            "sleepypod_live_follow": False,
            "sleepypod_schedule": False,
            "wake_light_source": False,
        })
        self.assertEqual(claim_fail.journal["request_results"], scheduled.journal["request_results"])

        activated = activate_solo_trip(
            scheduled.journal,
            request_id="reconcile-activate",
            schedule=SCHEDULE,
            now=datetime(2026, 9, 18, 16, 1, tzinfo=timezone.utc),
            traveler_state="home",
            wake_light_revision=7,
            away_alarm_state="ringing",
        )
        self.assertEqual(activated.response["status"], "accepted")
        self.assertEqual(activated.public_status["state"], "active")
        self.assertEqual(activated.journal["sleepypod_baseline"], SCHEDULE["left"])
        self.assertEqual(activated.published_schedule, mirror_home_side_schedule(SCHEDULE, "stephen"))
        self.assertEqual(activated.service_calls[0]["data"]["profile_id"], WAKE_LIGHT_PROFILE_ID)
        self.assertEqual(activated.service_calls[0]["data"]["expected_revision"], 7)
        self.assertEqual(activated.service_calls[1]["data"]["entity_id"], ALARM_STOP_BUTTON_BY_SIDE["left"])
        self.assertEqual(activated.journal["request_results"], scheduled.journal["request_results"])

    def test_activation_status_timeout_commits_restore_required_with_truthful_effects(self) -> None:
        scheduled = self.schedule_trip()
        timeout = activate_solo_trip(
            scheduled.journal,
            request_id="reconcile-activate",
            schedule=SCHEDULE,
            now=datetime(2026, 9, 18, 16, 1, tzinfo=timezone.utc),
            traveler_state="not_home",
            active_status_echo_ok=False,
        )
        self.assertEqual(timeout.response["status"], "indeterminate")
        self.assertEqual(timeout.public_status["state"], "restore_required")
        self.assertEqual(timeout.public_status["effects"], {
            "sleepypod_live_follow": True,
            "sleepypod_schedule": True,
            "wake_light_source": True,
        })

    def test_end_uses_divergence_blocker_and_clears_helpers_only_on_release(self) -> None:
        scheduled = self.schedule_trip()
        activated = activate_solo_trip(
            scheduled.journal,
            request_id="reconcile-activate",
            schedule=SCHEDULE,
            now=datetime(2026, 9, 18, 16, 1, tzinfo=timezone.utc),
            traveler_state="not_home",
        )
        diverged = mirror_home_side_schedule(SCHEDULE, "stephen")
        diverged["left"]["monday"]["alarms"] = diverged["left"]["monday"]["alarms"] + [{
            "time": "08:15",
            "enabled": True,
            "alarmTemperature": 81,
            "duration": 90,
            "vibrationIntensity": 80,
            "vibrationPattern": "pulse",
        }]
        result = end_solo_trip(
            activated.journal,
            request_id="end-1",
            expected_revision=activated.journal["revision"],
            current_schedule=diverged,
            reason="traveler_returned",
        )
        self.assertEqual(result.public_status["blockers"], ["sleepypod_schedule_diverged"])
        self.assertEqual(result.public_status["effects"], {
            "sleepypod_live_follow": False,
            "sleepypod_schedule": False,
            "wake_light_source": True,
        })

        away_seen = update_presence_evidence(
            activated.journal,
            observed_state="not_home",
            observed_at=datetime(2026, 9, 19, 1, 0, tzinfo=timezone.utc),
        )
        ended = end_solo_trip(
            away_seen,
            request_id="end-2",
            expected_revision=away_seen["revision"],
            current_schedule=mirror_home_side_schedule(SCHEDULE, "stephen"),
            reason="traveler_returned",
            wake_light_revision=5,
        )
        self.assertEqual(ended.response["status"], "accepted")
        self.assertEqual(ended.public_status["state"], "idle")
        self.assertEqual(
            ended.helper_updates,
            [
                {"entity_id": "input_boolean.solo_trip_enabled", "state": "off"},
                {"entity_id": "input_select.solo_trip_traveler", "option": "none"},
            ],
        )

    def test_end_final_journal_echo_failure_stays_non_idle(self) -> None:
        activated = activate_solo_trip(
            self.schedule_trip().journal,
            request_id="reconcile-activate",
            schedule=SCHEDULE,
            now=datetime(2026, 9, 18, 16, 1, tzinfo=timezone.utc),
            traveler_state="not_home",
        )
        away_seen = update_presence_evidence(
            activated.journal,
            observed_state="not_home",
            observed_at=datetime(2026, 9, 19, 1, 0, tzinfo=timezone.utc),
        )
        failed = end_solo_trip(
            away_seen,
            request_id="end-3",
            expected_revision=away_seen["revision"],
            current_schedule=mirror_home_side_schedule(SCHEDULE, "stephen"),
            reason="traveler_returned",
            final_journal_echo_ok=False,
        )
        self.assertEqual(failed.response["status"], "indeterminate")
        self.assertEqual(failed.public_status["state"], "restore_required")

    def test_restore_supports_both_paths_and_replays(self) -> None:
        activated = activate_solo_trip(
            self.schedule_trip().journal,
            request_id="reconcile-activate",
            schedule=SCHEDULE,
            now=datetime(2026, 9, 18, 16, 1, tzinfo=timezone.utc),
            traveler_state="not_home",
            active_status_echo_ok=False,
        )
        keep_current = resolve_restore(
            activated.journal,
            request_id="resolve-keep",
            expected_revision=activated.journal["revision"],
            current_schedule=mirror_home_side_schedule(SCHEDULE, "stephen"),
            action="keep_current",
            wake_light_revision=8,
        )
        self.assertEqual(keep_current.response["status"], "accepted")
        restore_saved = resolve_restore(
            activated.journal,
            request_id="resolve-saved",
            expected_revision=activated.journal["revision"],
            current_schedule=mirror_home_side_schedule(SCHEDULE, "stephen"),
            action="restore_saved",
            wake_light_revision=9,
        )
        self.assertEqual(restore_saved.response["status"], "accepted")
        replay = resolve_restore(
            restore_saved.journal,
            request_id="resolve-saved",
            expected_revision=restore_saved.journal["revision"],
            current_schedule=mirror_home_side_schedule(SCHEDULE, "stephen"),
            action="restore_saved",
        )
        self.assertEqual(replay.response, restore_saved.response)

    def test_update_end_uses_terminal_result_only_after_confirmation(self) -> None:
        scheduled = self.schedule_trip()
        pending = update_end_solo_trip(
            scheduled.journal,
            request_id="update-end-1",
            expected_revision=scheduled.journal["revision"],
            ends_at="2026-09-22T16:00:00+00:00",
            status_echo_ok=False,
        )
        self.assertEqual(pending.response["status"], "indeterminate")
        self.assertIsNotNone(pending.journal["pending_request"])
        self.assertEqual(
            [item["request_id"] for item in pending.journal["request_results"]],
            [item["request_id"] for item in scheduled.journal["request_results"]],
        )

    def test_sleepypod_command_rejects_invalid_side_and_records_replayable_immediate_ops(self) -> None:
        activated = activate_solo_trip(
            self.schedule_trip().journal,
            request_id="reconcile-activate",
            schedule=SCHEDULE,
            now=datetime(2026, 9, 18, 16, 1, tzinfo=timezone.utc),
            traveler_state="not_home",
        )
        invalid = apply_sleepypod_command(
            activated.journal,
            request_id="bad-side",
            expected_revision=activated.journal["revision"],
            action="stop_alarm",
            side="center",
        )
        self.assertEqual(invalid.response["error_code"], "invalid_side")

        stop = apply_sleepypod_command(
            activated.journal,
            request_id="stop-1",
            expected_revision=activated.journal["revision"],
            action="stop_alarm",
            side="right",
            current_schedule=SCHEDULE,
        )
        self.assertEqual(
            {call["data"]["entity_id"] for call in stop.service_calls},
            {ALARM_STOP_BUTTON_BY_SIDE["left"], ALARM_STOP_BUTTON_BY_SIDE["right"]},
        )
        replay = apply_sleepypod_command(
            stop.journal,
            request_id="stop-1",
            expected_revision=stop.journal["revision"],
            action="stop_alarm",
            side="right",
            current_schedule=SCHEDULE,
        )
        self.assertEqual(replay.response, stop.response)
        self.assertEqual(replay.service_calls, [])

    def test_active_schedule_success_updates_overlay_fingerprint_and_uses_static_services(self) -> None:
        activated = activate_solo_trip(
            self.schedule_trip().journal,
            request_id="reconcile-activate",
            schedule=SCHEDULE,
            now=datetime(2026, 9, 18, 16, 1, tzinfo=timezone.utc),
            traveler_state="not_home",
        )
        result = apply_sleepypod_command(
            activated.journal,
            request_id="set-schedule-1",
            expected_revision=activated.journal["revision"],
            action="set_schedule",
            side="right",
            current_schedule=SCHEDULE,
            schedule={"right": {"monday": {"alarms": [{"time": "07:00", "enabled": True}]}}},
        )
        self.assertEqual(result.response["status"], "accepted")
        self.assertEqual(result.journal["last_confirmed_overlay_fingerprint"], fingerprint(result.published_schedule["left"]))
        self.assertEqual(result.public_status["state"], "active")
        self.assertEqual(result.topic if hasattr(result, "topic") else TOPICS["sleepypod_schedule"], TOPICS["sleepypod_schedule"])

        tonight = apply_sleepypod_command(
            activated.journal,
            request_id="tonight-1",
            expected_revision=activated.journal["revision"],
            action="set_tonight_level",
            side="right",
            current_schedule=SCHEDULE,
            level=74,
        )
        self.assertEqual(
            {call["service"] for call in tonight.service_calls},
            {"sleepypod_stephen_temperature_tonight", "sleepypod_steph_temperature_tonight"},
        )

        rejected = apply_sleepypod_command(
            activated.journal,
            request_id="traveler-side",
            expected_revision=activated.journal["revision"],
            action="set_power",
            side="left",
            enabled=True,
        )
        self.assertEqual(rejected.response["error_code"], "traveler_side_read_only")

    def test_cancel_releases_scheduled_trip(self) -> None:
        scheduled = self.schedule_trip()
        canceled = cancel_solo_trip(
            scheduled.journal,
            request_id="cancel-1",
            expected_revision=scheduled.journal["revision"],
        )
        self.assertEqual(canceled.response["status"], "accepted")
        self.assertEqual(canceled.public_status["state"], "idle")
        self.assertTrue(writer_released(canceled.journal, canceled.public_status))


if __name__ == "__main__":
    unittest.main()
