import {
  actionSlotsOf,
  cardContentAlignOf,
  cardImageMaxOf,
  cardImageSizeOf,
  frameSizeOf,
  iconSlotsOf,
  isPhoneFrame,
  isWideRail,
  type Action,
  type AlignKind,
  type CardAlign,
  type CardLayout,
  type ColorToken,
  type Frame,
  type FrameMode,
  type FramePreset,
  type Group,
  type IconSlot,
  type Item,
  type Kind,
  type NavTab,
  type Place,
  type Radii,
  type SwipeDir,
  type TextToken,
  type ToggleLook,
  type Variant,
} from "./tokens";

/**
 * The Inspector route is a view concern, not a second copy of editor state.
 * It is calculated from the current selection and document read model.
 */
export type InspectorSurface =
  | { kind: "empty"; reason: "no-selection" }
  | { kind: "selection"; model: SelectionInspectorModel }
  | { kind: "item"; model: ItemInspectorModel }
  | { kind: "frame"; model: FrameInspectorModel };

export type SelectionInspectorModel =
  | {
      kind: "many";
      ids: readonly string[];
      count: number;
      groupAction: "group";
    }
  | {
      kind: "group";
      ids: readonly string[];
      count: number;
      groupAction: "ungroup";
      groupId: string;
    };

export type ItemFrameContext = {
  id: string;
  width: number;
  height: number;
  kind: "phone" | "desktop";
};

export type ItemInspectorModel = {
  id: string;
  kind: Kind;
  header: {
    label: string;
    variant: Variant;
    icon: string | null;
    icon2: string | null | undefined;
  };
  frame: ItemFrameContext | null;
  sections: {
    text: ItemTextModel;
    tabs?: ItemTabsModel;
    media?: ItemMediaModel;
    icons?: ItemIconModel;
    style: ItemStyleModel;
    state: ItemStateModel;
    rail?: ItemRailModel;
    geometry: ItemGeometryModel;
    navigation?: ItemNavigationModel;
    behavior: ItemBehaviorModel;
  };
  ai: AiCapability;
};

export type ItemTextModel = {
  label: string;
  supporting: string | undefined;
  bold: boolean;
  contentAlign: CardAlign | undefined;
  textColor: TextToken | undefined;
};

export type ItemTabsModel = {
  kind: Kind;
  tabs: readonly NavTab[];
  selected: number | undefined;
  actions: Readonly<Record<string, Action>>;
};

export type ItemMediaModel = {
  src: string | undefined;
  noImage: boolean;
  imagePos: Item["imagePos"];
  layout: CardLayout;
  imageSize: number | undefined;
  imageMax: number | undefined;
};

export type ItemIconModel = {
  slots: readonly IconSlot[];
};

export type ItemStyleModel = {
  variant: Variant;
  fill: ColorToken | undefined;
  iconFill: Item["iconFill"];
  toggle: ToggleLook | undefined;
};

export type ItemStateModel = {
  checked: boolean | undefined;
  switch: boolean | undefined;
  noCheck: boolean | undefined;
  value: number | undefined;
  wavy: boolean | undefined;
  contained: boolean | undefined;
  trackThickness: number | undefined;
};

export type ItemRailModel = {
  mode: "standalone" | "nested";
  wide: boolean;
  expanded: boolean;
  modal: boolean;
};

export type ItemGeometryModel = {
  size: number | undefined;
  size2: number | undefined;
  radiusTop: number | undefined;
  radiusBottom: number | undefined;
  corners: Radii | undefined;
  frameWidth: number | undefined;
  frameHeight: number | undefined;
};

export type ItemNavigationModel = {
  slots: readonly {
    key: string;
    label: string;
    icon: string | null;
    action: Action | null;
  }[];
  targets: readonly {
    id: string;
    label: string;
  }[];
};

export type ItemBehaviorModel = {
  note: string;
  history: readonly string[];
};

export type FrameInspectorModel = {
  id: string;
  header: {
    name: string;
    preset: FramePreset;
  };
  identity: {
    note: string;
    history: readonly string[];
  };
  appearance: {
    background: ColorToken | undefined;
    place: Place | undefined;
  };
  size: {
    width: number;
    height: number;
  };
  navigation: {
    swipe: readonly {
      direction: SwipeDir;
      target: string | null;
    }[];
    targets: readonly { id: string; label: string; preset: FramePreset }[];
  };
  export: {
    prompt: string;
    image: ExportStatus;
  };
  tidy: TidyStatus;
  ai: AiCapability;
};

export type TidyStatus = "tidy" | "undo" | "done";

export type ExportStatus =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "error"; message: string };

export type AiCapability =
  | { kind: "unavailable"; reason: string }
  | { kind: "ready"; run(): void }
  | { kind: "running"; cancel(): void };

export type ItemCommand =
  | { kind: "align"; value: AlignKind }
  | { kind: "set-label"; value: string }
  | { kind: "set-supporting"; value: string }
  | { kind: "set-bold"; value: boolean }
  | { kind: "set-content-align"; value: CardAlign }
  | { kind: "set-text-color"; value: TextToken | undefined }
  | { kind: "set-variant"; value: Variant }
  | { kind: "set-icon-slot"; slot: string; value: string | null }
  | { kind: "set-tabs"; tabs: readonly NavTab[]; selected: number | undefined; actions: Readonly<Record<string, Action>> | undefined }
  | { kind: "set-card-layout"; value: CardLayout }
  | { kind: "set-image-size"; value: number | undefined }
  | { kind: "set-image-source"; value: string | undefined }
  | { kind: "set-fill"; value: ColorToken | undefined }
  | { kind: "set-icon-fill"; value: Item["iconFill"] }
  | { kind: "set-toggle"; value: ToggleLook | undefined }
  | { kind: "set-checked"; value: boolean }
  | { kind: "set-switch"; value: boolean }
  | { kind: "set-no-check"; value: boolean }
  | { kind: "set-contained"; value: boolean }
  | { kind: "set-wavy"; value: boolean }
  | { kind: "set-value"; value: number | undefined }
  | { kind: "set-rail"; expanded: boolean | undefined; modal: boolean | undefined }
  | { kind: "set-track-thickness"; value: number | undefined }
  | { kind: "set-size"; value: number | undefined }
  | { kind: "set-size2"; value: number | undefined }
  | { kind: "set-radius"; side: "top" | "bottom"; value: number | undefined }
  | { kind: "set-corners"; value: Radii | undefined; radiusTop: number | undefined; radiusBottom: number | undefined }
  | { kind: "set-action"; slot: string | null; value: Action | undefined }
  | { kind: "set-note"; value: string | undefined }
  | { kind: "restore-note"; value: string; history: readonly string[] | undefined }
  | { kind: "delete" }
  | { kind: "duplicate" };

export type FrameCommand =
  | { kind: "set-name"; value: string }
  | { kind: "set-note"; value: string | undefined }
  | { kind: "restore-note"; value: string; history: readonly string[] | undefined }
  | { kind: "set-background"; value: ColorToken | undefined }
  | { kind: "set-place"; value: Place }
  | { kind: "set-preset"; value: FramePreset }
  | { kind: "set-swipe"; direction: SwipeDir; target: string | null }
  | { kind: "tidy" }
  | { kind: "delete" }
  | { kind: "duplicate" }
  | { kind: "preview" }
  | { kind: "export-image" };

export type SelectionCommand =
  | { kind: "group" }
  | { kind: "ungroup" }
  | { kind: "align"; value: AlignKind }
  | { kind: "delete" }
  | { kind: "duplicate" };

export type InspectorCommand =
  | { target: "selection"; ids: readonly string[]; command: SelectionCommand }
  | { target: "item"; id: string; command: ItemCommand }
  | { target: "frame"; id: string; command: FrameCommand };

export type InspectorDispatch = (command: InspectorCommand) => void;

export type SelectInspectorSurfaceInput = {
  selectedIds: readonly string[];
  selectedItem: Item | null;
  selectedFrame: Frame | null;
  selectedGroup: Group | null;
  selectedPartFrame: Frame | null;
  groups: readonly Group[];
  frames: readonly Frame[];
  frameMode: FrameMode;
  itemAi: AiCapability;
  frameAi: AiCapability;
  prompt: string;
  exportStatus: ExportStatus;
  tidy: TidyStatus;
};

export function selectInspectorSurface(input: SelectInspectorSurfaceInput): InspectorSurface {
  const {
    selectedIds,
    selectedItem,
    selectedFrame,
    selectedGroup,
    selectedPartFrame,
    groups,
    frames,
    frameMode,
    itemAi,
    frameAi,
    prompt,
    exportStatus,
    tidy,
  } = input;

  if (selectedFrame) {
    return {
      kind: "frame",
      model: {
        id: selectedFrame.id,
        header: {
          name: selectedFrame.name,
          preset: isPhoneFrame(selectedFrame) ? "phone" : "desktop",
        },
        identity: { note: selectedFrame.note ?? "", history: selectedFrame.noteHistory ?? [] },
        appearance: {
          background: selectedFrame.bg,
          place: selectedFrame.place,
        },
        size: (() => {
          const { w, h } = frameSizeOf(selectedFrame);
          return { width: w, height: h };
        })(),
        navigation: {
          swipe: (["left", "right", "up", "down"] as const).map((direction) => ({
            direction,
            target: selectedFrame.swipe?.[direction] ?? null,
          })),
          targets: frames.map((target) => ({ id: target.id, label: target.name, preset: isPhoneFrame(target) ? "phone" : "desktop" })),
        },
        export: { prompt, image: exportStatus },
        tidy,
        ai: frameAi,
      },
    };
  }

  if (selectedIds.length > 1) {
    return {
      kind: "selection",
      model: selectedGroup
        ? {
            kind: "group",
            ids: selectedIds,
            count: selectedIds.length,
            groupAction: "ungroup",
            groupId: selectedGroup.id,
          }
        : {
            kind: "many",
            ids: selectedIds,
            count: selectedIds.length,
            groupAction: "group",
          },
    };
  }

  if (!selectedItem) {
    return { kind: "empty", reason: "no-selection" };
  }

  const standaloneRail =
    selectedItem.kind === "navRail" &&
    groups.some((group) => group.items.length === 1 && group.items[0]?.id === selectedItem.id);

  const actions = actionSlotsOf(selectedItem);
  const actionTargets = frameMode === "phone" ? frames.map(({ id, name }) => ({ id, label: name })) : [];
  const navigationSlots = actions.length
    ? actions.map((slot) => ({
        key: slot.key,
        label: slot.label,
        icon: slot.value,
        action: selectedItem.actions?.[slot.key] ?? null,
      }))
    : selectedItem.action
      ? [{ key: "default", label: selectedItem.label, icon: selectedItem.icon, action: selectedItem.action }]
      : [];

  const frame = selectedPartFrame
    ? (() => {
        const { w, h } = frameSizeOf(selectedPartFrame);
        return {
          id: selectedPartFrame.id,
          width: w,
          height: h,
          kind: isPhoneFrame(selectedPartFrame) ? ("phone" as const) : ("desktop" as const),
        };
      })()
    : null;

  return {
    kind: "item",
    model: {
      id: selectedItem.id,
      kind: selectedItem.kind,
      header: {
        label: selectedItem.label,
        variant: selectedItem.variant,
        icon: selectedItem.icon,
        icon2: selectedItem.icon2,
      },
      frame,
      sections: {
        text: {
          label: selectedItem.label,
          supporting: selectedItem.supporting,
          bold: !!selectedItem.bold,
          contentAlign: selectedItem.kind === "card" ? cardContentAlignOf(selectedItem) : selectedItem.contentAlign,
          textColor: selectedItem.textColor,
        },
        ...(selectedItem.tabs
          ? {
              tabs: {
                kind: selectedItem.kind,
                tabs: selectedItem.tabs,
                selected: selectedItem.selected,
                actions: selectedItem.actions ?? {},
              },
            }
          : {}),
        ...(selectedItem.src !== undefined || selectedItem.kind === "card"
          ? {
              media: {
                src: selectedItem.src,
                noImage: !!selectedItem.noImage,
                imagePos: selectedItem.imagePos,
                layout: selectedItem.kind === "card" ? (selectedItem.noImage ? "none" : selectedItem.imagePos ?? "top") : "top",
                imageSize: selectedItem.kind === "card" ? cardImageSizeOf(selectedItem) : selectedItem.imageSize,
                imageMax: selectedItem.kind === "card" ? cardImageMaxOf(selectedItem) : undefined,
              },
            }
          : {}),
        ...(iconSlotsOf(selectedItem).length
          ? { icons: { slots: iconSlotsOf(selectedItem) } }
          : {}),
        style: {
          variant: selectedItem.variant,
          fill: selectedItem.fill,
          iconFill: selectedItem.iconFill,
          toggle: selectedItem.toggle,
        },
        state: {
          checked: selectedItem.checked,
          switch: selectedItem.switch,
          noCheck: selectedItem.noCheck,
          value: selectedItem.value,
          wavy: selectedItem.wavy,
          contained: selectedItem.contained,
          trackThickness: selectedItem.trackThickness,
        },
        ...(selectedItem.kind === "navRail"
          ? {
              rail: {
                mode: standaloneRail ? "standalone" : "nested",
                wide: isWideRail(selectedItem),
                expanded: !!selectedItem.railExpanded,
                modal: !!selectedItem.railModal,
              },
            }
          : {}),
        geometry: {
          size: selectedItem.size,
          size2: selectedItem.size2,
          radiusTop: selectedItem.radiusTop,
          radiusBottom: selectedItem.radiusBottom,
          corners: selectedItem.corners,
          frameWidth: frame?.width,
          frameHeight: frame?.height,
        },
        ...(navigationSlots.length
          ? {
              navigation: {
                slots: navigationSlots,
                targets: actionTargets,
              },
            }
          : {}),
        behavior: {
          note: selectedItem.note ?? "",
          history: selectedItem.noteHistory ?? [],
        },
      },
      ai: itemAi,
    },
  };
}
