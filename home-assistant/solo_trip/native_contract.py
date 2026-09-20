"""Deterministic Solo Trip native contract helpers."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import json
import math
from typing import Any, Mapping


CONTRACT_VERSION = 1
SCHEMA_VERSION = 1
CANONICALIZATION_VERSION = 1
MAX_REQUEST_RESULTS = 64
SOLO_MODE = "solo_trip"
WAKE_LIGHT_PROFILE_ID = "master-bedroom"
PUBLIC_STATES = {
    "idle",
    "scheduled",
    "activating",
    "active",
    "degraded",
    "ending",
    "restore_required",
}
TOPICS = {
    "journal": "household_away/native/journal",
    "status": "household_away/native/status",
    "sleepypod_schedule": "sleepypod/eight-pod/cmd/set-schedules",
}
TRAVELER_TO_PERSON = {
    "stephen": "person.stephen_fenton",
    "steph": "person.stephanie_hobart",
}
TRAVELER_TO_AWAY_SIDE = {
    "stephen": "left",
    "steph": "right",
}
HOME_RESIDENT_BY_TRAVELER = {
    "stephen": "steph",
    "steph": "stephen",
}
SIDE_TO_RESIDENT = {
    "left": "stephen",
    "right": "steph",
}
ALARM_STOP_BUTTON_BY_SIDE = {
    "left": "button.master_bedroom_sleepypod_eight_pod_left_alarm_stop",
    "right": "button.master_bedroom_sleepypod_eight_pod_right_alarm_stop",
}
ALARM_SNOOZE_BUTTON_BY_SIDE = {
    "left": "button.master_bedroom_sleepypod_eight_pod_left_alarm_snooze",
    "right": "button.master_bedroom_sleepypod_eight_pod_right_alarm_snooze",
}
TONIGHT_SCRIPT_BY_RESIDENT = {
    "stephen": "script.sleepypod_stephen_temperature_tonight",
    "steph": "script.sleepypod_steph_temperature_tonight",
}
OUTSIDE_SCRIPT_BY_RESIDENT = {
    "stephen": "script.sleepypod_stephen_temperature_outside_schedule",
    "steph": "script.sleepypod_steph_temperature_outside_schedule",
}
POWER_ENTITY_BY_SIDE = {
    "left": "climate.sleepypod_eight_pod_left_side",
    "right": "climate.sleepypod_eight_pod_right_side",
}
STAGE_INPUT_NUMBER_BY_RESIDENT_PHASE = {
    ("stephen", "bedtime"): "input_number.eight_sleep_stephen_bedtime_level",
    ("stephen", "asleep"): "input_number.eight_sleep_stephen_asleep_level",
    ("stephen", "dawn"): "input_number.eight_sleep_stephen_dawn_level",
    ("steph", "bedtime"): "input_number.eight_sleep_steph_bedtime_level",
    ("steph", "asleep"): "input_number.eight_sleep_steph_asleep_level",
    ("steph", "dawn"): "input_number.eight_sleep_steph_dawn_level",
}
WEEKDAYS = (
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
)
PUBLIC_STATUS_KEYS = (
    "contract_version",
    "revision",
    "command_available",
    "mode",
    "traveler",
    "home_resident",
    "starts_at",
    "ends_at",
    "blockers",
    "effects",
    "restore_required",
    "release_token",
    "state",
)
PRIVATE_PUBLIC_FIELDS = {
    "sleepypod_baseline",
    "baseline_fingerprint",
    "last_confirmed_overlay_fingerprint",
    "writer_owner",
    "wake_owner_ref",
    "wake_prior_state",
    "wake_source_ref",
    "payload_checksum",
    "pending_request",
    "request_results",
    "runtime_plan",
}
JOURNAL_REQUIRED_FIELDS = (
    "schema_version",
    "canonicalization_version",
    "generation",
    "revision",
    "solo_phase",
    "writer_owner",
    "release_token",
    "runtime_plan",
    "sleepypod_baseline",
    "baseline_fingerprint",
    "last_confirmed_overlay_fingerprint",
    "wake_source_ref",
    "wake_owner_ref",
    "wake_prior_state",
    "presence_evidence",
    "pending_request",
    "restore_record",
    "request_results",
    "payload_checksum",
)


@dataclass(frozen=True)
class CommandResult:
    journal: dict[str, Any]
    public_status: dict[str, Any]
    response: dict[str, Any]
    published_schedule: dict[str, Any] | None = None
    service_calls: list[dict[str, Any]] = field(default_factory=list)
    helper_updates: list[dict[str, Any]] = field(default_factory=list)


def canonical_json(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def fingerprint(payload: Any) -> str:
    return hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def observable_schedule_value(payload: Any) -> Any:
    if isinstance(payload, Mapping):
        return {
            key: observable_schedule_value(value)
            for key, value in payload.items()
            if key != "id"
        }
    if isinstance(payload, list):
        return [observable_schedule_value(value) for value in payload]
    return payload


def observable_schedule_fingerprint(payload: Any) -> str:
    return fingerprint(observable_schedule_value(payload))


def payload_checksum(payload: Mapping[str, Any]) -> str:
    unsigned = deepcopy(dict(payload))
    unsigned.pop("payload_checksum", None)
    return fingerprint(unsigned)


def attach_payload_checksum(payload: Mapping[str, Any]) -> dict[str, Any]:
    copy = deepcopy(dict(payload))
    copy["payload_checksum"] = payload_checksum(copy)
    return copy


def utc_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def stable_release_token(revision: int) -> str:
    return f"release-v1-r{revision}"


def side_for_traveler(traveler: str) -> str:
    return TRAVELER_TO_AWAY_SIDE[traveler]


def home_side_for_traveler(traveler: str) -> str:
    return "right" if side_for_traveler(traveler) == "left" else "left"


def wake_source_ref_for_traveler(traveler: str) -> str:
    return f"sleepypod:{side_for_traveler(traveler)}"


def clone_schedule(schedule: Mapping[str, Any]) -> dict[str, Any]:
    copy = deepcopy(dict(schedule))
    copy.setdefault("left", {})
    copy.setdefault("right", {})
    return copy


def validate_schedule_shape(schedule: Mapping[str, Any] | None) -> bool:
    return (
        isinstance(schedule, Mapping)
        and isinstance(schedule.get("left"), Mapping)
        and isinstance(schedule.get("right"), Mapping)
    )


def current_away_side(schedule: Mapping[str, Any], traveler: str) -> dict[str, Any]:
    return deepcopy(dict(schedule[side_for_traveler(traveler)]))


def merge_schedule(
    current: Mapping[str, Any],
    incoming: Mapping[str, Any],
    *,
    side: str,
    mirror: bool,
    home_side: str,
    away_side: str,
) -> dict[str, Any]:
    merged = clone_schedule(current)
    if "left" in incoming or "right" in incoming:
        if isinstance(incoming.get("left"), Mapping):
            merged["left"] = deepcopy(dict(incoming["left"]))
        if isinstance(incoming.get("right"), Mapping):
            merged["right"] = deepcopy(dict(incoming["right"]))
    else:
        merged[side] = deepcopy(dict(incoming))
    if mirror:
        merged[away_side] = deepcopy(merged[home_side])
    return merged


def mirror_home_side_schedule(schedule: Mapping[str, Any], traveler: str) -> dict[str, Any]:
    home_side = home_side_for_traveler(traveler)
    away_side = side_for_traveler(traveler)
    return merge_schedule(
        schedule,
        schedule[home_side],
        side=home_side,
        mirror=True,
        home_side=home_side,
        away_side=away_side,
    )


def restored_schedule(
    current_schedule: Mapping[str, Any],
    baseline: Mapping[str, Any],
    *,
    away_side: str,
) -> dict[str, Any]:
    restored = clone_schedule(current_schedule)
    restored[away_side] = deepcopy(dict(baseline))
    return restored


def replace_alarm_rows(
    current_schedule: Mapping[str, Any],
    *,
    side: str,
    alarm_rows: list[Mapping[str, Any]],
    mirror: bool,
    home_side: str,
    away_side: str,
) -> dict[str, Any]:
    working = clone_schedule(current_schedule)
    side_schedule = deepcopy(dict(working[side]))
    for weekday in WEEKDAYS:
        day_state = deepcopy(dict(side_schedule.get(weekday, {})))
        day_state["alarms"] = [
            {
                "alarmTemperature": row["alarmTemperature"],
                "duration": row["duration"],
                "enabled": row["enabled"],
                "time": row["time"],
                "vibrationIntensity": row["vibrationIntensity"],
                "vibrationPattern": row["vibrationPattern"],
            }
            for row in alarm_rows
            if row.get("day") == weekday
        ]
        side_schedule[weekday] = day_state
    working[side] = side_schedule
    if mirror:
        working[away_side] = deepcopy(working[home_side])
    return working


def overlay_fingerprint(schedule: Mapping[str, Any], traveler: str) -> str:
    return observable_schedule_fingerprint(schedule[side_for_traveler(traveler)])


def initial_journal(*, release_token: str = "bootstrap-v1") -> dict[str, Any]:
    return attach_payload_checksum(
        {
            "schema_version": SCHEMA_VERSION,
            "canonicalization_version": CANONICALIZATION_VERSION,
            "generation": 0,
            "revision": 0,
            "solo_phase": "idle",
            "writer_owner": None,
            "release_token": release_token,
            "runtime_plan": None,
            "sleepypod_baseline": None,
            "baseline_fingerprint": None,
            "last_confirmed_overlay_fingerprint": None,
            "wake_source_ref": None,
            "wake_owner_ref": None,
            "wake_prior_state": None,
            "presence_evidence": {},
            "pending_request": None,
            "restore_record": None,
            "request_results": [],
            "payload_checksum": "",
        }
    )


def valid_journal_contract(payload: Mapping[str, Any] | None) -> bool:
    if not isinstance(payload, Mapping):
        return False
    if any(field not in payload for field in JOURNAL_REQUIRED_FIELDS):
        return False
    if payload.get("schema_version") != SCHEMA_VERSION:
        return False
    if payload.get("canonicalization_version") != CANONICALIZATION_VERSION:
        return False
    if payload.get("solo_phase") not in PUBLIC_STATES:
        return False
    if not isinstance(payload.get("generation"), int) or payload["generation"] < 0:
        return False
    if not isinstance(payload.get("revision"), int) or payload["revision"] < 0:
        return False
    if not isinstance(payload.get("release_token"), str) or not payload["release_token"]:
        return False
    if not isinstance(payload.get("request_results"), list):
        return False
    pending = payload.get("pending_request")
    if pending is not None and not isinstance(pending, Mapping):
        return False
    return payload.get("payload_checksum") == payload_checksum(payload)


def status_command_available(
    journal: Mapping[str, Any],
    *,
    status_revision: int | None,
    status_release_token: str | None,
) -> bool:
    if not valid_journal_contract(journal):
        return False
    if status_revision == journal.get("revision") and status_release_token == journal.get("release_token"):
        return True
    pending = journal.get("pending_request")
    return bool(
        isinstance(pending, Mapping)
        and pending.get("revision") == status_revision
        and pending.get("release_token") == status_release_token
    )


def build_public_status(
    journal: Mapping[str, Any],
    *,
    blockers: list[str] | None = None,
    effects: Mapping[str, bool] | None = None,
    status_revision: int | None = None,
    status_release_token: str | None = None,
) -> dict[str, Any]:
    plan = journal.get("runtime_plan") if isinstance(journal.get("runtime_plan"), Mapping) else {}
    phase = journal.get("solo_phase") if journal.get("solo_phase") in PUBLIC_STATES else "idle"
    restore_required = phase == "restore_required" or journal.get("restore_record") is not None
    default_effects = {
        "sleepypod_live_follow": phase in {"active", "ending"},
        "sleepypod_schedule": phase in {"active", "ending"},
        "wake_light_source": phase in {"active", "ending"},
    }
    if effects:
        default_effects.update({key: bool(value) for key, value in effects.items()})
    status_revision = journal["revision"] if status_revision is None else status_revision
    status_release_token = journal["release_token"] if status_release_token is None else status_release_token
    return {
        "contract_version": CONTRACT_VERSION,
        "revision": int(journal.get("revision", 0)),
        "command_available": status_command_available(
            journal,
            status_revision=status_revision,
            status_release_token=status_release_token,
        ),
        "mode": SOLO_MODE if plan else "none",
        "traveler": plan.get("traveler", "none"),
        "home_resident": plan.get("home_resident", "none"),
        "starts_at": plan.get("starts_at"),
        "ends_at": plan.get("ends_at"),
        "blockers": list(blockers or []),
        "effects": default_effects,
        "restore_required": restore_required,
        "release_token": journal.get("release_token"),
        "state": phase,
    }


def valid_public_status(payload: Mapping[str, Any] | None) -> bool:
    if not isinstance(payload, Mapping):
        return False
    if any(key not in payload for key in PUBLIC_STATUS_KEYS):
        return False
    if payload.get("contract_version") != CONTRACT_VERSION:
        return False
    if payload.get("state") not in PUBLIC_STATES:
        return False
    if payload.get("mode") not in {"none", SOLO_MODE, "vacation"}:
        return False
    return not any(key in payload for key in PRIVATE_PUBLIC_FIELDS)


def writer_released(journal: Mapping[str, Any], public_status: Mapping[str, Any]) -> bool:
    return (
        valid_journal_contract(journal)
        and valid_public_status(public_status)
        and journal.get("writer_owner") in {None, ""}
        and journal.get("pending_request") is None
        and journal.get("restore_record") is None
        and journal.get("solo_phase") in {"idle", "scheduled"}
        and public_status.get("restore_required") is False
        and public_status.get("command_available") is True
        and journal.get("release_token") == public_status.get("release_token")
    )


def validate_request_id(value: str | None) -> bool:
    return isinstance(value, str) and bool(value.strip())


def request_hash(request: Mapping[str, Any]) -> str:
    return fingerprint({key: value for key, value in dict(request).items() if key != "expected_revision"})


def find_request_result(journal: Mapping[str, Any], request_id: str) -> Mapping[str, Any] | None:
    pending = journal.get("pending_request")
    if isinstance(pending, Mapping) and pending.get("request_id") == request_id:
        return pending
    matches = [
        item
        for item in journal.get("request_results", [])
        if isinstance(item, Mapping) and item.get("request_id") == request_id
    ]
    return matches[-1] if matches else None


def _response(
    journal: Mapping[str, Any],
    request_id: str,
    status: str,
    *,
    state: str | None = None,
    error_code: str | None = None,
    retryable: bool = False,
    confirmed_effects: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "request_id": request_id,
        "status": status,
        "revision": int(journal["revision"]),
        "state": state or str(journal["solo_phase"]),
        "error_code": error_code,
        "retryable": retryable,
        "confirmed_effects": list(confirmed_effects or []),
    }


def _pending_request(
    request: Mapping[str, Any],
    response: Mapping[str, Any],
    *,
    revision: int,
    release_token: str,
    state: str,
) -> dict[str, Any]:
    return {
        "request_id": request["request_id"],
        "request_hash": request_hash(request),
        "operation": request["operation"],
        "revision": revision,
        "release_token": release_token,
        "state": state,
        "response": dict(response),
        "terminal": False,
    }


def _set_pending_request(
    journal: Mapping[str, Any],
    request: Mapping[str, Any],
    response: Mapping[str, Any],
    *,
    revision: int,
    release_token: str,
    state: str,
) -> dict[str, Any]:
    updated = deepcopy(dict(journal))
    updated["pending_request"] = _pending_request(
        request,
        response,
        revision=revision,
        release_token=release_token,
        state=state,
    )
    return attach_payload_checksum(updated)


def _record_terminal_result(
    journal: Mapping[str, Any],
    request: Mapping[str, Any],
    response: Mapping[str, Any],
) -> dict[str, Any]:
    updated = deepcopy(dict(journal))
    entries = [
        item
        for item in updated.get("request_results", [])
        if not (isinstance(item, Mapping) and item.get("request_id") == request["request_id"])
    ]
    entries.append(
        {
            "request_id": request["request_id"],
            "request_hash": request_hash(request),
            "response": dict(response),
            "terminal": True,
        }
    )
    if len(entries) > MAX_REQUEST_RESULTS:
        entries = entries[-MAX_REQUEST_RESULTS:]
    updated["request_results"] = entries
    updated["pending_request"] = None
    return attach_payload_checksum(updated)


def _replay_or_reject(
    journal: Mapping[str, Any],
    request: Mapping[str, Any],
    *,
    allow_replay: bool,
) -> CommandResult | None:
    if not allow_replay:
        return None
    prior = find_request_result(journal, str(request.get("request_id", "")))
    if prior is None:
        return None
    if prior.get("request_hash") != request_hash(request):
        response = _response(journal, request["request_id"], "rejected", error_code="request_id_conflict")
        recorded = _record_terminal_result(journal, request, response)
        return CommandResult(recorded, build_public_status(recorded), response)
    response = prior.get("response")
    if not isinstance(response, Mapping):
        response = _response(journal, request["request_id"], "rejected", error_code="request_replay_corrupt")
    return CommandResult(dict(journal), build_public_status(journal), dict(response), service_calls=[])


def _reject(
    journal: Mapping[str, Any],
    request: Mapping[str, Any],
    error_code: str,
    *,
    retryable: bool = False,
    record_history: bool = True,
) -> CommandResult:
    response = _response(journal, request["request_id"], "rejected", error_code=error_code, retryable=retryable)
    recorded = _record_terminal_result(journal, request, response) if record_history else dict(journal)
    return CommandResult(recorded, build_public_status(recorded), response)


def _accept(
    journal: Mapping[str, Any],
    request: Mapping[str, Any],
    *,
    confirmed_effects: list[str],
    published_schedule: dict[str, Any] | None = None,
    service_calls: list[dict[str, Any]] | None = None,
    helper_updates: list[dict[str, Any]] | None = None,
    blockers: list[str] | None = None,
    effects: Mapping[str, bool] | None = None,
    record_history: bool = True,
) -> CommandResult:
    response = _response(journal, request["request_id"], "accepted", confirmed_effects=confirmed_effects)
    recorded = _record_terminal_result(journal, request, response) if record_history else dict(journal)
    return CommandResult(
        recorded,
        build_public_status(recorded, blockers=blockers, effects=effects),
        response,
        published_schedule,
        service_calls or [],
        helper_updates or [],
    )


def _pending_indeterminate(
    journal: Mapping[str, Any],
    request: Mapping[str, Any],
    *,
    state: str,
    error_code: str,
    retryable: bool = True,
    revision: int | None = None,
    release_token: str | None = None,
    blockers: list[str] | None = None,
    effects: Mapping[str, bool] | None = None,
) -> CommandResult:
    response = _response(
        journal,
        request["request_id"],
        "indeterminate",
        state=state,
        error_code=error_code,
        retryable=retryable,
    )
    revision = journal["revision"] if revision is None else revision
    release_token = journal["release_token"] if release_token is None else release_token
    pending = _set_pending_request(
        journal,
        request,
        response,
        revision=revision,
        release_token=release_token,
        state=state,
    )
    return CommandResult(
        pending,
        build_public_status(
            pending,
            blockers=blockers,
            effects=effects,
            status_revision=revision,
            status_release_token=release_token,
        ),
        response,
    )


def _restore_required(
    journal: Mapping[str, Any],
    request: Mapping[str, Any],
    *,
    error_code: str,
    restore_reason: str,
    blockers: list[str],
    effects: Mapping[str, bool],
    record_history: bool,
    published_schedule: dict[str, Any] | None = None,
    service_calls: list[dict[str, Any]] | None = None,
) -> CommandResult:
    updated = deepcopy(dict(journal))
    updated["solo_phase"] = "restore_required"
    updated["restore_record"] = {"reason": restore_reason}
    response = _response(
        updated,
        request["request_id"],
        "indeterminate",
        state="restore_required",
        error_code=error_code,
    )
    if record_history:
        updated = _set_pending_request(
            updated,
            request,
            response,
            revision=updated["revision"],
            release_token=updated["release_token"],
            state="restore_required",
        )
    else:
        updated = attach_payload_checksum(updated)
    return CommandResult(
        updated,
        build_public_status(updated, blockers=blockers, effects=effects),
        response,
        published_schedule,
        service_calls or [],
    )


def schedule_solo_trip(
    journal: Mapping[str, Any],
    *,
    request_id: str,
    expected_revision: int,
    traveler: str,
    starts_at: str,
    ends_at: str,
    now: datetime,
    status_echo_ok: bool = True,
) -> CommandResult:
    request = {
        "operation": "schedule",
        "mode": SOLO_MODE,
        "request_id": request_id,
        "expected_revision": expected_revision,
        "traveler": traveler,
        "starts_at": starts_at,
        "ends_at": ends_at,
    }
    replay = _replay_or_reject(journal, request, allow_replay=True)
    if replay is not None:
        return replay
    if not validate_request_id(request_id):
        return _reject(journal, request, "missing_request_id")
    if expected_revision != journal["revision"]:
        return _reject(journal, request, "expected_revision_mismatch")
    if journal["solo_phase"] != "idle":
        return _reject(journal, request, "solo_trip_already_configured")
    if traveler not in TRAVELER_TO_PERSON:
        return _reject(journal, request, "unknown_traveler")
    start_dt = datetime.fromisoformat(starts_at)
    end_dt = datetime.fromisoformat(ends_at)
    if end_dt <= start_dt:
        return _reject(journal, request, "invalid_dates")
    updated = deepcopy(dict(journal))
    updated["generation"] += 1
    updated["revision"] += 1
    updated["solo_phase"] = "scheduled"
    updated["release_token"] = stable_release_token(updated["revision"])
    updated["runtime_plan"] = {
        "mode": SOLO_MODE,
        "traveler": traveler,
        "traveler_person_entity_id": TRAVELER_TO_PERSON[traveler],
        "home_resident": HOME_RESIDENT_BY_TRAVELER[traveler],
        "away_side": side_for_traveler(traveler),
        "home_side": home_side_for_traveler(traveler),
        "starts_at": starts_at,
        "ends_at": ends_at,
        "started_at": None,
    }
    updated["restore_record"] = None
    updated["writer_owner"] = None
    updated["wake_source_ref"] = None
    updated["wake_owner_ref"] = None
    updated["wake_prior_state"] = None
    updated["sleepypod_baseline"] = None
    updated["baseline_fingerprint"] = None
    updated["last_confirmed_overlay_fingerprint"] = None
    updated["presence_evidence"] = {}
    updated = attach_payload_checksum(updated)
    if not status_echo_ok:
        return _pending_indeterminate(
            updated,
            request,
            state="scheduled",
            error_code="status_echo_timeout",
            revision=updated["revision"],
            release_token=updated["release_token"],
        )
    return _accept(
        updated,
        request,
        confirmed_effects=["journal_committed", "status_committed"],
        effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
    )


def cancel_solo_trip(
    journal: Mapping[str, Any],
    *,
    request_id: str,
    expected_revision: int,
    status_echo_ok: bool = True,
) -> CommandResult:
    request = {
        "operation": "cancel",
        "request_id": request_id,
        "expected_revision": expected_revision,
    }
    replay = _replay_or_reject(journal, request, allow_replay=True)
    if replay is not None:
        return replay
    if expected_revision != journal["revision"]:
        return _reject(journal, request, "expected_revision_mismatch")
    if journal["solo_phase"] not in {"scheduled", "idle"}:
        return _reject(journal, request, "solo_trip_not_scheduled")
    updated = initial_journal(release_token=stable_release_token(journal["revision"] + 1))
    updated["generation"] = journal["generation"] + 1
    updated["revision"] = journal["revision"] + 1
    updated = attach_payload_checksum(updated)
    if not status_echo_ok:
        return _pending_indeterminate(
            updated,
            request,
            state="idle",
            error_code="status_echo_timeout",
            revision=updated["revision"],
            release_token=updated["release_token"],
        )
    return _accept(
        updated,
        request,
        confirmed_effects=["writer_released"],
        effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
    )


def update_end_solo_trip(
    journal: Mapping[str, Any],
    *,
    request_id: str,
    expected_revision: int,
    ends_at: str,
    status_echo_ok: bool = True,
) -> CommandResult:
    request = {
        "operation": "update_end",
        "request_id": request_id,
        "expected_revision": expected_revision,
        "ends_at": ends_at,
    }
    replay = _replay_or_reject(journal, request, allow_replay=True)
    if replay is not None:
        return replay
    if expected_revision != journal["revision"]:
        return _reject(journal, request, "expected_revision_mismatch")
    plan = journal.get("runtime_plan")
    if not isinstance(plan, Mapping):
        return _reject(journal, request, "missing_runtime_plan")
    if datetime.fromisoformat(ends_at) <= datetime.fromisoformat(plan["starts_at"]):
        return _reject(journal, request, "invalid_dates")
    updated = deepcopy(dict(journal))
    updated["generation"] += 1
    updated["revision"] += 1
    updated["release_token"] = stable_release_token(updated["revision"]) if journal["solo_phase"] == "scheduled" else journal["release_token"]
    updated["runtime_plan"] = {**plan, "ends_at": ends_at}
    updated = attach_payload_checksum(updated)
    if not status_echo_ok:
        return _pending_indeterminate(
            updated,
            request,
            state=str(updated["solo_phase"]),
            error_code="status_echo_timeout",
            revision=updated["revision"],
            release_token=updated["release_token"],
        )
    return _accept(
        updated,
        request,
        confirmed_effects=["journal_committed", "status_committed"],
        effects=build_public_status(updated)["effects"],
    )


def activate_solo_trip(
    journal: Mapping[str, Any],
    *,
    request_id: str,
    schedule: Mapping[str, Any],
    now: datetime,
    traveler_state: str,
    wake_light_state: str = "ready",
    wake_light_revision: int = 0,
    wake_outcome: str = "accepted",
    away_alarm_state: str = "idle",
    vacation_mode: bool = False,
    schedule_before_effects: Mapping[str, Any] | None = None,
    claim_echo_ok: bool = True,
    baseline_echo_ok: bool = True,
    activating_status_echo_ok: bool = True,
    alarm_clear_ok: bool = True,
    schedule_echo_ok: bool = True,
    active_journal_echo_ok: bool = True,
    active_status_echo_ok: bool = True,
) -> CommandResult:
    request = {
        "operation": "reconcile",
        "request_id": request_id,
        "expected_revision": journal["revision"],
        "reason": "due_start",
    }
    plan = journal.get("runtime_plan") if isinstance(journal.get("runtime_plan"), Mapping) else None
    if journal["solo_phase"] != "scheduled" or not plan:
        return _reject(journal, request, "not_due", record_history=False)
    if vacation_mode:
        return _reject(journal, request, "vacation_mode_conflict", record_history=False)
    start_dt = datetime.fromisoformat(plan["starts_at"])
    end_dt = datetime.fromisoformat(plan["ends_at"])
    if now < start_dt:
        return _reject(journal, request, "not_due", record_history=False)
    if now >= end_dt:
        expired = initial_journal(release_token=stable_release_token(journal["revision"] + 1))
        expired["generation"] = journal["generation"] + 1
        expired["revision"] = journal["revision"] + 1
        expired = attach_payload_checksum(expired)
        return _accept(expired, request, confirmed_effects=["writer_released"], record_history=False)
    if not validate_schedule_shape(schedule):
        return _reject(journal, request, "schedule_unavailable", retryable=True, record_history=False)
    traveler = str(plan["traveler"])
    away_side = side_for_traveler(traveler)
    home_side = home_side_for_traveler(traveler)
    writer_owner = f"solo_trip:{request_id}"
    activating = deepcopy(dict(journal))
    activating["generation"] += 1
    activating["revision"] += 1
    activating["solo_phase"] = "activating"
    activating["writer_owner"] = writer_owner
    activating["release_token"] = stable_release_token(activating["revision"])
    activating["wake_source_ref"] = wake_source_ref_for_traveler(traveler)
    activating["wake_owner_ref"] = writer_owner
    activating["wake_prior_state"] = wake_light_state
    activating = attach_payload_checksum(activating)
    if not claim_echo_ok:
        return _restore_required(
            activating,
            request,
            error_code="claim_echo_timeout",
            restore_reason="claim_echo_timeout",
            blockers=["journal_claim_echo_timeout"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
            record_history=False,
        )

    baseline = current_away_side(schedule, traveler)
    baseline_committed = deepcopy(dict(activating))
    baseline_committed["generation"] += 1
    baseline_committed["runtime_plan"] = {**plan, "started_at": utc_iso(now)}
    baseline_committed["sleepypod_baseline"] = baseline
    baseline_committed["baseline_fingerprint"] = observable_schedule_fingerprint(baseline)
    baseline_committed["presence_evidence"] = {
        "entity_id": TRAVELER_TO_PERSON[traveler],
        "observed_at": utc_iso(now),
        "observed_state": traveler_state,
        "post_start_away": traveler_state not in {"home", "unknown", "unavailable"},
    }
    baseline_committed = attach_payload_checksum(baseline_committed)
    if not baseline_echo_ok:
        return _restore_required(
            baseline_committed,
            request,
            error_code="baseline_echo_timeout",
            restore_reason="baseline_echo_timeout",
            blockers=["journal_baseline_echo_timeout"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
            record_history=False,
        )
    if not activating_status_echo_ok:
        return _restore_required(
            baseline_committed,
            request,
            error_code="activating_status_echo_timeout",
            restore_reason="activating_status_echo_timeout",
            blockers=["activating_status_echo_timeout"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
            record_history=False,
        )
    if schedule_before_effects is not None and (
        not validate_schedule_shape(schedule_before_effects)
        or observable_schedule_fingerprint(schedule_before_effects[away_side])
        != baseline_committed["baseline_fingerprint"]
    ):
        divergent = deepcopy(dict(baseline_committed))
        divergent["restore_record"] = {"reason": "sleepypod_schedule_diverged"}
        divergent = attach_payload_checksum(divergent)
        return CommandResult(
            divergent,
            build_public_status(
                divergent,
                blockers=["sleepypod_schedule_diverged"],
                effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
            ),
            _response(divergent, request_id, "indeterminate", state="restore_required", error_code="restore_required_due_to_divergence"),
            service_calls=[],
        )
    service_calls = [
        {
            "domain": "wake_light",
            "service": "command",
            "data": {
                "profile_id": WAKE_LIGHT_PROFILE_ID,
                "expected_revision": wake_light_revision,
                "request_id": request_id,
                "operation": "set_source_suspension",
                "source_ref": wake_source_ref_for_traveler(traveler),
                "suspended": True,
                "owner_ref": writer_owner,
            },
        }
    ]
    if away_alarm_state in {"ringing", "snoozed"}:
        service_calls.append(
            {
                "domain": "button",
                "service": "press",
                "data": {"entity_id": ALARM_STOP_BUTTON_BY_SIDE[away_side]},
            }
        )
    if wake_outcome not in {"accepted", "no_change"}:
        return _restore_required(
            baseline_committed,
            request,
            error_code="wake_light_rejected",
            restore_reason="wake_light_rejected",
            blockers=["wake_light_rejected"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
            record_history=False,
            service_calls=service_calls,
        )
    if away_alarm_state in {"ringing", "snoozed"} and not alarm_clear_ok:
        return _restore_required(
            baseline_committed,
            request,
            error_code="away_alarm_clear_timeout",
            restore_reason="away_alarm_clear_timeout",
            blockers=["away_alarm_clear_timeout"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": True},
            record_history=False,
            service_calls=service_calls,
        )
    mirrored = merge_schedule(
        schedule,
        schedule[home_side],
        side=home_side,
        mirror=True,
        home_side=home_side,
        away_side=away_side,
    )
    if not schedule_echo_ok:
        timed_out = deepcopy(dict(baseline_committed))
        timed_out["last_confirmed_overlay_fingerprint"] = None
        timed_out = attach_payload_checksum(timed_out)
        return _restore_required(
            timed_out,
            request,
            error_code="schedule_echo_timeout",
            restore_reason="schedule_echo_timeout",
            blockers=["schedule_echo_timeout"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": True},
            record_history=False,
            published_schedule=mirrored,
            service_calls=service_calls,
        )
    active = deepcopy(dict(baseline_committed))
    active["generation"] += 1
    active["solo_phase"] = "active"
    active["last_confirmed_overlay_fingerprint"] = observable_schedule_fingerprint(mirrored[away_side])
    active = attach_payload_checksum(active)
    if not active_journal_echo_ok or not active_status_echo_ok:
        return _restore_required(
            active,
            request,
            error_code="status_echo_timeout",
            restore_reason="status_echo_timeout",
            blockers=["status_echo_timeout"],
            effects={"sleepypod_live_follow": True, "sleepypod_schedule": True, "wake_light_source": True},
            record_history=False,
            published_schedule=mirrored,
            service_calls=service_calls,
        )
    return _accept(
        active,
        request,
        confirmed_effects=["writer_claimed", "wake_light_source", "sleepypod_schedule"],
        published_schedule=mirrored,
        service_calls=service_calls,
        effects={"sleepypod_live_follow": True, "sleepypod_schedule": True, "wake_light_source": True},
        record_history=False,
    )


def update_presence_evidence(
    journal: Mapping[str, Any],
    *,
    observed_state: str,
    observed_at: datetime,
) -> dict[str, Any]:
    updated = deepcopy(dict(journal))
    evidence = dict(updated.get("presence_evidence", {}))
    evidence["observed_state"] = observed_state
    evidence["observed_at"] = utc_iso(observed_at)
    if observed_state not in {"home", "unknown", "unavailable"}:
        evidence["post_start_away"] = True
    updated["presence_evidence"] = evidence
    return attach_payload_checksum(updated)


def should_end_for_return(journal: Mapping[str, Any], *, traveler_state: str) -> bool:
    evidence = journal.get("presence_evidence")
    return bool(
        isinstance(evidence, Mapping)
        and evidence.get("post_start_away") is True
        and traveler_state == "home"
    )


def end_solo_trip(
    journal: Mapping[str, Any],
    *,
    request_id: str,
    expected_revision: int,
    current_schedule: Mapping[str, Any],
    reason: str,
    wake_light_revision: int = 0,
    wake_outcome: str = "accepted",
    away_alarm_state: str = "idle",
    ending_journal_echo_ok: bool = True,
    ending_status_echo_ok: bool = True,
    alarm_clear_ok: bool = True,
    schedule_echo_ok: bool = True,
    final_journal_echo_ok: bool = True,
    final_status_echo_ok: bool = True,
) -> CommandResult:
    request = {
        "operation": "end_now",
        "request_id": request_id,
        "expected_revision": expected_revision,
        "reason": reason,
    }
    replay = _replay_or_reject(journal, request, allow_replay=True)
    if replay is not None:
        return replay
    if expected_revision != journal["revision"]:
        return _reject(journal, request, "expected_revision_mismatch")
    plan = journal.get("runtime_plan") if isinstance(journal.get("runtime_plan"), Mapping) else None
    if journal["solo_phase"] not in {"active", "restore_required"} or not plan:
        return _reject(journal, request, "solo_trip_not_active")
    traveler = str(plan["traveler"])
    away_side = side_for_traveler(traveler)
    ending = deepcopy(dict(journal))
    ending["generation"] += 1
    ending["solo_phase"] = "ending"
    ending = attach_payload_checksum(ending)
    if not ending_journal_echo_ok or not ending_status_echo_ok:
        return _restore_required(
            ending,
            request,
            error_code="ending_barrier_timeout",
            restore_reason="ending_barrier_timeout",
            blockers=["ending_barrier_timeout"],
            effects={"sleepypod_live_follow": True, "sleepypod_schedule": True, "wake_light_source": True},
            record_history=True,
        )
    if away_alarm_state in {"ringing", "snoozed"} and not alarm_clear_ok:
        return _restore_required(
            ending,
            request,
            error_code="away_alarm_clear_timeout",
            restore_reason="away_alarm_clear_timeout",
            blockers=["away_alarm_clear_timeout"],
            effects={"sleepypod_live_follow": True, "sleepypod_schedule": True, "wake_light_source": True},
            record_history=True,
        )
    current_overlay_fingerprint = observable_schedule_fingerprint(current_schedule[away_side])
    if current_overlay_fingerprint != journal.get("last_confirmed_overlay_fingerprint"):
        divergent = deepcopy(dict(ending))
        divergent["restore_record"] = {
            "reason": "sleepypod_schedule_diverged",
            "observed_fingerprint": current_overlay_fingerprint,
        }
        divergent = attach_payload_checksum(divergent)
        return CommandResult(
            _set_pending_request(
                divergent,
                request,
                _response(divergent, request_id, "indeterminate", state="restore_required", error_code="restore_required_due_to_divergence"),
                revision=divergent["revision"],
                release_token=divergent["release_token"],
                state="restore_required",
            ),
            build_public_status(
                divergent,
                blockers=["sleepypod_schedule_diverged"],
                effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": True},
            ),
            _response(divergent, request_id, "indeterminate", state="restore_required", error_code="restore_required_due_to_divergence"),
        )
    if wake_outcome not in {"accepted", "no_change"}:
        return _restore_required(
            ending,
            request,
            error_code="wake_light_rejected",
            restore_reason="wake_light_rejected",
            blockers=["wake_light_rejected"],
            effects={"sleepypod_live_follow": True, "sleepypod_schedule": True, "wake_light_source": True},
            record_history=True,
        )
    published = restored_schedule(current_schedule, journal["sleepypod_baseline"], away_side=away_side)
    if not schedule_echo_ok:
        return _restore_required(
            ending,
            request,
            error_code="schedule_echo_timeout",
            restore_reason="schedule_echo_timeout",
            blockers=["schedule_echo_timeout"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": True},
            record_history=True,
            published_schedule=published,
        )
    released = initial_journal(release_token=stable_release_token(journal["revision"] + 1))
    released["generation"] = journal["generation"] + 1
    released["revision"] = journal["revision"] + 1
    released = attach_payload_checksum(released)
    if not final_journal_echo_ok or not final_status_echo_ok:
        return _restore_required(
            released,
            request,
            error_code="status_echo_timeout" if final_journal_echo_ok else "journal_echo_timeout",
            restore_reason="terminal_release_echo_timeout",
            blockers=["status_echo_timeout" if final_journal_echo_ok else "journal_echo_timeout"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
            record_history=True,
            published_schedule=published,
        )
    return _accept(
        released,
        request,
        confirmed_effects=["sleepypod_schedule", "wake_light_source", "writer_released"],
        published_schedule=published,
        service_calls=[
            {
                "domain": "wake_light",
                "service": "command",
                "data": {
                    "profile_id": WAKE_LIGHT_PROFILE_ID,
                    "expected_revision": wake_light_revision,
                    "request_id": request_id,
                    "operation": "set_source_suspension",
                    "source_ref": wake_source_ref_for_traveler(traveler),
                    "suspended": False,
                    "owner_ref": journal["wake_owner_ref"],
                },
            }
        ],
        helper_updates=[
            {"entity_id": "input_boolean.solo_trip_enabled", "state": "off"},
            {"entity_id": "input_select.solo_trip_traveler", "option": "none"},
        ],
        effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
    )


def resolve_restore(
    journal: Mapping[str, Any],
    *,
    request_id: str,
    expected_revision: int,
    current_schedule: Mapping[str, Any],
    action: str,
    wake_light_revision: int = 0,
    wake_outcome: str = "accepted",
    schedule_echo_ok: bool = True,
    final_journal_echo_ok: bool = True,
    final_status_echo_ok: bool = True,
) -> CommandResult:
    request = {
        "operation": "resolve_restore",
        "request_id": request_id,
        "expected_revision": expected_revision,
        "resolve_action": action,
    }
    replay = _replay_or_reject(journal, request, allow_replay=True)
    if replay is not None:
        return replay
    if expected_revision != journal["revision"]:
        return _reject(journal, request, "expected_revision_mismatch")
    if journal["solo_phase"] != "restore_required":
        return _reject(journal, request, "restore_not_required")
    plan = journal.get("runtime_plan") if isinstance(journal.get("runtime_plan"), Mapping) else None
    if not plan:
        return _reject(journal, request, "missing_runtime_plan")
    if action not in {"restore_saved", "keep_current"}:
        return _reject(journal, request, "unknown_resolve_action")
    if wake_outcome not in {"accepted", "no_change"}:
        return _pending_indeterminate(
            journal,
            request,
            state="restore_required",
            error_code="wake_light_rejected",
            revision=journal["revision"],
            release_token=journal["release_token"],
            blockers=["wake_light_rejected"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
        )
    traveler = str(plan["traveler"])
    away_side = side_for_traveler(traveler)
    published = (
        restored_schedule(current_schedule, journal["sleepypod_baseline"], away_side=away_side)
        if action == "restore_saved"
        else clone_schedule(current_schedule)
    )
    if action == "restore_saved" and not schedule_echo_ok:
        return _pending_indeterminate(
            journal,
            request,
            state="restore_required",
            error_code="schedule_echo_timeout",
            revision=journal["revision"],
            release_token=journal["release_token"],
            blockers=["schedule_echo_timeout"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": True},
        )
    released = initial_journal(release_token=stable_release_token(journal["revision"] + 1))
    released["generation"] = journal["generation"] + 1
    released["revision"] = journal["revision"] + 1
    released = attach_payload_checksum(released)
    if not final_journal_echo_ok or not final_status_echo_ok:
        return _restore_required(
            released,
            request,
            error_code="status_echo_timeout" if final_journal_echo_ok else "journal_echo_timeout",
            restore_reason="restore_release_echo_timeout",
            blockers=["status_echo_timeout" if final_journal_echo_ok else "journal_echo_timeout"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": action == "restore_saved", "wake_light_source": False},
            record_history=True,
            published_schedule=published,
        )
    confirmed = ["wake_light_source", "writer_released"]
    if action == "restore_saved":
        confirmed.insert(0, "sleepypod_schedule")
    return _accept(
        released,
        request,
        confirmed_effects=confirmed,
        published_schedule=published,
        service_calls=[
            {
                "domain": "wake_light",
                "service": "command",
                "data": {
                    "profile_id": WAKE_LIGHT_PROFILE_ID,
                    "expected_revision": wake_light_revision,
                    "request_id": request_id,
                    "operation": "set_source_suspension",
                    "source_ref": wake_source_ref_for_traveler(traveler),
                    "suspended": False,
                    "owner_ref": journal["wake_owner_ref"],
                },
            }
        ],
        helper_updates=[
            {"entity_id": "input_boolean.solo_trip_enabled", "state": "off"},
            {"entity_id": "input_select.solo_trip_traveler", "option": "none"},
        ],
        effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": False},
    )


def _validate_side(side: str) -> str | None:
    return None if side in {"left", "right"} else "invalid_side"


def _validate_level(level: float | None) -> str | None:
    return None if isinstance(level, (int, float)) and math.isfinite(level) else "invalid_level"


def _validate_enabled(enabled: bool | None) -> str | None:
    return None if isinstance(enabled, bool) else "missing_enabled"


def _validate_alarm_rows(alarm_rows: list[Mapping[str, Any]] | None) -> str | None:
    if not isinstance(alarm_rows, list):
        return "missing_alarm_rows"
    required = {"day", "time", "enabled", "alarmTemperature", "duration", "vibrationIntensity", "vibrationPattern"}
    for row in alarm_rows:
        if not isinstance(row, Mapping) or set(required) - set(row):
            return "invalid_alarm_rows"
        if row["day"] not in WEEKDAYS:
            return "invalid_alarm_rows"
    return None


def apply_sleepypod_command(
    journal: Mapping[str, Any],
    *,
    request_id: str,
    expected_revision: int,
    action: str,
    side: str,
    current_schedule: Mapping[str, Any] | None = None,
    level: float | None = None,
    phase: str | None = None,
    enabled: bool | None = None,
    schedule: Mapping[str, Any] | None = None,
    alarm_rows: list[Mapping[str, Any]] | None = None,
    schedule_echo_ok: bool = True,
    terminal_echo_ok: bool = True,
) -> CommandResult:
    request = {
        "operation": "sleepypod_command",
        "request_id": request_id,
        "expected_revision": expected_revision,
        "action": action,
        "side": side,
        "level": level,
        "phase": phase,
        "enabled": enabled,
        "schedule": schedule,
        "alarm_rows": alarm_rows,
    }
    replay = _replay_or_reject(journal, request, allow_replay=True)
    if replay is not None:
        return replay
    if expected_revision != journal["revision"]:
        return _reject(journal, request, "expected_revision_mismatch")
    side_error = _validate_side(side)
    if side_error:
        return _reject(journal, request, side_error)
    phase_state = str(journal["solo_phase"])
    if phase_state in {"activating", "ending", "restore_required", "degraded"}:
        return _reject(journal, request, "sleepypod_locked")
    plan = journal.get("runtime_plan") if isinstance(journal.get("runtime_plan"), Mapping) else {}
    traveler = plan.get("traveler")
    active = phase_state == "active" and traveler in TRAVELER_TO_PERSON
    home_side = home_side_for_traveler(traveler) if active else None
    away_side = side_for_traveler(traveler) if active else None
    if active and side != home_side:
        return _reject(journal, request, "traveler_side_read_only")
    targets = [side] if not active else [home_side, away_side]
    service_calls: list[dict[str, Any]] = []
    working_schedule = clone_schedule(current_schedule or {"left": {}, "right": {}})

    if action == "set_power":
        error = _validate_enabled(enabled)
        if error:
            return _reject(journal, request, error)
        hvac_mode = "heat" if enabled else "off"
        for target_side in targets:
            service_calls.append(
                {
                    "domain": "climate",
                    "service": "set_hvac_mode",
                    "data": {"entity_id": POWER_ENTITY_BY_SIDE[target_side], "hvac_mode": hvac_mode},
                }
            )
        return _accept(dict(journal), request, confirmed_effects=[], service_calls=service_calls, effects=build_public_status(journal)["effects"])
    if action == "set_outside_level":
        error = _validate_level(level)
        if error:
            return _reject(journal, request, error)
        for resident in [SIDE_TO_RESIDENT[target] for target in targets]:
            service_calls.append({"domain": "script", "service": OUTSIDE_SCRIPT_BY_RESIDENT[resident].split(".", 1)[1], "data": {"level": level}})
        return _accept(dict(journal), request, confirmed_effects=[], service_calls=service_calls, effects=build_public_status(journal)["effects"])
    if action == "set_tonight_level":
        error = _validate_level(level)
        if error:
            return _reject(journal, request, error)
        for resident in [SIDE_TO_RESIDENT[target] for target in targets]:
            service_calls.append({"domain": "script", "service": TONIGHT_SCRIPT_BY_RESIDENT[resident].split(".", 1)[1], "data": {"level": level}})
        return _accept(dict(journal), request, confirmed_effects=[], service_calls=service_calls, effects=build_public_status(journal)["effects"])
    if action == "set_stage_level":
        error = _validate_level(level)
        if error:
            return _reject(journal, request, error)
        if phase not in {"bedtime", "asleep", "dawn"}:
            return _reject(journal, request, "invalid_phase")
        for resident in [SIDE_TO_RESIDENT[target] for target in targets]:
            service_calls.append(
                {
                    "domain": "input_number",
                    "service": "set_value",
                    "data": {"entity_id": STAGE_INPUT_NUMBER_BY_RESIDENT_PHASE[(resident, phase)], "value": level},
                }
            )
        return _accept(dict(journal), request, confirmed_effects=[], service_calls=service_calls, effects=build_public_status(journal)["effects"])
    if action == "set_schedule":
        if schedule is None:
            return _reject(journal, request, "schedule_unavailable")
        published = merge_schedule(
            working_schedule,
            schedule,
            side=side,
            mirror=active,
            home_side=home_side or side,
            away_side=away_side or ("right" if side == "left" else "left"),
        )
    elif action == "replace_alarms":
        error = _validate_alarm_rows(alarm_rows)
        if error:
            return _reject(journal, request, error)
        published = replace_alarm_rows(
            working_schedule,
            side=side,
            alarm_rows=list(alarm_rows or []),
            mirror=active,
            home_side=home_side or side,
            away_side=away_side or ("right" if side == "left" else "left"),
        )
    elif action == "snooze_alarm":
        for target_side in targets:
            service_calls.append({"domain": "button", "service": "press", "data": {"entity_id": ALARM_SNOOZE_BUTTON_BY_SIDE[target_side]}})
        return _accept(dict(journal), request, confirmed_effects=[], service_calls=service_calls, effects=build_public_status(journal)["effects"])
    elif action == "stop_alarm":
        for target_side in targets:
            service_calls.append({"domain": "button", "service": "press", "data": {"entity_id": ALARM_STOP_BUTTON_BY_SIDE[target_side]}})
        return _accept(dict(journal), request, confirmed_effects=[], service_calls=service_calls, effects=build_public_status(journal)["effects"])
    else:
        return _reject(journal, request, "unknown_sleepypod_action")

    if not schedule_echo_ok:
        return _restore_required(
            journal,
            request,
            error_code="schedule_echo_timeout",
            restore_reason="schedule_echo_timeout",
            blockers=["schedule_echo_timeout"],
            effects={"sleepypod_live_follow": False, "sleepypod_schedule": False, "wake_light_source": True if active else False},
            record_history=True,
            published_schedule=published,
        )
    updated = deepcopy(dict(journal))
    updated["generation"] += 1
    updated["revision"] += 1
    if active and traveler in TRAVELER_TO_PERSON:
        updated["last_confirmed_overlay_fingerprint"] = observable_schedule_fingerprint(published[away_side])
    updated["release_token"] = stable_release_token(updated["revision"]) if phase_state == "scheduled" else journal["release_token"]
    updated = attach_payload_checksum(updated)
    if not terminal_echo_ok:
        return _pending_indeterminate(
            updated,
            request,
            state=str(updated["solo_phase"]),
            error_code="status_echo_timeout",
            revision=updated["revision"],
            release_token=updated["release_token"],
            blockers=["status_echo_timeout"],
            effects=build_public_status(updated)["effects"],
        )
    return _accept(
        updated,
        request,
        confirmed_effects=["sleepypod_schedule"],
        published_schedule=published,
        effects=build_public_status(updated)["effects"],
    )


def sleepypod_command_plan(
    journal: Mapping[str, Any],
    *,
    action: str,
    side: str,
    current_schedule: Mapping[str, Any] | None = None,
    level: float | None = None,
    phase: str | None = None,
    enabled: bool | None = None,
    schedule: Mapping[str, Any] | None = None,
    alarm_rows: list[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    result = apply_sleepypod_command(
        journal,
        request_id="plan-preview",
        expected_revision=journal["revision"],
        action=action,
        side=side,
        current_schedule=current_schedule,
        level=level,
        phase=phase,
        enabled=enabled,
        schedule=schedule,
        alarm_rows=alarm_rows,
    )
    return {
        "accepted": result.response["status"] == "accepted",
        "error_code": result.response["error_code"],
        "home_side": home_side_for_traveler(journal["runtime_plan"]["traveler"]) if journal.get("runtime_plan") else None,
        "away_side": side_for_traveler(journal["runtime_plan"]["traveler"]) if journal.get("runtime_plan") else None,
        "service_calls": result.service_calls,
        "published_schedule": result.published_schedule,
        "topic": TOPICS["sleepypod_schedule"] if result.published_schedule is not None else None,
    }
