import { describe, expect, it } from "vitest";
import { frameSizeOf, makeItem, type Frame, type Group } from "./tokens";
import { selectInspectorSurface, type SelectInspectorSurfaceInput } from "./inspector-contract";

const home: Frame = { id: "home", name: "Home", x: 0, y: 0 };
const details: Frame = { id: "details", name: "Details", x: 400, y: 0, w: 1024, h: 768 };

const input = (overrides: Partial<SelectInspectorSurfaceInput>): SelectInspectorSurfaceInput => ({
  selectedIds: [],
  selectedItem: null,
  selectedFrame: null,
  selectedGroup: null,
  selectedPartFrame: null,
  groups: [],
  frames: [home, details],
  frameMode: "phone",
  itemAi: { kind: "unavailable", reason: "test" },
  frameAi: { kind: "unavailable", reason: "test" },
  prompt: "generated prompt",
  exportStatus: { kind: "idle" },
  tidy: "done",
  ...overrides,
});

describe("selectInspectorSurface", () => {
  it("returns an empty route without a selection", () => {
    expect(selectInspectorSurface(input({}))).toEqual({ kind: "empty", reason: "no-selection" });
  });

  it("distinguishes a free group from an arbitrary multi-selection", () => {
    const first = makeItem("button");
    const second = makeItem("button");
    const group: Group = { id: "group", x: 0, y: 0, axis: "x", free: true, items: [first, second] };

    expect(
      selectInspectorSurface(
        input({
          selectedIds: [first.id, second.id],
          selectedGroup: group,
          groups: [group],
        }),
      ),
    ).toMatchObject({ kind: "selection", model: { kind: "group", groupAction: "ungroup", groupId: "group" } });

    expect(
      selectInspectorSurface(
        input({
          selectedIds: [first.id, second.id],
          groups: [group],
        }),
      ),
    ).toMatchObject({ kind: "selection", model: { kind: "many", groupAction: "group" } });
  });

  it("derives item sections and narrow navigation targets", () => {
    const item = makeItem("button");
    item.action = { to: "details", transition: "fade" };
    const group: Group = { id: "group", x: 0, y: 0, axis: "x", items: [item] };

    const surface = selectInspectorSurface(
      input({
        selectedIds: [item.id],
        selectedItem: item,
        selectedPartFrame: home,
        groups: [group],
      }),
    );

    expect(surface.kind).toBe("item");
    if (surface.kind !== "item") return;
    expect(surface.model.frame).toMatchObject({ id: "home", width: frameSizeOf(home).w, height: frameSizeOf(home).h, kind: "phone" });
    expect(surface.model.sections.text.label).toBe(item.label);
    expect(surface.model.sections.navigation?.targets).toEqual([
      { id: "home", label: "Home" },
      { id: "details", label: "Details" },
    ]);
  });

  it("derives frame export and swipe data without exposing the Frame object", () => {
    const selected = { ...home, swipe: { left: "details" as const } };
    const surface = selectInspectorSurface(
      input({
        selectedFrame: selected,
        exportStatus: { kind: "running" },
        tidy: "undo",
      }),
    );

    expect(surface).toMatchObject({
      kind: "frame",
      model: {
        id: "home",
        header: { preset: "phone" },
        size: { width: frameSizeOf(home).w, height: frameSizeOf(home).h },
        export: { prompt: "generated prompt", image: { kind: "running" } },
        tidy: "undo",
      },
    });
    if (surface.kind !== "frame") return;
    expect(surface.model.navigation.swipe).toContainEqual({ direction: "left", target: "details" });
  });
});
