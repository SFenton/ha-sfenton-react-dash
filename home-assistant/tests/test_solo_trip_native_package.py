"""Repository gates for the native Solo Trip package.

# @covers home-assistant/packages/solo_trip.yaml
# @covers home-assistant/custom_templates/solo_trip.jinja
# @covers home-assistant/solo_trip/initial_journal.json
# @covers home-assistant/solo_trip/initial_status.json
# @covers home-assistant/solo_trip/vacation_consumer_migration.yaml
# @covers home-assistant/solo_trip/stage_schedule_writer_migration_v1.yaml
# @covers scripts/deploy.ts
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import unittest

import yaml


ROOT = Path(__file__).parents[1]
REPO_ROOT = ROOT.parent
PACKAGE = ROOT / "packages" / "solo_trip.yaml"
TEMPLATE = ROOT / "custom_templates" / "solo_trip.jinja"
MANIFEST = ROOT / "solo_trip" / "vacation_consumer_migration.yaml"
STAGE_MIGRATION = ROOT / "solo_trip" / "stage_schedule_writer_migration_v1.yaml"
INITIAL_JOURNAL = ROOT / "solo_trip" / "initial_journal.json"
INITIAL_STATUS = ROOT / "solo_trip" / "initial_status.json"
DEPLOY = REPO_ROOT / "scripts" / "deploy.ts"
SRC = REPO_ROOT / "src"


class SoloTripNativePackageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.package_text = PACKAGE.read_text()
        self.parsed = yaml.safe_load(self.package_text)
        self.template_text = TEMPLATE.read_text()
        self.manifest = MANIFEST.read_text()
        self.stage_migration = yaml.safe_load(STAGE_MIGRATION.read_text())
        self.initial_journal = json.loads(INITIAL_JOURNAL.read_text())
        self.initial_status = json.loads(INITIAL_STATUS.read_text())
        self.deploy_text = DEPLOY.read_text()

    def test_native_inventory_uses_exact_entities_and_one_writer(self) -> None:
        self.assertEqual(set(self.parsed["input_boolean"]), {"solo_trip_enabled"})
        self.assertEqual(set(self.parsed["input_select"]), {"solo_trip_traveler"})
        self.assertEqual(set(self.parsed["input_datetime"]), {"solo_trip_start", "solo_trip_end"})
        self.assertEqual(len(self.parsed["mqtt"]["sensor"]), 2)
        self.assertEqual(self.parsed["script"]["household_away_command"]["mode"], "queued")
        self.assertEqual(len(self.parsed["automation"]), 1)
        self.assertIn("solo_trip_writer_released", self.package_text)
        self.assertIn("effective_vacation_mode", self.package_text)
        self.assertNotIn("custom_components/household_away", self.package_text)

    def test_journal_signing_replay_and_pending_macros_exist(self) -> None:
        for required in (
            "signed_journal",
            "journal_valid",
            "request_hash",
            "pending_request_record",
            "append_terminal_result",
            "merged_schedule",
            "restored_schedule",
            "replaced_alarms",
        ):
            self.assertIn(required, self.template_text)
        self.assertNotIn("computed_in_ha_template", self.package_text)
        self.assertIn("matches[-1]", self.package_text)
        self.assertIn("[-64:]", self.template_text)

    def test_public_status_and_writer_release_fail_closed_on_journal_or_revision_mismatch(self) -> None:
        self.assertIn("current_revision: \"{{ current_journal.get('revision', 0)", self.package_text)
        self.assertNotIn("current_revision: \"{{ current_public_status.get('revision', 0)", self.package_text)
        self.assertIn("status_revision_matches", self.package_text)
        self.assertIn("pending_status_match", self.package_text)
        self.assertIn("'command_available': journal_ok and status_ok and value_json.command_available == true", self.package_text)
        self.assertIn("and public_state in ['idle', 'scheduled']", self.package_text)

    def test_every_wait_has_an_immediate_guard(self) -> None:
        wait_count = len(re.findall(r"wait_template:", self.package_text))
        guarded_count = len(re.findall(r"not wait\.completed", self.package_text))
        self.assertGreaterEqual(wait_count, 14)
        self.assertGreaterEqual(guarded_count, wait_count)
        self.assertIn("journal_claim_echo_timeout", self.package_text)
        self.assertIn("journal_baseline_echo_timeout", self.package_text)

    def test_schedule_cancel_update_and_resolve_use_pending_then_terminal_journal_commits(self) -> None:
        for prefix in ("schedule", "cancel", "update_end", "resolve"):
            self.assertIn(f"{prefix}_pending_request", self.package_text)
            self.assertIn(f"{prefix}_admission_journal_payload", self.package_text)
            self.assertIn(f"{prefix}_terminal_journal_payload", self.package_text)
        self.assertIn("schedule_terminal_request_results | from_json", self.package_text)
        self.assertIn("cancel_terminal_request_results | from_json", self.package_text)
        self.assertIn("update_end_terminal_request_results | from_json", self.package_text)
        self.assertIn("resolve_terminal_request_results | from_json", self.package_text)
        schedule_section = self.package_text.split("normalized_operation == 'schedule'", 1)[1].split(
            "normalized_operation == 'cancel'",
            1,
        )[0]
        self.assertIn("journal_phase != 'idle'", schedule_section)
        self.assertIn("solo_trip_already_configured", schedule_section)
        self.assertNotIn("current_minute_timestamp", schedule_section)
        self.assertNotIn("start_in_past", schedule_section)
        self.assertIn("request_end_timestamp <= request_start_timestamp", schedule_section)

    def test_activation_adds_truthful_activating_barriers_and_alarm_clear_wait(self) -> None:
        self.assertIn("activating_status_payload", self.package_text)
        self.assertIn("'state': 'activating'", self.package_text)
        self.assertNotIn("alarm_clear_wait_template", self.package_text)
        self.assertGreaterEqual(
            self.package_text.count(
                "states(selected_profile.away_alarm_state) not in ['ringing', 'snoozed']"
            ),
            2,
        )
        self.assertIn("sleepypod_schedule_diverged", self.package_text)
        self.assertIn("restore_required_activation_payload", self.package_text)
        self.assertIn("'blockers': ['activation_incomplete']", self.package_text)
        self.assertIn("current_schedule_ready", self.package_text)
        self.assertIn("mirrored_schedule_map", self.package_text)
        self.assertIn("mirrored_schedule_json", self.package_text)
        self.assertIn("side_fingerprint", self.template_text)
        self.assertIn("full_schedule_fingerprint", self.template_text)
        self.assertIn("key != 'id'", self.template_text)

    def test_end_branch_has_ending_barrier_release_order_and_truthful_end_now(self) -> None:
        self.assertIn("ending_status_payload", self.package_text)
        self.assertIn("'state': 'ending'", self.package_text)
        self.assertIn("final_end_terminal_journal_payload", self.package_text)
        self.assertIn("explicit_end_now", self.package_text)
        end_now_section = self.package_text.split("normalized_operation == 'end_now'", 1)[1].split("\n\nautomation:", 1)[0]
        self.assertNotIn("script.household_away_command", end_now_section)
        self.assertIn("'status': 'indeterminate'", end_now_section)
        self.assertIn("'state': 'ending'", end_now_section)
        final_end_section = self.package_text.split("final_end_terminal_journal_payload", 1)[1]
        self.assertIn("input_boolean.turn_off", final_end_section)
        self.assertIn("input_select.select_option", final_end_section)

    def test_restore_required_uses_truthful_blockers_and_effects(self) -> None:
        self.assertIn("'blockers': ['sleepypod_schedule_diverged']", self.package_text)
        self.assertIn("'sleepypod_live_follow': false", self.package_text)
        self.assertIn("'sleepypod_schedule': false", self.package_text)
        self.assertIn("'wake_light_source': true", self.package_text)
        self.assertNotIn("'blockers': []", self.package_text.split("sleepypod_schedule_diverged", 1)[1].split("restore_required", 1)[0])

    def test_sleepypod_commands_validate_inputs_use_static_services_and_record_terminal_results(self) -> None:
        self.assertIn("normalized_side not in ['left', 'right']", self.package_text)
        for error_code in (
            "invalid_side",
            "missing_enabled",
            "invalid_level",
            "wrong_schedule_phase",
            "invalid_phase",
            "schedule_unavailable",
            "missing_alarm_rows",
            "invalid_alarm_rows",
            "sleepypod_locked",
            "traveler_side_read_only",
        ):
            self.assertIn(error_code, self.package_text)
        self.assertNotIn("script.turn_on", self.package_text)
        for action in (
            "action: script.sleepypod_stephen_temperature_tonight",
            "action: script.sleepypod_steph_temperature_tonight",
            "action: script.sleepypod_stephen_temperature_outside_schedule",
            "action: script.sleepypod_steph_temperature_outside_schedule",
            "action: climate.set_hvac_mode",
            "action: input_number.set_value",
        ):
            self.assertIn(action, self.package_text)
        self.assertIn("sleepypod_terminal_request_results", self.package_text)
        self.assertIn("sleepypod_terminal_journal_payload", self.package_text)
        self.assertIn("sleepypod_schedule_map", self.package_text)
        self.assertIn("sleepypod_schedule_json", self.package_text)
        self.assertIn("sleepypod_full_schedule_fingerprint", self.package_text)
        self.assertIn("last_confirmed_overlay_fingerprint", self.package_text)
        self.assertNotRegex(self.package_text, r"response_variable:\s*\"{{")

    def test_reconcile_bypasses_external_ledger_and_uses_stable_ids(self) -> None:
        self.assertIn("normalized_operation != 'reconcile' and not internal_sleepypod_bypass and known_request_hash is string", self.package_text)
        self.assertIn("normalized_operation != 'reconcile' and not internal_sleepypod_bypass and known_request_response is mapping", self.package_text)
        self.assertIn("request_results': journal_request_results", self.package_text)
        self.assertIn("trigger.entity_id | default('state', true) | replace('.', '-')", self.package_text)
        self.assertIn("%Y%m%d%H%M%S%f", self.package_text)
        self.assertIn("journal_pending_request is mapping", self.package_text)
        self.assertIn("Pending Solo Trip request recovered", self.package_text)
        self.assertIn("request_in_progress", self.package_text)
        self.assertIn("id: engaged_device", self.package_text)
        self.assertIn("trigger.id != 'engaged_device'", self.package_text)

    def test_reconcile_handles_expiry_vacation_return_and_live_divergence(self) -> None:
        self.assertIn("or is_state('input_boolean.solo_trip_enabled', 'off')", self.package_text)
        self.assertIn("or (plan_end_timestamp is number and now_timestamp >= plan_end_timestamp)", self.package_text)
        self.assertIn("or is_state('input_boolean.vacation_mode', 'on')", self.package_text)
        self.assertIn("active_divergence_journal_payload", self.package_text)
        self.assertIn("Active SleepyPod schedule diverged", self.package_text)
        self.assertIn("'blockers': ['sleepypod_schedule_diverged']", self.package_text)

    def test_stage_writer_migration_artifact_routes_through_single_boundary(self) -> None:
        self.assertEqual(self.stage_migration["version"], 1)
        self.assertEqual(self.stage_migration["source_automation"], "automation.sleepypod_bed_stage_schedules_to_mqtt")
        self.assertEqual(self.stage_migration["source_action"]["action"], "mqtt.publish")
        self.assertEqual(self.stage_migration["target_action"]["action"], "script.household_away_command")
        self.assertEqual(self.stage_migration["target_action"]["data"]["operation"], "sleepypod_command")
        self.assertEqual(self.stage_migration["target_action"]["data"]["internal_bypass"], True)
        self.assertEqual(self.stage_migration["target_action"]["data"]["schedule"], "{{ schedule_payload | from_json }}")
        self.assertNotIn("side", self.stage_migration["target_action"]["data"])
        self.assertEqual(self.stage_migration["preserve"], ["schedule_payload"])
        self.assertIn("still obey transition locks", self.stage_migration["notes"][1])
        self.assertIn(
            "journal_phase == 'active'",
            self.package_text.split("sleepypod_effective_side:", 1)[1].split("sleepypod_terminal_response:", 1)[0],
        )

    def test_bootstrap_payloads_are_idle_released_and_checksum_valid(self) -> None:
        self.assertEqual(self.initial_journal["solo_phase"], "idle")
        self.assertIsNone(self.initial_journal["writer_owner"])
        self.assertEqual(self.initial_status["state"], "idle")
        self.assertTrue(self.initial_status["command_available"])
        self.assertEqual(self.initial_status["blockers"], [])
        unsigned = dict(self.initial_journal)
        checksum = unsigned.pop("payload_checksum")
        self.assertEqual(
            checksum,
            hashlib.sha256(json.dumps(unsigned, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest(),
        )

    def test_vacation_manifest_and_deploy_staging_remain_present(self) -> None:
        self.assertEqual(len(re.findall(r"^\s+- entity_id:", self.manifest, re.MULTILINE)), 12)
        self.assertEqual(self.manifest.count("migration: retain_raw_input_boolean"), 3)
        self.assertEqual(self.manifest.count("migration: replace_vacation_mode_condition"), 9)
        self.assertIn("effective_gate: binary_sensor.effective_vacation_mode", self.manifest)
        self.assertIn("'custom_templates/solo_trip.jinja'", self.deploy_text)
        self.assertIn("'solo_trip/stage_schedule_writer_migration_v1.yaml'", self.deploy_text)
        self.assertIn("await client.mkdir(`${configRoot}/custom_templates`", self.deploy_text)

    def test_react_production_source_has_no_direct_schedule_mqtt_publish(self) -> None:
        schedule_topic = "sleepypod/eight-pod/cmd/set-schedules"
        for path in SRC.rglob("*.tsx"):
            if path.name.endswith(".test.tsx"):
                continue
            text = path.read_text()
            if schedule_topic not in text:
                continue
            self.assertNotRegex(
                text,
                r"domain:\s*['\"]mqtt['\"][\s\S]{0,240}service:\s*['\"]publish['\"][\s\S]{0,240}"
                + re.escape(schedule_topic),
            )


if __name__ == "__main__":
    unittest.main()
