"""Cross-repository readiness gate: real Wake/PBL logic with in-memory HA boundaries.

Run with PBL_SOURCE_PATH pointing at the PBL checkout and its existing pytest venv.
This directory is intentionally separate from the standalone Wake unittest suite.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
import importlib
import inspect
import os
from pathlib import Path
import sys
import types

import pytest

PBL_ROOT = Path(os.environ["PBL_SOURCE_PATH"]).resolve()
WAKE_ROOT = Path(__file__).resolve().parents[2] / "custom_components"
sys.path.insert(0, str(PBL_ROOT))
sys.path.insert(0, str(WAKE_ROOT))
ha = importlib.import_module("tests.conftest")


class CoordinatorBoundary:
    @classmethod
    def __class_getitem__(cls, _item):
        return cls

    def __init__(self, hass, _logger, **_kwargs):
        self.hass, self.data = hass, None

    def async_set_updated_data(self, value):
        self.data = value

    async def async_shutdown(self):
        return None


class StorageBoundary(ha.MockStore):
    @classmethod
    def __class_getitem__(cls, _item):
        return cls

    def __init__(self, hass, version, key, **_kwargs):
        super().__init__(hass, version, key)


update_module = types.ModuleType("homeassistant.helpers.update_coordinator")
update_module.DataUpdateCoordinator = CoordinatorBoundary
sys.modules[update_module.__name__] = update_module
ha.storage_module.Store = StorageBoundary
ha.core_module.CoreState = types.SimpleNamespace(running=object(), starting=object())
ha.const_module.EVENT_HOMEASSISTANT_STARTED = "homeassistant_started"
ha.const_module.EVENT_HOMEASSISTANT_STOP = "homeassistant_stop"
event_module = importlib.import_module("homeassistant.helpers.event")
event_module.async_track_point_in_utc_time = lambda *_args: lambda: None

from custom_components.presence_based_lighting import control_lease as lease_module
from custom_components.presence_based_lighting import interceptor as interceptor_module
import custom_components.presence_based_lighting as pbl_module
from custom_components.presence_based_lighting import const as pbl_const
from custom_components.presence_based_lighting.command_context import get_command_context_registry
from wake_light import coordinator as wake_module
from wake_light.engine import cancellation_decision
from wake_light.model import WakeLightAlarm, WakeLightDefaults, WakeLightProfile

ROOT = "light.bedroom"
LEAVES = tuple(f"light.wake_{index}" for index in range(4))
BATHROOM = "light.excluded_bathroom"
SWITCH = "switch.bedroom_presence"


class Bus:
    def __init__(self):
        self.listeners = {}
        self.events = []

    def async_listen(self, name, callback):
        self.listeners.setdefault(name, []).append(callback)
        return lambda: self.listeners[name].remove(callback)

    def async_listen_once(self, name, callback):
        def once(event):
            unsubscribe()
            callback(event)
        unsubscribe = self.async_listen(name, once)
        return unsubscribe

    def async_fire(self, name, data=None, **_kwargs):
        self.events.append((name, data))
        for callback in tuple(self.listeners.get(name, ())):
            callback(types.SimpleNamespace(data=data or {}))


class World:
    def __init__(self, monkeypatch):
        self.now = datetime(2030, 1, 1, 6, tzinfo=UTC)
        self.monotonic = 1000.0
        self.hass = ha.MockHass()
        self.hass.config = types.SimpleNamespace(time_zone="UTC")
        self.hass.state = ha.core_module.CoreState.running
        self.hass.bus = Bus()
        self.tasks = []
        self.hass.async_create_task = self.task
        self.hass.states.set(ROOT, "on", attributes={"group_entities": [*LEAVES, BATHROOM]})
        self.hass.states.set(BATHROOM, "on")
        for leaf in LEAVES:
            self.hass.states.set(leaf, "off")
        self.hass.states.set("input_boolean.vacation", "off")
        self.hass.states.set(SWITCH, "on", attributes={"control_lease_mode": "enforce"})
        self.hass._service_target_entities["label_id"]["wake-leaves"] = set(LEAVES)
        self.physical_calls = []
        self.hold_next = False
        self.entered, self.resume = asyncio.Event(), asyncio.Event()
        monkeypatch.setattr(interceptor_module, "InterceptResult",
                            types.SimpleNamespace(ALLOW="allow", BLOCK="block"), raising=False)
        monkeypatch.setattr(wake_module, "utc_now", lambda: self.now)
        self.new_manager()
        self.hass.services.async_call = self.service
        self.wake = self.new_wake()

    def task(self, coroutine):
        task = asyncio.create_task(coroutine)
        self.tasks.append(task)
        return task

    def advance(self, seconds):
        self.monotonic += seconds
        self.now += timedelta(seconds=seconds)

    def new_manager(self):
        self.manager = lease_module.ControlLeaseManager(
            self.hass, monotonic_source=lambda: self.monotonic,
            utcnow_source=lambda: self.now,
            store=StorageBoundary(self.hass, 1, "coupled-pbl"),
        )
        self.manager.set_enforcement_available(True)
        self.manager.register_entity(
            "pbl-entry", ROOT, mode="enforce",
            listener=lambda _root, _event: self.hass.states.set(
                SWITCH, "on", attributes=self.manager.attributes_for(ROOT),
            ),
        )
        self.guard = interceptor_module.ControlLeaseInterceptor(self.hass, self.manager)

    def new_wake(self):
        profile = WakeLightProfile(
            profile_id="bedroom", name="Bedroom", root_light_entity_id=ROOT,
            target_light_entity_ids=LEAVES, pbl_switch_entity_id=SWITCH,
            vacation_entity_id="input_boolean.vacation", defaults=WakeLightDefaults(),
            legacy_brightness_lifecycle_safe=True,
        )
        return wake_module.WakeLightCoordinator(
            self.hass, types.SimpleNamespace(entry_id="wake-entry"), profile,
        )

    async def start(self, minutes=(30, 60)):
        from dataclasses import replace
        self.wake.state = replace(self.wake.state, alarms=tuple(
            WakeLightAlarm(
                id=f"alarm-{offset}", label=f"Alarm {offset}", kind="once",
                date=(self.now + timedelta(minutes=offset)).date().isoformat(),
                local_time=(self.now + timedelta(minutes=offset)).strftime("%H:%M"),
                ramp_minutes=30,
            ) for offset in minutes
        ))
        self.wake._attach_listeners()
        async with self.wake._lock:
            await self.wake._reconcile_locked(self.now, "coupled-start")

    async def service(self, domain, service, data=None, *, blocking=False,
                      return_response=False, context=None):
        data = dict(data or {})
        if domain == "presence_based_lighting":
            assert data["controlled_entity_id"] == ROOT
            assert data["entity_id"] == SWITCH
            assert data["owner"] == "wake_light"
            common = dict(
                root_entity_id=ROOT, lease_id=data["lease_id"],
                controller_id=data["controller_id"],
            )
            if service == "acquire_control":
                return await self.manager.async_acquire(
                    **common, request_id=data["request_id"], owner=data["owner"],
                    occurrence_ids=data["occurrence_ids"], ttl_seconds=data["ttl_seconds"],
                    target_entity_ids=data["target_entity_ids"],
                )
            if service == "release_control":
                return await self.manager.async_release(
                    **common, request_id=data["request_id"], owner=data["owner"],
                    expected_generation=data["expected_generation"],
                    outcome=data["outcome"], cause=data["cause"],
                )
            assert service == "dispatch_control"
            return await self.manager.async_call_with_control_lease(
                **common, expected_generation=data["expected_generation"],
                command_id=data["command_id"], target_entity_ids=data["target_entity_ids"],
                service_data=data["service_data"],
            )
        assert domain == "light" and service in {"turn_on", "turn_off"}
        call = ha.core_module.ServiceCall(self.hass, domain, service, data, context)
        if service == "turn_on" and self.hold_next:
            self.hold_next = False
            self.entered.set()
            await self.resume.wait()
        result = await (
            self.guard._handle_turn_on(call, data) if service == "turn_on"
            else self.guard._handle_turn_off(call, data)
        )
        if result == "block":
            return None
        targets = await ha.service_helper_module.async_extract_entity_ids(call, True)
        self.physical_calls.append((service, targets, context))
        for target in targets:
            self.hass.states.set(target, "on" if service == "turn_on" else "off",
                                 context=context, attributes={"brightness": 3})
        # No root OFF event: the excluded bathroom deliberately stays on.
        assert self.hass.states.get(BATHROOM).state == "on"
        return None

    async def settle(self):
        for _ in range(6):
            await asyncio.sleep(0)

    async def close(self):
        self.wake._stopping = True
        await self.wake.async_shutdown()
        self.manager._cancel_expiry(ROOT)
        for task in self.tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*self.tasks, return_exceptions=True)


class ObservedBus(Bus):
    def __init__(self, task):
        super().__init__()
        self.task = task

    def async_fire(self, name, data=None, **_kwargs):
        self.events.append((name, data))
        for callback in tuple(self.listeners.get(name, ())):
            result = callback(types.SimpleNamespace(data=data or {}))
            if inspect.isawaitable(result):
                self.task(result)


class StateOnlyWorld(World):
    """Run real PBL/Wake subscriptions, replacing only HA event/timer boundaries."""

    def __init__(self, monkeypatch):
        super().__init__(monkeypatch)
        self.hass.bus = ObservedBus(self.task)
        self.subscriptions = []
        self.delivered = []
        self.pbl_calls = []
        self.pbl = None
        self.hass.data.setdefault(pbl_const.DOMAIN, {})[
            lease_module.MANAGER_KEY
        ] = self.manager

        def track(hass, entity_ids, callback):
            selected = frozenset(entity_ids)
            self.subscriptions.append((selected, callback))

            def observed(event):
                entity_id = event.data.get("entity_id")
                if entity_id not in selected:
                    return None
                self.delivered.append((callback.__name__, entity_id))
                return callback(event)

            return hass.bus.async_listen("state_changed", observed)

        monkeypatch.setattr(pbl_module, "async_track_state_change_event", track)
        monkeypatch.setattr(wake_module, "async_track_state_change_event", track)
        monkeypatch.setattr(
            pbl_module, "async_track_time_interval", lambda *_args: lambda: None,
        )
        monkeypatch.setattr(pbl_module.dt_util, "utcnow", lambda: self.now)

    async def start_observers(self, *, admitted_baseline=True):
        self.hass.states.set("binary_sensor.in_bed", "on")
        entry = types.SimpleNamespace(
            entry_id="pbl-entry",
            title="Bedroom",
            options={},
            data={
                pbl_const.CONF_PRESENCE_SENSORS: ["binary_sensor.in_bed"],
                pbl_const.CONF_CONTROLLED_ENTITIES: [{
                    pbl_const.CONF_ENTITY_ID: ROOT,
                    pbl_const.CONF_CONTROL_LEASE_MODE: "enforce",
                    pbl_const.CONF_PRESENCE_DETECTED_STATE: "on",
                    pbl_const.CONF_PRESENCE_CLEARED_STATE: "off",
                    pbl_const.CONF_PRESENCE_DETECTED_SERVICE: "light.turn_on",
                    pbl_const.CONF_PRESENCE_CLEARED_SERVICE: "light.turn_off",
                    pbl_const.CONF_DISABLE_ON_EXTERNAL_CONTROL: True,
                }],
            },
        )
        self.pbl = pbl_module.PresenceBasedLightingCoordinator(self.hass, entry)
        self.hass.data[pbl_const.DOMAIN][entry.entry_id] = self.pbl
        self.pbl._entity_states[ROOT]["callbacks"].add(
            lambda: self.hass.states.set(
                SWITCH, "on", attributes=self.manager.attributes_for(ROOT),
            )
        )
        await self.pbl.async_start()
        self.pbl._schedule_paused_state_save = lambda: None
        if admitted_baseline:
            self.pbl._override_manager.set_override(
                ROOT, pbl_const.EXTERNAL_POLICY_PAUSE,
                source=pbl_const.SOURCE_UNKNOWN,
                reason="qualified asleep baseline",
            )
        self.baseline = self.pbl._control_lease_baseline_fingerprint(ROOT)
        self.override = self.pbl._override_manager.get(ROOT)
        assert bool(self.baseline) is admitted_baseline
        assert self.pbl.get_automation_paused(ROOT) is admitted_baseline
        assert self.pbl._control_lease_manager is self.manager

    async def service(self, domain, service, data=None, **kwargs):
        if domain == "presence_based_lighting":
            self.pbl_calls.append((service, dict(data or {})))
        return await super().service(domain, service, data, **kwargs)

    async def state_only(self, entity_id, value):
        event_task_start = self.queue_state_only({entity_id: value})
        await self.drain_state_events(event_task_start)

    def queue_state_only(self, changes):
        event_task_start = len(self.tasks)
        events = []
        for entity_id, value in changes.items():
            old = self.hass.states.get(entity_id)
            self.hass.states.set(
                entity_id, value, attributes=dict(old.attributes),
                context=ha.MockContext(f"device-state-{entity_id}-{value}"),
            )
            events.append({
                "entity_id": entity_id, "old_state": old,
                "new_state": self.hass.states.get(entity_id),
            })
        for event in events:
            self.hass.bus.async_fire("state_changed", event)
        return event_task_start

    async def drain_state_events(self, event_task_start):
        for _ in range(12):
            pending = [
                task for task in self.tasks[event_task_start:]
                if not task.done()
                and task not in self.manager._expiry_tasks.values()
            ]
            if not pending:
                break
            await asyncio.wait_for(asyncio.gather(*pending), 2)
        assert all(
            task.done() or task in self.manager._expiry_tasks.values()
            for task in self.tasks[event_task_start:]
        )

    def assert_baseline_preserved(self):
        assert self.pbl._override_manager.get(ROOT) is self.override
        assert self.pbl._control_lease_baseline_fingerprint(ROOT) == self.baseline
        assert self.pbl.get_automation_paused(ROOT)

    def assert_manual_suppression(self):
        if self.baseline is not None:
            self.assert_baseline_preserved()
        else:
            override = self.pbl._override_manager.get(ROOT)
            assert override is not None
            assert override.source == pbl_const.SOURCE_UNKNOWN
            assert override.policy == pbl_const.EXTERNAL_POLICY_PAUSE
            assert self.pbl.get_automation_paused(ROOT)
            assert self.pbl._control_lease_baseline_fingerprint(ROOT) is not None
            assert self.pbl._entity_states[ROOT]["pause"]["source"] == "external_override"

    async def close(self):
        if self.pbl is not None:
            self.pbl.async_stop()
        await super().close()


@pytest.mark.asyncio
@pytest.mark.parametrize("admitted_baseline", [True, False])
async def test_state_only_all_wake_leaves_off_fences_future_connected_alarm(monkeypatch, admitted_baseline):
    world = StateOnlyWorld(monkeypatch)
    try:
        await world.start_observers(admitted_baseline=admitted_baseline)
        await world.start()
        run = world.wake.state.active_run
        assert run is not None and len(run.occurrences) == 1
        assert world.manager.get(ROOT).baseline_suppressions == (
            (world.baseline,) if admitted_baseline else ()
        )
        assert any(
            entities == frozenset({ROOT})
            and callback.__name__ == "_handle_controlled_entity_change"
            for entities, callback in world.subscriptions
        )
        world.advance(15 * 60)
        async with world.wake._lock:
            await world.wake._reconcile_locked(world.now, "last-ramp-step-before-device-off")
        initial_light_calls = len(world.physical_calls)
        for leaf in LEAVES:
            await world.state_only(leaf, "off")
        assert world.hass.states.get(ROOT).state == "on"
        assert world.hass.states.get(BATHROOM).state == "on"
        assert all(world.hass.states.get(leaf).state == "off" for leaf in LEAVES)
        assert len(world.physical_calls) == initial_light_calls
        assert not any(name == "call_service" for name, _data in world.hass.bus.events)
        assert world.manager.get(ROOT) is None
        assert world.wake.state.active_run is None
        assert world.wake.state.last_outcome == "cancelled_by_user"
        assert world.wake.state.failures == ()
        assert world.wake.state.auto_relight_blocked_until == datetime(2030, 1, 1, 7, 5, tzinfo=UTC)
        assert world.wake.state.last_cancellation.occurrence_count == 2
        release = [
            data for service, data in world.pbl_calls
            if service == "release_control"
        ][-1]
        assert release["outcome"] == "cancelled"
        assert release["cause"] == "external_targets_off"
        assert world.manager.attributes_for(ROOT)[
            "control_lease_baseline_outcome"
        ] == ("preserved_nonclean_release" if admitted_baseline else "none")
        world.assert_manual_suppression()
        after_off_commands = len(world.pbl_calls)
        for minutes in (15, 30, 5):
            world.advance(minutes * 60)
            async with world.wake._lock:
                await world.wake._reconcile_locked(world.now, "state-only-off-fence")
            await world.settle()
            assert world.wake.state.active_run is None
            assert world.manager.get(ROOT) is None
            assert len(world.physical_calls) == initial_light_calls
            assert len(world.pbl_calls) == after_off_commands
            assert all(world.hass.states.get(leaf).state == "off" for leaf in LEAVES)
            world.assert_manual_suppression()
    finally:
        await world.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("admitted_baseline", [True, False])
async def test_observed_batch_off_blocks_due_tick_before_state_handlers_drain(monkeypatch, admitted_baseline):
    world = StateOnlyWorld(monkeypatch)
    try:
        await world.start_observers(admitted_baseline=admitted_baseline)
        await world.start()
        world.advance(15 * 60)
        before = len(world.physical_calls)
        async with world.wake._lock:
            start = world.queue_state_only(dict.fromkeys(LEAVES, "off"))
            assert any(not task.done() for task in world.tasks[start:])
            await world.wake._reconcile_locked(world.now, "due-before-off-events-drain")
        await world.drain_state_events(start)
        assert len(world.physical_calls) == before
        assert all(world.hass.states.get(leaf).state == "off" for leaf in LEAVES)
        assert world.hass.states.get(ROOT).state == "on"
        assert world.hass.states.get(BATHROOM).state == "on"
        assert world.wake.state.active_run is None
        assert world.manager.get(ROOT) is None
        assert world.wake.state.last_outcome == "cancelled_by_user"
        assert world.wake.state.auto_relight_blocked_until == datetime(2030, 1, 1, 7, 5, tzinfo=UTC)
        assert world.wake.state.failures == ()
        world.assert_manual_suppression()
    finally:
        await world.close()


@pytest.mark.asyncio
async def test_observed_single_leaf_off_releases_before_new_due_dispatch(monkeypatch):
    world = StateOnlyWorld(monkeypatch)
    try:
        await world.start_observers(admitted_baseline=False)
        await world.start()
        world.advance(15 * 60)
        before = len(world.physical_calls)
        async with world.wake._lock:
            start = world.queue_state_only({LEAVES[0]: "off"})
            await world.wake._reconcile_locked(world.now, "due-before-single-off-drain")
        await world.drain_state_events(start)
        assert world.wake.state.active_run is not None
        assert world.wake.state.active_run.target_entity_ids == LEAVES[1:]
        assert world.wake.state.auto_relight_blocked_until is None
        assert world.hass.states.get(LEAVES[0]).state == "off"
        assert all(LEAVES[0] not in targets for _service, targets, _context in world.physical_calls[before:])
        assert world.pbl._override_manager.get(ROOT) is None
        assert not world.pbl.get_automation_paused(ROOT)
    finally:
        await world.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("admitted_baseline", [True, False])
async def test_external_off_suppresses_regular_pbl_but_allows_disconnected_wake(monkeypatch, admitted_baseline):
    world = StateOnlyWorld(monkeypatch)
    try:
        await world.start_observers(admitted_baseline=admitted_baseline)
        await world.start(minutes=(30, 60, 120))
        world.advance(15 * 60)
        async with world.wake._lock:
            start = world.queue_state_only(dict.fromkeys(LEAVES, "off"))
            await world.wake._reconcile_locked(world.now, "external-off")
        await world.drain_state_events(start)
        world.assert_manual_suppression()
        before = len(world.physical_calls)
        await world.state_only("binary_sensor.in_bed", "off")
        await world.state_only("binary_sensor.in_bed", "on")
        assert len(world.physical_calls) == before
        world.assert_manual_suppression()
        world.advance(75 * 60)
        async with world.wake._lock:
            await world.wake._reconcile_locked(world.now, "disconnected-wake")
        assert world.wake.state.active_run is not None
        assert {item.schedule.alarm_id for item in world.wake.state.active_run.occurrences} == {"alarm-120"}
        assert world.manager.get(ROOT) is not None
        assert world.manager.get(ROOT).baseline_suppressions
        assert len(world.physical_calls) == before + 1
    finally:
        await world.close()


@pytest.mark.asyncio
async def test_external_off_policy_is_active_before_release_persistence_yields(monkeypatch):
    world = StateOnlyWorld(monkeypatch)
    resume = asyncio.Event()
    try:
        await world.start_observers(admitted_baseline=False)
        await world.start()
        await world.settle()
        entered = asyncio.Event()
        original_save = world.manager._async_save

        async def delayed_terminal_save():
            if world.manager.get(ROOT) is None:
                entered.set()
                await resume.wait()
            await original_save()

        monkeypatch.setattr(world.manager, "_async_save", delayed_terminal_save)
        before = len(world.physical_calls)
        start = world.queue_state_only(dict.fromkeys(LEAVES, "off"))
        await asyncio.wait_for(entered.wait(), 2)
        assert world.manager.get(ROOT) is None
        world.assert_manual_suppression()
        await world.pbl._reconcile_entity(ROOT, world.pbl._entity_states[ROOT])
        assert len(world.physical_calls) == before
        resume.set()
        await world.drain_state_events(start)
        assert world.wake.state.last_outcome == "cancelled_by_user"
    finally:
        resume.set()
        await world.close()


@pytest.mark.asyncio
async def test_external_off_release_checks_generation_and_does_not_repeat_policy(monkeypatch):
    world = StateOnlyWorld(monkeypatch)
    try:
        await world.start_observers(admitted_baseline=False)
        await world.start()
        run = world.wake.state.active_run
        payload = {
            "root_entity_id": ROOT, "lease_id": run.lease_id,
            "controller_id": run.controller_id, "owner": "wake_light",
            "expected_generation": run.generation, "request_id": "external-off-check",
            "outcome": "cancelled", "cause": "external_targets_off",
        }
        refused = await world.manager.async_release(
            **{**payload, "expected_generation": run.generation + 1},
        )
        assert refused["outcome"] == "token_mismatch"
        assert world.manager.get(ROOT) is not None
        assert world.pbl._override_manager.get(ROOT) is None
        invalid = await world.manager.async_release(
            **{**payload, "outcome": "completed"},
        )
        assert invalid["outcome"] == "invalid_release"
        assert world.manager.get(ROOT) is not None
        assert world.pbl._override_manager.get(ROOT) is None
        start = world.queue_state_only(dict.fromkeys(LEAVES, "off"))
        await world.drain_state_events(start)
        world.assert_manual_suppression()
        suppression = world.pbl._override_manager.get(ROOT)
        duplicate = await world.manager.async_release(**payload)
        assert duplicate["outcome"] == "already_terminal"
        assert world.pbl._override_manager.get(ROOT) is suppression
    finally:
        await world.close()


@pytest.mark.asyncio
async def test_queued_old_off_observations_do_not_release_a_disconnected_episode(monkeypatch):
    world = StateOnlyWorld(monkeypatch)
    try:
        await world.start_observers(admitted_baseline=False)
        await world.start(minutes=(30, 60, 120))
        old_lease = world.wake.state.active_run.lease_id
        world.advance(15 * 60)
        async with world.wake._lock:
            start = world.queue_state_only(dict.fromkeys(LEAVES, "off"))
            await world.wake._reconcile_locked(world.now, "cancel-old-observed-episode")
            world.advance(75 * 60)
            await world.wake._reconcile_locked(world.now, "new-disconnected-episode")
            current = world.wake.state.active_run
            assert current is not None and current.lease_id != old_lease
            assert current.target_entity_ids == LEAVES
        await world.drain_state_events(start)
        assert world.wake.state.active_run is not None
        assert world.wake.state.active_run.lease_id == current.lease_id
        assert world.wake.state.active_run.target_entity_ids == LEAVES
        assert world.manager.get(ROOT).target_entity_ids == LEAVES
    finally:
        await world.close()


@pytest.mark.asyncio
async def test_state_only_one_leaf_off_keeps_current_episode_and_remaining_targets(monkeypatch):
    world = StateOnlyWorld(monkeypatch)
    try:
        await world.start_observers()
        await world.start()
        old = world.wake.state.active_run
        assert not cancellation_decision(old, "no_owned_targets").user_initiated
        world.advance(15 * 60)
        await world.state_only(LEAVES[0], "off")
        current = world.wake.state.active_run
        assert current is not None and current.lease_id == old.lease_id
        assert current.target_entity_ids == LEAVES[1:]
        assert current.released_target_ids == (LEAVES[0],)
        assert world.manager.get(ROOT).target_entity_ids == LEAVES[1:]
        assert current.generation > old.generation
        assert world.wake.state.auto_relight_blocked_until is None
        assert world.wake.state.last_cancellation is None
        assert world.wake.state.failures == ()
        world.assert_baseline_preserved()
    finally:
        await world.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("state", ["unknown", "unavailable"])
async def test_state_only_uncertain_leaf_is_failure_not_user_cancellation(monkeypatch, state):
    world = StateOnlyWorld(monkeypatch)
    try:
        await world.start_observers()
        await world.start()
        world.advance(15 * 60)
        await world.state_only(LEAVES[0], state)
        assert world.wake.state.active_run is None
        assert world.manager.get(ROOT) is None
        assert world.wake.state.last_outcome == "target_unavailable"
        assert any(item.code == "target_unavailable" for item in world.wake.state.failures)
        assert world.wake.state.last_cancellation is None
        assert world.wake.state.auto_relight_blocked_until is None
        world.assert_baseline_preserved()
    finally:
        await world.close()


@pytest.mark.asyncio
@pytest.mark.parametrize("delay", [0, 35])
@pytest.mark.parametrize("context", [
    ha.MockContext("direct-user", user_id="user"),
    ha.MockContext("helper", parent_id="user-triggered-helper"),
    ha.MockContext("homekit-unknown"),
])
async def test_selector_off_pre_revokes_queued_owner_and_wake_fences_without_root_off(monkeypatch, context, delay):
    world = World(monkeypatch)
    try:
        await world.start()
        assert world.manager.get(ROOT) is not None
        world.advance(30)
        world.hold_next = True
        async def tick():
            async with world.wake._lock:
                await world.wake._reconcile_locked(world.now, "queued")
        owner = asyncio.create_task(tick())
        await asyncio.wait_for(world.entered.wait(), 2)
        world.advance(delay)
        await world.service("light", "turn_off", {"label_id": "wake-leaves"}, context=context)
        assert world.manager.get(ROOT) is None
        assert world.hass.states.get(ROOT).state == "on"
        calls_at_off = len(world.physical_calls)
        world.resume.set()
        await owner
        await world.settle()
        assert len(world.physical_calls) == calls_at_off
        assert all(world.hass.states.get(leaf).state == "off" for leaf in LEAVES)
        assert world.wake.state.active_run is None
        assert world.wake.state.auto_relight_blocked_until == datetime(2030, 1, 1, 7, 5, tzinfo=UTC)
        assert world.wake.state.last_outcome == "cancelled_by_user"
        assert world.wake.state.failures == ()
    finally:
        await world.close()


@pytest.mark.asyncio
async def test_expired_lease_cannot_dispatch_after_waiting_past_context_ttl(monkeypatch):
    world = World(monkeypatch)
    try:
        await world.start(minutes=(30,))
        world.advance(30)
        world.hold_next = True
        async def tick():
            async with world.wake._lock:
                await world.wake._reconcile_locked(world.now, "delayed")
        owner = asyncio.create_task(tick())
        await asyncio.wait_for(world.entered.wait(), 2)
        before = len(world.physical_calls)
        world.advance(6301)
        world.resume.set()
        await owner
        await world.settle()
        assert len(world.physical_calls) == before
        assert world.manager.get(ROOT) is None
        assert world.wake.state.active_run is None
        assert world.manager._in_flight_context_ids == set()
    finally:
        await world.close()


@pytest.mark.asyncio
async def test_registered_automatic_owner_does_not_become_manual_revocation(monkeypatch):
    world = World(monkeypatch)
    try:
        await world.start()
        generation = world.manager.get(ROOT).generation
        context = ha.MockContext("registered-automatic")
        get_command_context_registry(world.hass).register(context.id, "pbl-entry", ROOT, "on")
        await world.service("light", "turn_on", {
            "label_id": "wake-leaves", "brightness_pct": 10,
        }, context=context)
        await world.settle()
        assert world.manager.get(ROOT).generation == generation
        assert world.wake.state.active_run is not None
        assert world.wake.state.auto_relight_blocked_until is None
    finally:
        await world.close()


@pytest.mark.asyncio
async def test_target_dropout_is_terminal_and_recovery_does_not_reuse_retired_lease(monkeypatch):
    world = World(monkeypatch)
    try:
        await world.start(minutes=(30,))
        old_run = world.wake.state.active_run
        old_state = world.hass.states.get(LEAVES[0])
        world.hass.states.set(LEAVES[0], "unavailable")
        await world.wake._async_handle_state_event(types.SimpleNamespace(data={
            "entity_id": LEAVES[0], "old_state": old_state,
            "new_state": world.hass.states.get(LEAVES[0]),
        }), observed_lease_id=old_run.lease_id)
        assert world.wake.state.active_run is None
        assert world.manager.get(ROOT) is None
        world.advance(5)
        world.hass.states.set(LEAVES[0], "off")
        before = len(world.physical_calls)
        await world.wake._reconcile_locked(world.now, "target-returned")
        assert len(world.physical_calls) == before
        denied = await world.manager.async_acquire(
            root_entity_id=ROOT, lease_id=old_run.lease_id,
            controller_id=old_run.controller_id, request_id="retry", owner="wake_light",
            occurrence_ids=old_run.occurrence_ids, ttl_seconds=60, target_entity_ids=LEAVES,
        )
        assert denied["outcome"] == "stale_lease"
        assert "target_unavailable" in world.wake.sensor_model().attributes["failures"]
    finally:
        await world.close()


@pytest.mark.asyncio
async def test_slow_start_exceeding_recovery_grace_fails_closed_without_new_dispatch(monkeypatch):
    world = World(monkeypatch)
    try:
        await world.start(minutes=(30,))
        world.wake._stopping = True
        await world.wake.async_shutdown()
        world.manager._cancel_expiry(ROOT)
        world.new_manager()
        await world.manager.async_initialize()
        world.hass.state = ha.core_module.CoreState.starting
        world.wake = world.new_wake()
        await world.wake.async_start()
        assert world.manager.get(ROOT).status == "recovering"
        before = len(world.physical_calls)
        world.advance(121)
        await world.manager.async_expire_due(ROOT)
        await world.settle()
        assert world.manager.get(ROOT) is None
        world.hass.state = ha.core_module.CoreState.running
        await world.wake._async_handle_hass_started()
        assert world.wake.state.active_run is None
        assert len(world.physical_calls) == before
        assert world.wake._recovery_retry_deadline is None
        assert any(item.code == "recovery:lease_retired" for item in world.wake.state.failures)
    finally:
        await world.close()


@pytest.mark.asyncio
async def test_unsupported_long_episode_never_acquires_a_lease(monkeypatch):
    world = World(monkeypatch)
    try:
        await world.start(minutes=(30, 60, 90, 120))
        assert world.manager.get(ROOT) is None
        assert world.physical_calls == []
        assert world.wake.state.active_run is None
        assert "episode_duration_exceeded" in world.wake.sensor_model().attributes["current_blockers"]
    finally:
        await world.close()
