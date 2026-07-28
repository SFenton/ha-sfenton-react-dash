import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { DEFAULT_OPTIMISTIC_REVERT_MS } from "../../hooks/useOptimisticState"
import { mockCallServiceCalls, mockEntities, resetMockHass } from "../../test/mocks/hakitCoreState"
import { materialIconPath } from "../core/iconPaths"
import { SleepypodActiveAlarmSection } from "./SleepypodActiveAlarmSection"

const SIDES = {
  left: {
    side: "left" as const,
    sideTitle: "Stephen\u0027s Bed",
    snoozeButtonEntityId: "button.master_bedroom_sleepypod_eight_pod_left_alarm_snooze",
    stateEntityId: "sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state",
    stopButtonEntityId: "button.master_bedroom_sleepypod_eight_pod_left_alarm_stop",
  },
  right: {
    side: "right" as const,
    sideTitle: "Steph\u0027s Bed",
    snoozeButtonEntityId: "button.master_bedroom_sleepypod_eight_pod_right_alarm_snooze",
    stateEntityId: "sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state",
    stopButtonEntityId: "button.master_bedroom_sleepypod_eight_pod_right_alarm_stop",
  },
}

function setAlarmState(side: keyof typeof SIDES, state: string, snoozedUntil: number | null = null) {
  const alarm = mockEntities[SIDES[side].stateEntityId]
  alarm.state = state
  alarm.attributes.snoozed_until = snoozedUntil
}

describe("SleepypodActiveAlarmSection", () => {
  beforeEach(() => resetMockHass())

  it.each(["idle", "unavailable", "unknown"])("stays hidden when the alarm state is %s", (state) => {
    setAlarmState("left", state)
    render(<SleepypodActiveAlarmSection {...SIDES.left} />)

    expect(screen.queryByRole("heading", { name: "Alarm Active" })).not.toBeInTheDocument()
  })

  it("treats a missing state entity as unavailable", () => {
    const saved = mockEntities[SIDES.left.stateEntityId]
    delete mockEntities[SIDES.left.stateEntityId]
    try {
      render(<SleepypodActiveAlarmSection {...SIDES.left} />)
      expect(screen.queryByRole("heading", { name: "Alarm Active" })).not.toBeInTheDocument()
    } finally {
      mockEntities[SIDES.left.stateEntityId] = saved
    }
  })

  it("renders ringing controls with the approved labels and app colors", () => {
    setAlarmState("left", "ringing")
    const { container } = render(<SleepypodActiveAlarmSection {...SIDES.left} />)

    const section = container.querySelector("[data-sleepypod-side=\"left\"]") as HTMLElement
    expect(section).toHaveAttribute("data-alarm-state", "ringing")
    expect(within(section).getByRole("heading", { name: "Alarm Active" })).toBeInTheDocument()
    expect(within(section).getByText("Ringing")).toBeInTheDocument()
    const snooze = within(section).getByRole("button", { name: "Snooze" })
    const stop = within(section).getByRole("button", { name: "Stop Alarm" })
    expect(snooze).toHaveStyle("--card-rgb: 10 132 255")
    expect(stop).toHaveStyle("--card-rgb: 229 57 53")
    expect(snooze.querySelector("path")).toHaveAttribute("d", materialIconPath("mdi:sleep"))
    expect(stop.querySelector("path")).toHaveAttribute("d", materialIconPath("mdi:power"))
    expect(snooze).not.toHaveAttribute("aria-pressed")
    expect(stop).not.toHaveAttribute("aria-pressed")
  })

  it.each([
    ["left", "Stephen\u0027s Bed", "button.master_bedroom_sleepypod_eight_pod_left_alarm_snooze", "button.master_bedroom_sleepypod_eight_pod_left_alarm_stop"],
    ["right", "Steph\u0027s Bed", "button.master_bedroom_sleepypod_eight_pod_right_alarm_snooze", "button.master_bedroom_sleepypod_eight_pod_right_alarm_stop"],
  ] as const)("issues exactly one per-side button press for %s actions", (side, sideTitle, snoozeTarget, stopTarget) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2030-01-02T09:00:00"))
    setAlarmState(side, "ringing")
    render(<SleepypodActiveAlarmSection {...SIDES[side]} />)
    const controls = screen.getByRole("group", { name: `${sideTitle} active alarm controls` })

    fireEvent.click(within(controls).getByRole("button", { name: "Snooze" }))
    const snoozing = within(controls).getByRole("button", { name: "Snoozing, 5:00 Remaining" })
    expect(snoozing).toBeDisabled()
    expect(snoozing).toHaveStyle("--card-rgb: 122 122 128")
    expect(within(controls).getByText("Snoozing")).toBeInTheDocument()
    expect(within(controls).getByText("5:00 Remaining")).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: "button", service: "press", target: snoozeTarget },
    ])

    fireEvent.click(within(controls).getByRole("button", { name: "Stop Alarm" }))
    expect(screen.queryByRole("heading", { name: "Alarm Active" })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: "button", service: "press", target: snoozeTarget },
      { domain: "button", service: "press", target: stopTarget },
    ])
    vi.useRealTimers()
  })

  it.each(["left", "right"] as const)("shows the %s HA-provided snooze countdown in the blue card", (side) => {
    vi.useFakeTimers()
    try {
      const now = new Date("2030-01-02T09:00:00")
      vi.setSystemTime(now)
      setAlarmState(side, "snoozed", (now.getTime() + 5 * 60_000) / 1000)
      render(<SleepypodActiveAlarmSection {...SIDES[side]} />)

      const controls = screen.getByRole("group", { name: `${SIDES[side].sideTitle} active alarm controls` })
      const snoozing = within(controls).getByRole("button", { name: "Snoozing, 5:00 Remaining" })
      expect(snoozing).toBeDisabled()
      expect(snoozing).toHaveStyle("--card-rgb: 122 122 128")
      expect(screen.queryByText(/Snoozed until/i)).not.toBeInTheDocument()
      expect(screen.queryByText("Ringing")).not.toBeInTheDocument()

      act(() => vi.advanceTimersByTime(1000))
      expect(within(controls).getByRole("button", { name: "Snoozing, 4:59 Remaining" })).toBeInTheDocument()
      expect(within(controls).getByText("4:59 Remaining")).toBeInTheDocument()
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it("reverts both optimistic states when Home Assistant never confirms", () => {
    vi.useFakeTimers()
    try {
      setAlarmState("right", "ringing")
      render(<SleepypodActiveAlarmSection {...SIDES.right} />)

      fireEvent.click(screen.getByRole("button", { name: "Snooze" }))
      expect(screen.getByRole("button", { name: "Snoozing, 5:00 Remaining" })).toBeDisabled()
      act(() => vi.advanceTimersByTime(DEFAULT_OPTIMISTIC_REVERT_MS))
      expect(screen.getByText("Ringing")).toBeInTheDocument()

      fireEvent.click(screen.getByRole("button", { name: "Stop Alarm" }))
      expect(screen.queryByRole("heading", { name: "Alarm Active" })).not.toBeInTheDocument()
      act(() => vi.advanceTimersByTime(DEFAULT_OPTIMISTIC_REVERT_MS))
      expect(screen.getByText("Ringing")).toBeInTheDocument()
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })
})
