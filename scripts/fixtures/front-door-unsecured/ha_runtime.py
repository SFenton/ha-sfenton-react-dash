"""Network-free executor for the emitted native HA subset, driven by Vitest."""

import copy
import datetime as dt
import json
import socket
import sys

from jinja2 import StrictUndefined
from jinja2.nativetypes import NativeEnvironment


def deny_network(*_args, **_kwargs):
    raise AssertionError("Live network is forbidden in HA configuration tests")


socket.socket = deny_network


class AttrDict(dict):
    def __getattr__(self, key):
        try:
            return self[key]
        except KeyError as exc:
            raise AttributeError(key) from exc


def attributes(value):
    if isinstance(value, dict):
        return AttrDict({key: attributes(item) for key, item in value.items()})
    if isinstance(value, list):
        return [attributes(item) for item in value]
    return value


class Stopped(Exception):
    pass


class Crashed(Exception):
    pass


class Runtime:
    def __init__(self, request):
        self.request = request
        self.now = request["now"]
        self.states = {}
        self.calls = []
        self.coverage = set()
        self.serial = 0
        self.persisted = {}
        self.step = {}
        self.broker_depth = 0
        self.config = request["config"]
        self.scripts = request.get("scripts", {})
        self.environment = NativeEnvironment(undefined=StrictUndefined)
        self.environment.filters["bool"] = lambda value, default=False: (
            value if isinstance(value, bool)
            else True if str(value).lower() in ("on", "true", "yes", "1")
            else False if str(value).lower() in ("off", "false", "no", "0")
            else default
        )
        self.environment.globals.update(
            states=States(self),
            is_state=lambda entity, state: self.get(entity).state == state,
            state_attr=lambda entity, key: self.get(entity).attributes.get(key),
            now=lambda: dt.datetime.fromtimestamp(self.now, dt.timezone.utc),
            as_timestamp=self.timestamp,
        )
        for entity, value in request["states"].items():
            self.set_state(entity, value)
        self.persisted = copy.deepcopy(self.states)

    def timestamp(self, value, default=None):
        try:
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, dt.datetime):
                return value.timestamp()
            parsed = dt.datetime.fromisoformat(str(value))
            return parsed.replace(tzinfo=parsed.tzinfo or dt.timezone.utc).timestamp()
        except (ValueError, TypeError, AttributeError):
            return default

    def get(self, entity):
        return self.states.get(entity, attributes({
            "entity_id": entity, "state": "unknown", "attributes": {},
            "last_changed": dt.datetime.fromtimestamp(0, dt.timezone.utc),
        }))

    def set_state(self, entity, value):
        if isinstance(value, str):
            value = {"state": value}
        old = self.get(entity)
        changed = self.now if old.state != str(value["state"]) else old.last_changed.timestamp()
        changed = value.get("last_changed", changed)
        self.states[entity] = attributes({
            "entity_id": entity,
            "state": str(value["state"]),
            "attributes": value.get("attributes", old.attributes),
            "last_changed": dt.datetime.fromtimestamp(changed, dt.timezone.utc),
        })

    def render(self, value, context):
        if isinstance(value, dict):
            return {key: self.render(item, context) for key, item in value.items()}
        if isinstance(value, list):
            return [self.render(item, context) for item in value]
        if not isinstance(value, str) or ("{{" not in value and "{%" not in value):
            return value
        return self.environment.from_string(value).render(context)

    def condition(self, condition, context):
        kind = condition["condition"]
        nested = condition.get("conditions", [])
        if kind == "and":
            return all(self.condition(item, context) for item in nested)
        if kind == "or":
            return any(self.condition(item, context) for item in nested)
        if kind == "not":
            return not any(self.condition(item, context) for item in nested)
        if kind == "template":
            return bool(self.render(condition["value_template"], context))
        if kind == "trigger":
            ids = condition["id"]
            return context["trigger"].get("id") in (ids if isinstance(ids, list) else [ids])
        if kind == "state":
            current = self.get(condition["entity_id"])
            wanted = self.render(condition["state"], context)
            choices = wanted if isinstance(wanted, list) else [wanted]
            seconds = condition.get("for", {}).get("seconds", 0)
            return current.state in choices and self.now - current.last_changed.timestamp() >= seconds
        if kind == "numeric_state":
            number = float(self.get(condition["entity_id"]).state)
            return number > condition.get("above", -float("inf")) and number < condition.get("below", float("inf"))
        raise AssertionError(f"Unsupported native condition: {kind}")

    def sequence(self, sequence, context, path="actions"):
        for index, action in enumerate(sequence):
            point = f"{path}/{index}"
            self.coverage.add(point)
            if "variables" in action:
                for key, value in action["variables"].items():
                    context[key] = attributes(self.render(value, context))
            elif "if" in action:
                branch = "then" if all(self.condition(c, context) for c in action["if"]) else "else"
                self.sequence(action.get(branch, []), context, point + "/" + branch)
            elif "choose" in action:
                for number, branch in enumerate(action["choose"]):
                    if all(self.condition(c, context) for c in branch["conditions"]):
                        self.sequence(branch["sequence"], context, f"{point}/choose/{number}")
                        break
                else:
                    self.sequence(action.get("default", []), context, point + "/default")
            elif "delay" in action:
                delay = self.render(action["delay"], context)
                self.now += float(delay.get("seconds", 0))
            elif "condition" in action:
                if not self.condition(action, context):
                    raise Stopped("Condition failed")
            elif "stop" in action:
                raise Stopped(action["stop"])
            elif "action" in action:
                try:
                    self.service(action, context)
                except Crashed:
                    raise
                except RuntimeError:
                    if not action.get("continue_on_error"):
                        raise
            else:
                raise AssertionError(f"Unsupported emitted action: {action}")

    def service(self, action, context):
        name = action["action"]
        data = self.render(action.get("data", {}), context)
        target = self.render(action.get("target", {}).get("entity_id"), context)
        self.calls.append({"action": name, "target": target, "data": data, "at": self.now})
        if self.step.get("failService") == name:
            raise RuntimeError("Simulated service failure")
        if name.startswith("script.") and name in self.scripts:
            if name.endswith("sleepypod_hot_flash_broker") and self.broker_depth:
                raise AssertionError("queued broker self-call is forbidden")
            script_context = attributes({**context, **data})
            if name.endswith("sleepypod_hot_flash_broker"):
                self.broker_depth += 1
            try:
                self.sequence(self.scripts[name]["sequence"], script_context, "script/" + name)
            finally:
                if name.endswith("sleepypod_hot_flash_broker"):
                    self.broker_depth -= 1
        elif name in ("input_text.set_value", "input_number.set_value", "number.set_value"):
            if name == "number.set_value":
                self.request.setdefault("pending_echoes", []).append({"entity": target, "state": str(data["value"])})
            else:
                self.set_state(target, {"state": data["value"]})
        elif name == "input_select.select_option":
            self.set_state(target, data["option"])
        elif name in ("input_boolean.turn_on", "input_boolean.turn_off"):
            self.set_state(target, "on" if name.endswith("turn_on") else "off")
        elif name == "input_datetime.set_datetime":
            timestamp = data["timestamp"]
            self.set_state(target, {
                "state": dt.datetime.fromtimestamp(timestamp, dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                "attributes": {"timestamp": timestamp},
            })
        elif name == "homeassistant.save_persistent_states":
            self.persisted = copy.deepcopy(self.states)
        elif name == "timer.start":
            duration = float(data.get("duration", 900))
            self.set_state(target, {"state": "active", "attributes": {"finishes_at": self.now + duration}})
        elif name == "timer.cancel":
            self.set_state(target, {"state": "idle", "attributes": {}})
        elif name == "climate.set_hvac_mode":
            self.request.setdefault("pending_echoes", []).append({"entity": target, "state": str(data["hvac_mode"])})
        elif name == "mqtt.publish":
            pass
        elif name == "lock.lock":
            if self.step.get("confirmLock"):
                self.set_state(target, "locked")
        elif not (name.startswith("notify.") or name == "logbook.log"):
            raise AssertionError(f"Unsupported or unsafe service: {name}")
        during = self.step.get("duringService", {})
        if during.get("action") == name:
            self.step.pop("duringService")
            if "entity" in during:
                self.set_state(during["entity"], during["state"])
            self.now += during.get("advanceSeconds", 0)
        if self.step.get("crashAfterService") == name:
            raise Crashed(name)
        if self.step.get("crashAfterCall") == len(self.calls):
            raise Crashed(name)

    def run(self):
        for step in self.request["steps"]:
            self.step = dict(step)
            self.now = step["at"]
            if step.get("restart"):
                for entity, state in self.persisted.items():
                    if entity.startswith(("input_", "timer.")):
                        self.states[entity] = copy.deepcopy(state)
            entity = step.get("entity")
            before = copy.deepcopy(self.get(entity)) if entity else None
            for key, value in step.get("states", {}).items():
                self.set_state(key, value)
            for echo in step.get("echoes", []):
                self.set_state(echo["entity"], echo)
            if entity:
                self.set_state(entity, step["state"])
            if step.get("run", True) is False:
                continue
            trigger = {
                "id": step.get("id", "reconcile"),
                "platform": step.get("platform", "state" if entity else "time" if step.get("id") == "deadline" else "manual"),
            }
            if entity:
                trigger.update(entity_id=entity, from_state=before, to_state=copy.deepcopy(self.get(entity)))
            if step.get("event"):
                event = copy.deepcopy(step["event"])
                if event.get("data", {}).get("action") == "$current":
                    event["data"]["action"] = self.request["actionPrefix"] + self.get(self.request["incidentHelper"]).state
                event.setdefault("time_fired", dt.datetime.fromtimestamp(self.now, dt.timezone.utc))
                trigger.update(platform="event", event=attributes(event))
            if step.get("trigger"):
                trigger.update(attributes(step["trigger"]))
                for name in ("from_state", "to_state"):
                    if isinstance(trigger.get(name), dict) and isinstance(trigger[name].get("last_changed"), (int, float)):
                        trigger[name]["last_changed"] = dt.datetime.fromtimestamp(trigger[name]["last_changed"], dt.timezone.utc)
            self.serial += 1
            context = attributes({"trigger": trigger, "context": {"id": f"test_incident_{self.serial:08d}"}})
            try:
                self.sequence(step.get("actions", self.config["actions"]), context)
            except (Stopped, Crashed, RuntimeError):
                pass
        return {
            "calls": self.calls,
            "states": {entity: value.state for entity, value in self.states.items()},
            "coverage": sorted(self.coverage),
        }


class States:
    def __init__(self, runtime, prefix=""):
        self.runtime = runtime
        self.prefix = prefix

    def __call__(self, entity):
        return self.runtime.get(entity).state

    def __getattr__(self, name):
        path = self.prefix + name
        return self.runtime.get(path) if "." in path else States(self.runtime, path + ".")


try:
    print(json.dumps(Runtime(json.load(sys.stdin)).run()))
except Exception as error:
    print(f"{type(error).__name__}: {error}", file=sys.stderr)
    raise
