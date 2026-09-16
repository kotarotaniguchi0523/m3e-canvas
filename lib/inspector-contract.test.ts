import { describe, expect, it } from "vitest";
import { frameSizeOf, makeItem, type Frame, type Group } from "./tokens";
import { applyToggleLookCommand, selectInspectorSurface, type InspectorCommand, type SelectInspectorSurfaceInput } from "./inspector-contract";

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
    // Arrange
    const request = input({});

    // Act
    const surface = selectInspectorSurface(request);

    // Assert
    expect(surface).toEqual({ kind: "empty", reason: "no-selection" });
  });

  it("distinguishes a free group from an arbitrary multi-selection", () => {
    // Arrange
    const first = makeItem("button");
    const second = makeItem("button");
    const group: Group = { id: "group", x: 0, y: 0, axis: "x", free: true, items: [first, second] };

    // Act
    const groupedSurface = selectInspectorSurface(
      input({ selectedIds: [first.id, second.id], selectedGroup: group, groups: [group] }),
    );
    const manySurface = selectInspectorSurface(input({ selectedIds: [first.id, second.id], groups: [group] }));

    // Assert
    expect(groupedSurface).toMatchObject({ kind: "selection", model: { kind: "group", groupAction: "ungroup", groupId: "group" } });
    expect(manySurface).toMatchObject({ kind: "selection", model: { kind: "many", groupAction: "group" } });
  });

  it("derives item sections and narrow navigation targets", () => {
    // Arrange
    const item = makeItem("button");
    item.action = { to: "details", transition: "fade" };
    const group: Group = { id: "group", x: 0, y: 0, axis: "x", items: [item] };

    // Act
    const surface = selectInspectorSurface(
      input({
        selectedIds: [item.id],
        selectedItem: item,
        selectedPartFrame: home,
        groups: [group],
      }),
    );

    // Assert
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
    // Arrange
    const selected = { ...home, swipe: { left: "details" as const } };
    // Act
    const surface = selectInspectorSurface(
      input({
        selectedFrame: selected,
        exportStatus: { kind: "running" },
        tidy: "undo",
      }),
    );

    // Assert
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

  it("keeps every item section's read model available for its corresponding UI", () => {
    // Arrange
    const item = {
      ...makeItem("card"),
      tabs: [{ label: "One", icon: "looks_one" }],
      src: "https://example.com/image.png",
      action: { to: "details", transition: "fade" as const },
      toggle: { label: "Selected", variant: "filled" as const, icon: "check" },
      fill: "primaryContainer" as const,
      checked: true,
      value: 42,
      wavy: true,
      contained: true,
      size: 240,
      size2: 120,
      radiusTop: 8,
      radiusBottom: 12,
      corners: { tl: 8, tr: 8, bl: 12, br: 12 },
      note: "opens details",
    };
    const group: Group = { id: "group", x: 0, y: 0, axis: "x", items: [item] };

    // Act
    const surface = selectInspectorSurface(input({ selectedIds: [item.id], selectedItem: item, selectedPartFrame: home, groups: [group] }));

    // Assert
    expect(surface).toMatchObject({
      kind: "item",
      model: {
        sections: {
          text: { label: item.label },
          tabs: { tabs: item.tabs },
          media: { src: item.src },
          style: { fill: "primaryContainer", toggle: item.toggle },
          state: { checked: true, value: 42, wavy: true, contained: true },
          geometry: { size: 240, size2: 120, radiusTop: 8, radiusBottom: 12, corners: item.corners },
          navigation: { targets: [{ id: "home", label: "Home" }, { id: "details", label: "Details" }] },
          behavior: { note: "opens details" },
        },
      },
    });
  });

  it("preserves an export failure as an explicit error state", () => {
    // Arrange
    const request = input({ exportStatus: { kind: "error", message: "Could not save the image" } });

    // Act
    const surface = selectInspectorSurface(request);

    // Assert
    expect(surface).toMatchObject({ kind: "empty" });

    const frameSurface = selectInspectorSurface({ ...request, selectedFrame: home });
    expect(frameSurface).toMatchObject({ kind: "frame", model: { export: { image: request.exportStatus } } });
  });
});

describe("applyToggleLookCommand", () => {
  it("updates only the explicitly targeted toggle field", () => {
    // Arrange
    const current = { label: "Normal", icon: "check", variant: "tonal" as const };

    // Act
    const next = applyToggleLookCommand(current, { kind: "set-label", value: "Selected" });

    // Assert
    expect(next).toEqual({ label: "Selected", icon: "check", variant: "tonal" });
  });

  it("preserves an explicit icon removal instead of falling back to the normal icon", () => {
    // Arrange
    const current = { label: "Selected", icon: "check", variant: "filled" as const };

    // Act
    const next = applyToggleLookCommand(current, { kind: "set-icon", value: null });

    // Assert
    expect(next).toEqual({ label: "Selected", icon: null, variant: "filled" });
  });
});

describe("inspector command boundaries", () => {
  it("keeps a command kind paired with a closed slot payload", () => {
    // Arrange
    const command = {
      target: "item",
      id: "button",
      command: { kind: "set-action", slot: "tab:2", value: undefined },
    } satisfies InspectorCommand;

    // Act / Assert
    expect(command.command.kind).toBe("set-action");

    // @ts-expect-error Unknown slot keys must not enter the typed command boundary.
    const invalid: InspectorCommand = { target: "item", id: "button", command: { kind: "set-action", slot: "made-up", value: undefined } };
    expect(invalid.target).toBe("item");
  });
});
