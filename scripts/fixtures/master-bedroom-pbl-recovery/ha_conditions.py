"""Network-free evaluator for the native HA condition subset used by master-bedroom PBL recovery."""

import datetime as dt
import json
import socket
import sys
from zoneinfo import ZoneInfo

from jinja2 import Environment


def deny_network(*_args, **_kwargs):
    raise AssertionError("Live network is forbidden in HA configuration tests")


socket.socket = deny_network
LOCAL = ZoneInfo("America/Los_Angeles")


def parse_time(value):
    if isinstance(value, (int, float)):
        return dt.datetime.fromtimestamp(value, dt.timezone.utc)
    parsed = dt.datetime.fromisoformat(str(value).replace(" ", "T"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=LOCAL)


class Evaluator:
    def __init__(self, request):
        self.now = parse_time(request["now"]).astimezone(LOCAL)
        self.states = request["states"]
        self.trigger = request.get("trigger", {})
        env = Environment()
        env.globals.update(
            states=lambda entity: self.entity(entity)["state"],
            is_state=lambda entity, value: self.entity(entity)["state"] == value,
            state_attr=lambda entity, key: self.entity(entity).get("attributes", {}).get(key),
            now=lambda: self.now,
            today_at=self.today_at,
            timedelta=dt.timedelta,
            as_timestamp=self.as_timestamp,
        )
        self.env = env

    def entity(self, entity_id):
        return self.states.get(entity_id, {"state": "unknown", "attributes": {}})

    def today_at(self, value):
        hour, minute = (int(part) for part in value.split(":")[:2])
        return self.now.replace(hour=hour, minute=minute, second=0, microsecond=0)

    def as_timestamp(self, value, default=None):
        if value is None:
            return default
        if isinstance(value, dt.datetime):
            return value.timestamp()
        try:
            return parse_time(value).timestamp()
        except (TypeError, ValueError):
            return default

    def render(self, template):
        return self.env.from_string(template).render(trigger=self.trigger).strip()

    def state_condition(self, condition):
        entities = condition["entity_id"]
        expected = condition["state"]
        expected = expected if isinstance(expected, list) else [expected]
        for entity_id in entities if isinstance(entities, list) else [entities]:
            entity = self.entity(entity_id)
            if "attribute" in condition:
                actual = entity.get("attributes", {}).get(condition["attribute"])
                if actual not in expected:
                    return False
            elif entity["state"] not in [str(item) for item in expected]:
                return False
            duration = condition.get("for")
            if duration:
                held = dt.timedelta(**duration).total_seconds()
                if (self.now - parse_time(entity["last_changed"])).total_seconds() < held:
                    return False
        return True

    def time_condition(self, condition):
        current = self.now.time()
        after = dt.time.fromisoformat(condition.get("after", "00:00:00"))
        before = dt.time.fromisoformat(condition.get("before", "23:59:59.999999"))
        return after <= current < before if after < before else current >= after or current < before

    def check(self, condition):
        kind = condition["condition"]
        if kind == "state":
            return self.state_condition(condition)
        if kind == "time":
            return self.time_condition(condition)
        if kind == "template":
            return self.render(condition["value_template"]) == "True"
        if kind == "trigger":
            ids = condition["id"]
            return self.trigger.get("id") in (ids if isinstance(ids, list) else [ids])
        children = [self.check(child) for child in condition["conditions"]]
        if kind == "and":
            return all(children)
        if kind == "or":
            return any(children)
        if kind == "not":
            return not any(children)
        raise AssertionError(f"Unsupported condition: {kind}")


def main():
    request = json.load(sys.stdin)
    evaluator = Evaluator(request)
    results = []
    for case in request["cases"]:
        if "template" in case:
            results.append(evaluator.render(case["template"]))
        else:
            results.append(all(evaluator.check(condition) for condition in case["conditions"]))
    print(json.dumps(results))


try:
    main()
except Exception as error:
    print(f"{type(error).__name__}: {error}", file=sys.stderr)
    raise
