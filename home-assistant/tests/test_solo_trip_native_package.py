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

import ast
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import unittest

from jinja2 import Environment, FileSystemLoader
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
FIXTURES = ROOT / "tests" / "fixtures"


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
        self.script_sequence = self.parsed["script"]["household_away_command"]["sequence"]
        self.script_variables = {}
        for step in self.script_sequence:
            self.script_variables.update(step.get("variables", {}))
        self.jinja = Environment(loader=FileSystemLoader(TEMPLATE.parent))
        self.jinja.filters["from_json"] = json.loads
        self.jinja.filters["sha256"] = lambda value: hashlib.sha256(str(value).encode()).hexdigest()
        self.jinja.filters["to_json"] = self._to_json
        self.jinja.globals["dict"] = dict
        self.schedule_fixture = json.loads((FIXTURES / "sleepypod-alarm-idless-live.json").read_text())

    @staticmethod
    def _to_json(value: object, **kwargs: object) -> str:
        return json.dumps(
            value,
            sort_keys=bool(kwargs.get("sort_keys")),
            separators=(",", ":"),
        )

    @staticmethod
    def _walk(value: object):
        if isinstance(value, dict):
            yield value
            for child in value.values():
                yield from SoloTripNativePackageTests._walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from SoloTripNativePackageTests._walk(child)

    def _choice(self, marker: str) -> dict:
        matches = [
            node
            for node in self._walk(self.script_sequence)
            if "conditions" in node
            and "sequence" in node
            and any(
                isinstance(step, dict) and step.get("stop") == marker
                for step in node["sequence"]
            )
        ]
        self.assertEqual(len(matches), 1, marker)
        return matches[0]

    def _render(self, template: str, context: dict) -> object:
        rendered = self.jinja.from_string(template).render(**context).strip()
        if not rendered:
            return None
        try:
            return json.loads(rendered)
        except json.JSONDecodeError:
            try:
                return ast.literal_eval(rendered)
            except (SyntaxError, ValueError):
                return rendered

    def _fingerprint(self, side: dict) -> str:
        result = self._render(
            "{% from 'solo_trip.jinja' import side_fingerprint %}"
            "{{ side_fingerprint(side) }}",
            {"side": side},
        )
        self.assertIsInstance(result, str)
        return result

    def _full_fingerprint(self, schedule: dict) -> str:
        result = self._render(
            "{% from 'solo_trip.jinja' import full_schedule_fingerprint %}"
            "{{ full_schedule_fingerprint(schedule) }}",
            {"schedule": schedule},
        )
        self.assertIsInstance(result, str)
        return result

    def _schedule_context(
        self,
        *,
        schedule: dict,
        sensor_state: str = "ready",
        traveler: str = "stephen",
        journal_phase: str = "active",
        enabled: bool = True,
        vacation: bool = False,
        plan_end_timestamp: float = 200,
        now_timestamp: float = 100,
        traveler_state: str = "not_home",
        post_start_away: bool = False,
        confirmed_fingerprint: str | None = None,
    ) -> dict:
        schedule_entity = "sensor.master_bedroom_sleepypod_eight_pod_schedules"
        away_side = "left" if traveler == "stephen" else "right"
        entities = {
            schedule_entity: {
                "state": sensor_state,
                "attributes": deepcopy(schedule),
            },
            "input_boolean.solo_trip_enabled": {"state": "on" if enabled else "off"},
            "input_boolean.vacation_mode": {"state": "on" if vacation else "off"},
        }

        def states(entity_id: str) -> str:
            return entities.get(entity_id, {}).get("state", "unknown")

        def state_attr(entity_id: str, attribute: str) -> object:
            return entities.get(entity_id, {}).get("attributes", {}).get(attribute)

        context = {
            "sleepypod_schedule_entity_id": schedule_entity,
            "away_side": away_side,
            "journal_phase": journal_phase,
            "traveler_state": traveler_state,
            "presence_evidence": {
                "entity_id": (
                    "person.stephen_fenton"
                    if traveler == "stephen"
                    else "person.stephanie_hobart"
                ),
                "observed_state": traveler_state,
                "post_start_away": post_start_away,
            },
            "plan_end_timestamp": plan_end_timestamp,
            "now_timestamp": now_timestamp,
            "states": states,
            "state_attr": state_attr,
            "is_state": lambda entity_id, expected: states(entity_id) == expected,
        }
        for name in (
            "current_schedule_state",
            "current_schedule_payload",
            "current_schedule_ready",
            "current_away_fingerprint",
        ):
            context[name] = self._render(self.script_variables[name], context)
        if confirmed_fingerprint is None:
            confirmed_fingerprint = self._fingerprint(schedule.get(away_side, {}))
        context["current_journal"] = {
            "last_confirmed_overlay_fingerprint": confirmed_fingerprint,
        }
        context["current_away_overlay_matches"] = self._render(
            self.script_variables["current_away_overlay_matches"],
            context,
        )
        context["active_end_requested"] = self._render(
            self.script_variables["active_end_requested"],
            context,
        )
        return context

    @staticmethod
    def _actions(node: object) -> list[str]:
        return [
            value["action"]
            for value in SoloTripNativePackageTests._walk(node)
            if isinstance(value, dict) and "action" in value
        ]

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
            "schedule_ready",
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

    def test_active_reconcile_treats_offline_or_incomplete_cached_schedule_as_non_authoritative(self) -> None:
        divergence = self._choice("Active SleepyPod schedule diverged")
        presence = self._choice("Presence evidence updated")
        deferred_end = self._choice("Solo Trip end deferred until the SleepyPod schedule is readable")
        ending = self._choice("Solo Trip ended")

        matching = self._schedule_context(
            schedule=self.schedule_fixture,
            sensor_state="ready",
        )
        self.assertTrue(matching["current_schedule_ready"])
        self.assertTrue(matching["current_away_overlay_matches"])
        self.assertFalse(self._render(divergence["conditions"], matching))

        for sensor_state in ("unknown", "unavailable", "offline"):
            unavailable = self._schedule_context(
                schedule=self.schedule_fixture,
                sensor_state=sensor_state,
                enabled=False,
                traveler_state="not_home",
            )
            with self.subTest(sensor_state=sensor_state):
                self.assertFalse(unavailable["current_schedule_ready"])
                self.assertFalse(unavailable["current_away_overlay_matches"])
                self.assertFalse(self._render(divergence["conditions"], unavailable))
                self.assertTrue(self._render(presence["conditions"], unavailable))
                self.assertTrue(self._render(deferred_end["conditions"], unavailable))
                self.assertFalse(self._render(ending["conditions"], unavailable))
                self.assertEqual(self._actions(deferred_end["sequence"]), [])

        for missing_side in ("left", "right"):
            for state in ("missing", "empty"):
                incomplete = deepcopy(self.schedule_fixture)
                if state == "missing":
                    del incomplete[missing_side]
                else:
                    incomplete[missing_side] = {}
                context = self._schedule_context(schedule=incomplete)
                with self.subTest(missing_side=missing_side, state=state):
                    self.assertFalse(context["current_schedule_ready"])
                    self.assertFalse(self._render(divergence["conditions"], context))

        reconnected = self._schedule_context(
            schedule=self.schedule_fixture,
            sensor_state="ready",
        )
        self.assertTrue(reconnected["current_schedule_ready"])
        self.assertTrue(reconnected["current_away_overlay_matches"])
        self.assertFalse(self._render(divergence["conditions"], reconnected))

    def test_active_reconcile_flags_real_schedule_changes_for_both_travelers(self) -> None:
        divergence = self._choice("Active SleepyPod schedule diverged")
        for traveler, away_side in (("stephen", "left"), ("steph", "right")):
            original = deepcopy(self.schedule_fixture)
            changed = deepcopy(original)
            alarms = changed[away_side]["monday"]["alarms"]
            if alarms:
                alarms[0]["time"] = "08:42"
            else:
                alarms.append(
                    {
                        "alarmTemperature": 81,
                        "duration": 90,
                        "enabled": True,
                        "time": "08:42",
                        "vibrationIntensity": 80,
                        "vibrationPattern": "pulse",
                    }
                )
            confirmed = self._fingerprint(original[away_side])
            context = self._schedule_context(
                schedule=changed,
                traveler=traveler,
                confirmed_fingerprint=confirmed,
            )
            with self.subTest(traveler=traveler):
                self.assertTrue(context["current_schedule_ready"])
                self.assertFalse(context["current_away_overlay_matches"])
                self.assertTrue(self._render(divergence["conditions"], context))

    def test_end_waits_for_schedule_and_restore_required_stays_sticky(self) -> None:
        deferred_end = self._choice("Solo Trip end deferred until the SleepyPod schedule is readable")
        ending = self._choice("Solo Trip ended")

        offline = self._schedule_context(
            schedule=self.schedule_fixture,
            sensor_state="unavailable",
            enabled=False,
        )
        self.assertTrue(self._render(deferred_end["conditions"], offline))
        self.assertFalse(self._render(ending["conditions"], offline))

        ready = self._schedule_context(
            schedule=self.schedule_fixture,
            enabled=False,
        )
        self.assertFalse(self._render(deferred_end["conditions"], ready))
        self.assertTrue(self._render(ending["conditions"], ready))

        for sensor_state in ("ready", "unavailable"):
            restore_required = self._schedule_context(
                schedule=self.schedule_fixture,
                sensor_state=sensor_state,
                journal_phase="restore_required",
                enabled=False,
                vacation=True,
                plan_end_timestamp=50,
                now_timestamp=100,
                traveler_state="home",
                post_start_away=True,
            )
            with self.subTest(sensor_state=sensor_state):
                self.assertFalse(restore_required["active_end_requested"])
                self.assertFalse(self._render(deferred_end["conditions"], restore_required))
                self.assertFalse(self._render(ending["conditions"], restore_required))

    def test_restore_saved_requires_readable_schedule_but_keep_current_does_not(self) -> None:
        guard = self._choice(
            "Saved SleepyPod schedule cannot be restored until the current schedule is readable"
        )
        unavailable = self._schedule_context(
            schedule=self.schedule_fixture,
            sensor_state="unavailable",
            journal_phase="restore_required",
        )
        unavailable["normalized_resolve_action"] = "restore_saved"
        self.assertTrue(self._render(guard["conditions"], unavailable))
        self.assertEqual(self._actions(guard["sequence"]), [])

        unavailable["normalized_resolve_action"] = "keep_current"
        self.assertFalse(self._render(guard["conditions"], unavailable))

        readable = self._schedule_context(
            schedule=self.schedule_fixture,
            journal_phase="restore_required",
        )
        readable["normalized_resolve_action"] = "restore_saved"
        self.assertFalse(self._render(guard["conditions"], readable))

    def test_schedule_writes_and_echoes_reject_offline_cached_attributes(self) -> None:
        command_guard = self._choice("Current SleepyPod schedule is not readable")
        offline = self._schedule_context(
            schedule=self.schedule_fixture,
            sensor_state="unavailable",
        )
        offline.update(
            normalized_sleepypod_action="set_schedule",
            internal_sleepypod_bypass=False,
        )
        self.assertTrue(self._render(command_guard["conditions"], offline))
        self.assertEqual(self._actions(command_guard["sequence"]), [])

        waits = [
            node["wait_template"]
            for node in self._walk(self.script_sequence)
            if "wait_template" in node
            and "full_schedule_fingerprint" in node["wait_template"]
        ]
        self.assertEqual(len(waits), 4)
        self.assertTrue(all("schedule_ready" in wait_template for wait_template in waits))
        expected_fingerprint = self._full_fingerprint(self.schedule_fixture)
        for sensor_state, expected in (("unavailable", False), ("ready", True)):
            context = self._schedule_context(
                schedule=self.schedule_fixture,
                sensor_state=sensor_state,
            )
            context.update(
                mirrored_full_schedule_fingerprint=expected_fingerprint,
                restored_full_schedule_fingerprint=expected_fingerprint,
                resolve_full_schedule_fingerprint=expected_fingerprint,
                sleepypod_full_schedule_fingerprint=expected_fingerprint,
            )
            for wait_template in waits:
                with self.subTest(sensor_state=sensor_state, wait_template=wait_template[:48]):
                    self.assertIs(self._render(wait_template, context), expected)

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
