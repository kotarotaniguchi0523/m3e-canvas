"use client";

import { useState } from "react";
import {
  Action,
  BACK_TARGET,
  CONTENT_W,
  FramePreset,
  HALF_W,
  KIND_SPEC,
  COMPONENT_KIND,
  PHONE_H,
  PHONE_W,
  ComponentKind,
  NavTab,
  Palette,
  SWIPE_DIRS,
  SwipeDir,
  isToggleableKind,
  TRANSITIONS,
  Transition,
  Variant,
  TRACK_DEFAULT,
  TRACK_MAX,
  TRACK_MIN,
  maxRingThickness,
  contentWidth,
  defaultTabsFor,
  isIconSlotKey,
  isTabSlotKey,
  CardAlign,
  cardDefaultFillOf,
  CARD_IMAGE_MIN,
  halfWidth,
  onToken,
  variantStyle,
  scaleR,
  tabSlotKey,
  AlignKind,
} from "@/lib/tokens";
import { IconPickerDisclosure } from "./IconPickerDisclosure";
import { Icon } from "./M3Node";
import { ButtonRun, CardLayoutPicker, CornerIcon, Field, IconBtn, Section, Segmented, SizePresets, Slider, TextTokenChips, TidyButton, Toggle, TokenChips } from "./ui";
import { AiWriteBtn } from "./AiPanel";
import { KIND_TEXT, SWIPE_TEXT, TRANSITION_TEXT, UIKey, t, useLang } from "@/lib/i18n";
import { AI_CAPABILITY_KIND, applyToggleLookCommand, assertInspectorNever, EXPORT_STATUS_KIND, INSPECTOR_SURFACE_KIND, SELECTION_KIND } from "@/lib/inspector-contract";
import { variantsOf, widthPresetLabel } from "@/lib/inspector-view";
import type { ItemActions } from "@/lib/tokens";
import type {
  AiCapability,
  FrameCommand,
  FrameInspectorModel,
  InspectorDispatch,
  InspectorSurface,
  ItemBehaviorModel,
  ItemBehaviorCommand,
  ItemFillCommand,
  ItemGeometryCommand,
  ItemHeaderCommand,
  ItemIconCommand,
  ItemCommand,
  ItemGeometryModel,
  ItemIconModel,
  ItemInspectorModel,
  ItemMediaCommand,
  ItemMediaModel,
  ItemNavigationCommand,
  ItemNavigationModel,
  ItemRailCommand,
  ItemRailModel,
  ItemStateCommand,
  ItemStateModel,
  ItemStyleCommand,
  ItemStyleModel,
  ItemTabsCommand,
  ItemTabsModel,
  ItemTextCommand,
  ItemTextModel,
  ToggleLookCommand,
  SelectionCommand,
  SelectionInspectorModel,
} from "@/lib/inspector-contract";

/** A text field for a web address: what is typed stays in the box, and only a complete
 *  http(s) address (or an emptied box) reaches the part. */
function UrlField({ value, onChange, placeholder, p }: { value: string; onChange: (src: string | undefined) => void; placeholder: string; p: Palette }) {
  const lang = useLang();
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <span style={{ position: "absolute", left: 12, top: 12, color: p.onSurfaceVariant, pointerEvents: "none", lineHeight: 1 }}>
        <Icon name="link" size={20} />
      </span>
      <input
        key={value}
        defaultValue={value}
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.currentTarget.value.trim();
          /* an emptied box removes a URL; a picked file (which shows as an empty box) is left alone */
          if (!next && value) onChange(undefined);
          else if (/^https?:\/\/\S+$/.test(next)) onChange(next);
        }}
        onBlur={(event) => {
          event.currentTarget.value = value;
        }}
        style={{
          width: "100%",
          height: 44,
          padding: `0 ${value ? 40 : 14}px 0 42px`,
          borderRadius: 22,
          border: "none",
          background: p.surfaceContainerHigh,
          color: p.onSurface,
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />
      {value && (
        <button
          onClick={() => onChange(undefined)}
          title={t("clear", lang)}
          aria-label={t("clear", lang)}
          className="m3-press"
          style={{ position: "absolute", right: 6, top: 7, width: 30, height: 30, borderRadius: 15, border: "none", background: "transparent", color: p.onSurfaceVariant, cursor: "pointer", display: "grid", placeItems: "center" }}
        >
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
}

export function VariantSwatch({
  v,
  label,
  p,
  on,
  onClick,
  small,
}: {
  v: Variant;
  label: string;
  p: Palette;
  on: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  const st = variantStyle(v, p);
  const h = small ? 32 : 40;
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className="m3-press"
      style={{
        height: h,
        borderRadius: h / 2,
        cursor: "pointer",
        fontSize: small ? 11 : 12,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: small ? "0 10px" : "0 12px",
        ...st,
        boxShadow: v === "elevated" ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
        outline: on ? `2px solid ${p.primary}` : "2px solid transparent",
        outlineOffset: 2,
      }}
    >
      {on && <Icon name="check" size={small ? 14 : 16} />}
      {label}
    </button>
  );
}

const MAX_IMAGE_PX = 1200;

const heightPresetLabel = (v: number, frameHeight = PHONE_H): string | undefined =>
  v === frameHeight ? t("screenHeight") : v === frameHeight / 2 ? t("halfHeight") : undefined;

export function FrameSizePicker({
  value,
  palette: p,
  onChange,
  compact,
}: {
  value: FramePreset;
  palette: Palette;
  onChange: (preset: FramePreset) => void;
  compact?: boolean;
}) {
  const lang = useLang();
  return (
    <Segmented<FramePreset>
      options={[
        { key: "phone", icon: "smartphone", label: compact ? undefined : t("phoneFrame", lang), title: t("phoneFrame", lang) },
        { key: "desktop", icon: "desktop_windows", label: compact ? undefined : t("desktopFrame", lang), title: t("desktopFrame", lang) },
      ]}
      value={value}
      onChange={onChange}
      p={p}
      height={compact ? 36 : 40}
      grow={!compact}
    />
  );
}

/** Downscale a picked file so the document stays small enough for localStorage. */
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, MAX_IMAGE_PX / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/webp", 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

function FrameChips({
  frames,
  value,
  onChange,
  p,
  back,
  small,
}: {
  frames: readonly { id: string; label: string; preset?: FramePreset }[];
  value: string | null;
  onChange: (id: string | null) => void;
  p: Palette;
  /** offer "go back" as a target */
  back?: boolean;
  small?: boolean;
}) {
  const lang = useLang();
  const h = small ? 32 : 36;
  const chip = (id: string | null, label: string, icon: string) => {
    const on = value === id;
    return (
      <button
        key={id ?? "none"}
        onClick={() => onChange(id)}
        className="m3-press"
        style={{
          height: h,
          padding: "0 12px 0 8px",
          borderRadius: h / 2,
          border: "none",
          background: on ? p.primary : p.surfaceContainerHigh,
          color: on ? p.onPrimary : p.onSurfaceVariant,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          maxWidth: "100%",
        }}
      >
        <Icon name={icon} size={18} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </button>
    );
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chip(null, t("none", lang), "block")}
      {back && chip(BACK_TARGET, t("goBack", lang), "arrow_back")}
      {frames.map((f) => chip(f.id, f.label || t("screen", lang), f.preset === "desktop" ? "desktop_windows" : "smartphone"))}
    </div>
  );
}

function TransitionPicker({ value, onChange, p }: { value: Transition; onChange: (t: Transition) => void; p: Palette }) {
  const lang = useLang();
  return (
    <Segmented<Transition>
      options={TRANSITIONS.map((tr) => ({ key: tr.key, icon: tr.icon, title: TRANSITION_TEXT[lang][tr.key] }))}
      value={value}
      onChange={onChange}
      p={p}
      height={34}
    />
  );
}

/** target frame (or back) plus the transition, for one tap target */
function ActionEditor({
  frames,
  action,
  onChange,
  p,
}: {
  frames: readonly { id: string; label: string; preset?: FramePreset }[];
  action: Action | undefined;
  onChange: (a: Action | undefined) => void;
  p: Palette;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <FrameChips
        frames={frames}
        value={action?.to ?? null}
        onChange={(to) => onChange(to ? { to, transition: action?.transition ?? "slide" } : undefined)}
        p={p}
        back
      />
      {action && action.to !== BACK_TARGET && (
        <TransitionPicker value={action.transition} onChange={(transition) => onChange({ ...action, transition })} p={p} />
      )}
    </div>
  );
}

/** a multiline field with the AI button under it, fused with a button that swaps the AI text and the original once the AI has written it */
function AiField({ ai, history, onRestore, p, value, onChange, placeholder }: { ai: AiCapability; history?: readonly string[]; onRestore: () => void; p: Palette; value: string; onChange: (v: string) => void; placeholder: string }) {
  const lang = useLang();
  const ready = ai.kind === AI_CAPABILITY_KIND.ready;
  const busy = ai.kind === AI_CAPABILITY_KIND.running;
  const reason = ai.kind === AI_CAPABILITY_KIND.unavailable ? ai.reason : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Field value={value} onChange={onChange} placeholder={placeholder} p={p} multiline rows={3} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ButtonRun>
          <AiWriteBtn p={p} busy={busy} disabled={!ready} onClick={ready ? ai.run : undefined} onCancel={busy ? ai.cancel : undefined} label={t("aiWriteShort", lang)} title={ready ? t("aiWrite", lang) : (reason ?? t("aiNoKey", lang))} />
          {!!history?.length && <IconBtn icon="undo" p={p} size={40} on onClick={onRestore} title={t("aiRestore", lang)} />}
        </ButtonRun>
      </div>
    </div>
  );
}


function FrameHeaderBar({ model, p, dispatch }: { model: FrameInspectorModel; p: Palette; dispatch: (command: FrameCommand) => void }) {
  const lang = useLang();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 6px 6px 14px", borderRadius: 20, background: p.secondaryContainer, color: p.onSecondaryContainer }}>
      <Icon name={model.header.preset === "phone" ? "smartphone" : "desktop_windows"} size={20} />
      <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{t("screen", lang)}</span>
      <IconBtn icon="play_arrow" p={p} onClick={() => dispatch({ kind: "preview" })} title={t("previewFrom", lang)} size={32} fill />
      <IconBtn icon="content_copy" p={p} onClick={() => dispatch({ kind: "duplicate" })} title={t("duplicate", lang)} size={32} />
      <IconBtn icon="delete" p={p} danger onClick={() => dispatch({ kind: "delete" })} title={t("delete", lang)} size={32} />
    </div>
  );
}

function FrameIdentitySection({ model, p, dispatch }: { model: FrameInspectorModel; p: Palette; dispatch: (command: FrameCommand) => void }) {
  const lang = useLang();
  return (
    <>
      <Section id="frame-size" icon="aspect_ratio" title={t("frameSize", lang)} p={p}>
        <FrameSizePicker value={model.header.preset} palette={p} onChange={(value) => dispatch({ kind: "set-preset", value })} />
      </Section>
      <Section id="frame-name" icon="label" title={t("name", lang)} p={p}>
        <Field value={model.header.name} onChange={(value) => dispatch({ kind: "set-name", value })} placeholder={t("screenName", lang)} p={p} icon={model.header.preset === "phone" ? "smartphone" : "desktop_windows"} />
      </Section>
      <Section id="frame-note" icon="notes" title={t("description", lang)} p={p}>
        <AiField
          ai={model.ai}
          history={model.identity.history}
          onRestore={() => dispatch({ kind: "restore-note", value: model.identity.history[0] ?? "", history: model.identity.note ? [model.identity.note] : undefined })}
          p={p}
          value={model.identity.note}
          onChange={(value) => dispatch({ kind: "set-note", value: value || undefined })}
          placeholder={t("screenDescription", lang)}
        />
      </Section>
    </>
  );
}

function FrameAppearanceSection({ model, p, dispatch }: { model: FrameInspectorModel; p: Palette; dispatch: (command: FrameCommand) => void }) {
  const lang = useLang();
  return (
    <>
      <Section id="frame-bg" icon="format_color_fill" title={t("background", lang)} p={p}>
        <TokenChips value={model.appearance.background ?? "surface"} onChange={(value) => dispatch({ kind: "set-background", value })} p={p} />
      </Section>
      <Section id="frame-tidy" icon="align_space_even" title={t("tidy", lang)} p={p}>
        <TidyButton state={model.tidy} onClick={() => dispatch({ kind: "tidy" })} p={p} place={model.appearance.place} onPlace={(value) => dispatch({ kind: "set-place", value })} />
      </Section>
    </>
  );
}

function FrameNavigationSection({ model, p, dispatch }: { model: FrameInspectorModel; p: Palette; dispatch: (command: FrameCommand) => void }) {
  const lang = useLang();
  const [swipeDir, setSwipeDir] = useState<SwipeDir>("left");
  if (model.navigation.targets.length <= 1) return null;
  const swipe = model.navigation.swipe.find((value) => value.direction === swipeDir);
  const frames = model.navigation.targets.filter((target) => target.id !== model.id);
  return (
    <Section id="frame-swipe" icon="swipe" title={t("swipeTo", lang)} p={p}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Segmented<SwipeDir>
          options={SWIPE_DIRS.map((direction) => ({ key: direction.key, icon: direction.icon, title: SWIPE_TEXT[lang][direction.key], dot: !!model.navigation.swipe.find((value) => value.direction === direction.key)?.target }))}
          value={swipeDir}
          onChange={setSwipeDir}
          p={p}
          height={36}
        />
        <FrameChips frames={frames} value={swipe?.target ?? null} onChange={(target) => dispatch({ kind: "set-swipe", direction: swipeDir, target })} p={p} small />
      </div>
    </Section>
  );
}

function FrameExportSection({ model, p, dispatch }: { model: FrameInspectorModel; p: Palette; dispatch: (command: FrameCommand) => void }) {
  const lang = useLang();
  const saving = model.export.image.kind === EXPORT_STATUS_KIND.running;
  const actionButton = (icon: string, label: string, onClick: () => void, busy = false) => (
    <button onClick={onClick} disabled={busy} className="m3-press" style={{ flex: 1, height: 44, borderRadius: 22, border: "none", background: p.secondaryContainer, color: p.onSecondaryContainer, fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy ? 0.6 : 1 }}>
      <Icon name={icon} size={20} />
      {label}
    </button>
  );
  return (
    <Section id="frame-export" icon="ios_share" title={t("export", lang)} p={p}>
      <ButtonRun>
        {actionButton("content_copy", t("prompt", lang), () => dispatch({ kind: "copy-prompt", prompt: model.export.prompt }))}
        {actionButton("image", saving ? t("saving", lang) : t("saveImage", lang), () => dispatch({ kind: "export-image" }), saving)}
      </ButtonRun>
      {model.export.image.kind === EXPORT_STATUS_KIND.error && <div role="status" style={{ marginTop: 8, fontSize: 12, color: p.error }}>{model.export.image.message}</div>}
      <div className="no-scrollbar" style={{ marginTop: 10, maxHeight: 260, overflowY: "auto", borderRadius: 16, background: p.surfaceContainerLow, padding: 12, fontSize: 12, lineHeight: 1.7, color: p.onSurfaceVariant, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {model.export.prompt}
      </div>
    </Section>
  );
}

export function FrameInspector({ model, palette: p, dispatch }: { model: FrameInspectorModel; palette: Palette; dispatch: (command: FrameCommand) => void }) {
  return (
    <div className="no-scrollbar" style={{ padding: "12px 12px 20px", overflowY: "auto", height: "100%" }}>
      <FrameHeaderBar model={model} p={p} dispatch={dispatch} />
      <FrameIdentitySection model={model} p={p} dispatch={dispatch} />
      <FrameAppearanceSection model={model} p={p} dispatch={dispatch} />
      <FrameNavigationSection model={model} p={p} dispatch={dispatch} />
      <FrameExportSection model={model} p={p} dispatch={dispatch} />
    </div>
  );
}

/** A small picture of what an alignment does: a dashed box for the reference (the screen's
 *  body for one part, the selection for several) and two bars placed the way the parts will be;
 *  spacing evenly shows three bars with equal gaps. */
function AlignGlyph({ kind, color, faint }: { kind: AlignKind; color: string; faint: string }) {
  const bars: [number, number, number, number][] =
    kind === "left" ? [[4, 7, 16, 6], [4, 15, 10, 6]]
    : kind === "centerH" ? [[12, 7, 16, 6], [15, 15, 10, 6]]
    : kind === "right" ? [[20, 7, 16, 6], [26, 15, 10, 6]]
    : kind === "distributeH" ? [[4, 8, 6, 12], [17, 8, 6, 12], [30, 8, 6, 12]]
    : kind === "top" ? [[12, 4, 6, 14], [22, 4, 6, 8]]
    : kind === "centerV" ? [[12, 7, 6, 14], [22, 10, 6, 8]]
    : kind === "bottom" ? [[12, 10, 6, 14], [22, 16, 6, 8]]
    : [[14, 4, 12, 4], [14, 12, 12, 4], [14, 20, 12, 4]];
  return (
    <svg width={40} height={28} viewBox="0 0 40 28" aria-hidden>
      <rect x={1} y={1} width={38} height={26} rx={3} fill="none" stroke={faint} strokeWidth={1} strokeDasharray="3 2" />
      {bars.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx={1.5} fill={color} />
      ))}
    </svg>
  );
}

/** The alignment controls: one row for left / centre / right, one for top / middle / bottom,
 *  each ending in "space evenly", which needs at least two parts. One part lines up with its
 *  screen's body; several line up with each other. Each button draws its result. */
function AlignSection({ single, onAlign, p }: { single: boolean; onAlign: (kind: AlignKind) => void; p: Palette }) {
  const lang = useLang();
  const rows: [AlignKind, UIKey][][] = [
    [["left", "alignLeft"], ["centerH", "alignCenterH"], ["right", "alignRight"], ["distributeH", "distributeH"]],
    [["top", "alignTop"], ["centerV", "alignCenterV"], ["bottom", "alignBottom"], ["distributeV", "distributeV"]],
  ];
  return (
    <Section id="align" icon="align_horizontal_left" title={t("align", lang)} p={p}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row, i) => (
          <ButtonRun key={i}>
            {row.map(([kind, key], j) => {
              const off = single && kind.startsWith("distribute");
              const outer = 22;
              const inner = 8;
              return (
                <button
                  key={kind}
                  onClick={() => onAlign(kind)}
                  disabled={off}
                  title={t(key, lang)}
                  aria-label={t(key, lang)}
                  className="m3-press"
                  style={{
                    flex: 1,
                    height: 44,
                    border: "none",
                    borderRadius: `${j === 0 ? outer : inner}px ${j === row.length - 1 ? outer : inner}px ${j === row.length - 1 ? outer : inner}px ${j === 0 ? outer : inner}px`,
                    background: p.surfaceContainerHigh,
                    cursor: off ? "default" : "pointer",
                    display: "grid",
                    placeItems: "center",
                    opacity: off ? 0.38 : 1,
                  }}
                >
                  <AlignGlyph kind={kind} color={off ? p.onSurfaceVariant : p.primary} faint={p.outline} />
                </button>
              );
            })}
          </ButtonRun>
        ))}
        <div style={{ fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant, padding: "2px 6px 0" }}>{t(single ? "alignHintOne" : "alignHintMany", lang)}</div>
      </div>
    </Section>
  );
}


function ItemHeader({ kind, p, dispatch }: { kind: ComponentKind; p: Palette; dispatch: (command: ItemHeaderCommand) => void }) {
  const lang = useLang();
  const spec = KIND_SPEC[kind];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 6px 6px 14px", borderRadius: 20, background: p.secondaryContainer, color: p.onSecondaryContainer }}>
      <Icon name={spec.paletteIcon} size={20} />
      <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{KIND_TEXT[lang][kind]?.noun ?? spec.label}</span>
      <IconBtn icon="content_copy" p={p} onClick={() => dispatch({ kind: "duplicate" })} title={t("duplicateKey", lang)} size={32} />
      <IconBtn icon="delete" p={p} danger onClick={() => dispatch({ kind: "delete" })} title={t("delete", lang)} size={32} />
    </div>
  );
}

type ToggleEditorTab = "normal" | "on";

function ToggleAppearanceSection({ toggle, tab, p, onEnabledChange, onTabChange }: { toggle: ItemStyleModel["toggle"]; tab: ToggleEditorTab; p: Palette; onEnabledChange: (enabled: boolean) => void; onTabChange: (tab: ToggleEditorTab) => void }) {
  const lang = useLang();
  const enabled = toggle !== undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 4px 12px", marginBottom: 12 }}>
      <Toggle
        on={enabled}
        onChange={onEnabledChange}
        p={p}
        icon="swap_horiz"
        label={t("toggle", lang)}
        grow
      />
      {enabled && (
        <>
          <Segmented<"normal" | "on">
            options={[
              { key: "normal", icon: "radio_button_unchecked", label: t("normalState", lang) },
              { key: "on", icon: "check_circle", label: t("onState", lang) },
            ]}
            value={tab}
            onChange={onTabChange}
            p={p}
            height={36}
          />
          {tab === "on" && <div style={{ fontSize: 11, color: p.onSurfaceVariant, padding: "0 4px" }}>{t("onStateHint", lang)}</div>}
        </>
      )}
    </div>
  );
}

function ItemTextSection({ kind, model, p, dispatch, automaticTextColor }: { kind: ComponentKind; model: ItemTextModel; p: Palette; dispatch: (command: ItemTextCommand) => void; automaticTextColor: string }) {
  const lang = useLang();
  const spec = KIND_SPEC[kind];
  return (
    <Section id="text" icon="title" title={t("text", lang)} p={p}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {spec.hasLabel && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Field value={model.label} onChange={(label) => dispatch({ kind: "set-label", value: label })} placeholder={t("label", lang)} p={p} icon="short_text" />
            {kind === COMPONENT_KIND.text && (
              <IconBtn icon="format_bold" p={p} size={44} on={model.bold} onClick={() => dispatch({ kind: "set-bold", value: !model.bold })} title={t("bold", lang)} />
            )}
          </div>
        )}
        {spec.hasSupporting && (
          <Field
            value={model.supporting ?? ""}
            onChange={(supporting) => dispatch({ kind: "set-supporting", value: supporting })}
            placeholder={kind === COMPONENT_KIND.snackbar ? t("action", lang) : t("supporting", lang)}
            p={p}
            icon="notes"
            multiline={kind === COMPONENT_KIND.card}
            rows={1}
            grow={kind === COMPONENT_KIND.card}
          />
        )}
        {kind === COMPONENT_KIND.card && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("textPosition", lang)}</span>
              <Segmented<CardAlign>
                options={[
                  { key: "start", icon: "vertical_align_top", title: t("textTop", lang) },
                  { key: "center", icon: "vertical_align_center", title: t("textMiddle", lang) },
                  { key: "end", icon: "vertical_align_bottom", title: t("textBottom", lang) },
                ]}
                value={model.contentAlign ?? "start"}
                onChange={(contentAlign) => dispatch({ kind: "set-content-align", value: contentAlign })}
                p={p}
                height={32}
                grow={false}
              />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant }}>{t("textColor", lang)}</div>
            <TextTokenChips value={model.textColor} auto={automaticTextColor} onChange={(textColor) => dispatch({ kind: "set-text-color", value: textColor })} p={p} />
          </>
        )}
      </div>
    </Section>
  );
}

function ToggleTextSection({ value, p, onChange }: { value: string; p: Palette; onChange: (value: string) => void }) {
  const lang = useLang();
  return (
    <Section id="toggle-text" icon="title" title={t("text", lang)} p={p}>
      <Field value={value} onChange={onChange} placeholder={t("label", lang)} p={p} icon="short_text" />
    </Section>
  );
}

function ToggleIconSection({ value, p, onChange }: { value: string | null; p: Palette; onChange: (value: string | null) => void }) {
  const lang = useLang();
  return (
    <Section id="toggle-icon" icon="emoji_symbols" title={t("icon", lang)} p={p}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <IconPickerDisclosure name="toggle-icon" value={value} label={t("changeIcon", lang)} palette={p} onChange={onChange} />
        {value !== null && <IconBtn icon="close" p={p} size={44} onClick={() => onChange(null)} title={t("noIcon", lang)} />}
      </div>
    </Section>
  );
}

function ToggleStyleSection({ kind, variant, p, onChange }: { kind: ComponentKind; variant: Variant; p: Palette; onChange: (value: Variant) => void }) {
  const lang = useLang();
  const variants = KIND_SPEC[kind].hasVariant ? variantsOf(kind) : [];
  if (!variants.length || kind === COMPONENT_KIND.card) return null;
  return (
    <Section id="toggle-style" icon="palette" title={t("style", lang)} p={p}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {variants.map((value) => <VariantSwatch key={value.key} v={value.key} label={value.label} p={p} on={variant === value.key} onClick={() => onChange(value.key)} />)}
      </div>
    </Section>
  );
}

function ToggleStateSections({ kind, text, icons, toggle, normalVariant, p, dispatch }: { kind: ComponentKind; text: ItemTextModel; icons: ItemIconModel | undefined; toggle: NonNullable<ItemStyleModel["toggle"]>; normalVariant: Variant; p: Palette; dispatch: (command: ToggleLookCommand) => void }) {
  const icon = icons?.slots.find((slot) => slot.key === "icon")?.value ?? null;
  const toggleIcon = toggle.icon !== undefined ? toggle.icon : icon;
  return (
    <>
      {KIND_SPEC[kind].hasLabel && <ToggleTextSection value={toggle.label ?? text.label} p={p} onChange={(value) => dispatch({ kind: "set-label", value })} />}
      {icons?.slots.some((slot) => slot.key === "icon") && <ToggleIconSection value={toggleIcon} p={p} onChange={(value) => dispatch({ kind: "set-icon", value })} />}
      <ToggleStyleSection kind={kind} variant={toggle.variant ?? normalVariant} p={p} onChange={(value) => dispatch({ kind: "set-variant", value })} />
    </>
  );
}

function TabsSection({ kind, model, p, dispatch }: { kind: ComponentKind; model: ItemTabsModel; p: Palette; dispatch: (command: ItemTabsCommand) => void }) {
  const lang = useLang();
  const tabs = model.tabs;
  const isSelect = kind === COMPONENT_KIND.select;
  const tabIcons = kind !== COMPONENT_KIND.tabs && kind !== COMPONENT_KIND.select;
  const tabLabels = kind !== COMPONENT_KIND.toolbar;
  const growsFreely = isSelect || kind === COMPONENT_KIND.tabs;
  const hasSelected = kind === COMPONENT_KIND.bottomNav || kind === COMPONENT_KIND.navRail || kind === COMPONENT_KIND.tabs || isSelect;
  const selectedTab = isSelect && model.selected === undefined ? -1 : Math.min(model.selected ?? 0, Math.max(0, tabs.length - 1));
  const remapActions = (actions: ItemTabsModel["actions"], to: (index: number) => number | undefined): ItemTabsModel["actions"] | undefined => {
    const next: ItemActions = {};
    for (const [key, action] of Object.entries(actions)) {
      if (!action || !isIconSlotKey(key)) continue;
      if (!isTabSlotKey(key)) {
        next[key] = action;
        continue;
      }
      const index = to(Number(key.slice(4)));
      if (index !== undefined) next[tabSlotKey(index)] = action;
    }
    return Object.keys(next).length ? next : undefined;
  };
  const setTabs = (next: readonly NavTab[], selected = model.selected, actions: ItemTabsModel["actions"] | undefined = model.actions) => {
    dispatch({ kind: "set-tabs", tabs: next, selected, actions });
  };
  const setTabCount = (count: number) => {
    const defaults = defaultTabsFor(kind);
    const next: NavTab[] = [];
    for (let i = 0; i < count; i++) next.push(tabs[i] ? { ...tabs[i] } : { ...defaults[i % defaults.length] });
    setTabs(next, model.selected !== undefined && model.selected >= count ? undefined : model.selected, remapActions(model.actions, (index) => index < count ? index : undefined));
  };
  const removeTab = (index: number) => {
    const next = tabs.filter((_, i) => i !== index);
    const last = Math.max(0, next.length - 1);
    const selected = model.selected === undefined ? undefined : model.selected > index ? model.selected - 1 : model.selected < index ? model.selected : kind === COMPONENT_KIND.select ? undefined : Math.min(index, last);
    setTabs(next, selected, remapActions(model.actions, (i) => i === index ? undefined : i > index ? i - 1 : i));
  };
  return (
    <Section id="tabs" icon={isSelect ? "list" : "view_column"} title={t(isSelect ? "options" : "tabs", lang)} p={p}>
      {!growsFreely && (
        <Segmented
          options={(kind === COMPONENT_KIND.toolbar ? [2, 3, 4, 5, 6] : [2, 3, 4, 5]).map((n) => ({ key: String(n), label: String(n) }))}
          value={String(tabs.length)}
          onChange={(value) => setTabCount(Number(value))}
          p={p}
          height={36}
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {tabs.map((tab, index) => {
            const selected = selectedTab === index;
          const slotKey = tabSlotKey(index);
          return (
            <div key={index} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {hasSelected && (
                <IconBtn icon={selected ? "radio_button_checked" : "radio_button_unchecked"} p={p} size={40} on={selected} onClick={() => setTabs(tabs, isSelect && selected ? undefined : index)} title={t(isSelect ? "selectedOption" : "selectedTab", lang)} />
              )}
              {tabIcons && (
                <IconPickerDisclosure name={`tabs-${kind}`} value={tab.icon || null} label={t("changeIcon", lang)} palette={p} size={40} onChange={(icon) => dispatch({ kind: "set-icon-slot", slot: slotKey, value: icon })} />
              )}
              {tabLabels && <Field value={tab.label} onChange={(label) => setTabs(tabs.map((current, j) => j === index ? { ...current, label } : current))} placeholder={t("label", lang)} p={p} height={40} />}
              {tabIcons && tab.icon && <IconBtn icon="close" p={p} size={40} onClick={() => dispatch({ kind: "set-icon-slot", slot: tabSlotKey(index), value: null })} title={t("noIcon", lang)} />}
              {growsFreely && tabs.length > 1 && <IconBtn icon="close" p={p} size={40} onClick={() => removeTab(index)} title={t(isSelect ? "removeOption" : "removeTab", lang)} />}
            </div>
          );
        })}
      </div>
      {growsFreely && (
        <button onClick={() => setTabs([...tabs, { ...defaultTabsFor(kind)[tabs.length % defaultTabsFor(kind).length] }])} className="m3-press" style={{ marginTop: 8, height: 40, width: "100%", borderRadius: 20, border: "1px solid " + p.outline, background: "transparent", color: p.primary, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Icon name="add" size={18} />
          {t(isSelect ? "addOption" : "addTab", lang)}
        </button>
      )}
      {hasSelected && !isSelect && <div style={{ fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant, padding: "8px 6px 0" }}>{t("selectedHint", lang)}</div>}
    </Section>
  );
}

function MediaSection({ kind, model, p, dispatch }: { kind: ComponentKind; model: ItemMediaModel; p: Palette; dispatch: (command: ItemMediaCommand) => void }) {
  const lang = useLang();
  const uploadId = `inspector-image-${kind}`;
  return (
    <Section id="image" icon="image" title={t("image", lang)} p={p}>
      {kind === COMPONENT_KIND.card && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          <CardLayoutPicker value={model.layout} onChange={(layout) => dispatch({ kind: "set-card-layout", value: layout })} p={p} />
          {!model.noImage && model.imagePos !== "background" && (model.imageMax ?? 0) > CARD_IMAGE_MIN && (
            <Slider icon={model.imagePos === "top" ? "height" : "width"} title={t(model.imagePos === "top" ? "height" : "width", lang)} value={model.imageSize ?? 0} min={CARD_IMAGE_MIN} max={model.imageMax ?? CARD_IMAGE_MIN} step={4} onChange={(value) => dispatch({ kind: "set-image-size", value })} p={p} />
          )}
        </div>
      )}
      <input
        id={uploadId}
        type="file"
        accept="image/*"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            dispatch({ kind: "set-image-source", value: await readImage(file) });
          } catch {}
        }}
      />
      {(!model.noImage || model.src) && (
        <>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <label htmlFor={uploadId} className="m3-press" style={{ flex: 1, height: 44, borderRadius: 22, border: "none", background: p.primary, color: p.onPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Icon name="upload" size={20} />
              {t("pickImage", lang)}
            </label>
            {model.src && <IconBtn icon="close" p={p} size={44} onClick={() => dispatch({ kind: "set-image-source", value: undefined })} title={t("removeImage", lang)} />}
          </div>
          <div style={{ marginTop: 8 }}>
            <UrlField key={model.src?.startsWith("http") ? "remote-image" : "local-image-or-empty"} value={model.src && /^https?:\/\//.test(model.src) ? model.src : ""} onChange={(src) => dispatch({ kind: "set-image-source", value: src })} placeholder={t("imageUrl", lang)} p={p} />
          </div>
        </>
      )}
    </Section>
  );
}

function IconSection({ model, navigation, p, dispatch }: { model: ItemIconModel; navigation?: ItemNavigationModel; p: Palette; dispatch: (command: ItemIconCommand) => void }) {
  const lang = useLang();
  const slots = model.slots.filter((slot) => !slot.key.startsWith("tab:"));
  if (!slots.length) return null;
  return (
    <Section id="icon" icon="emoji_symbols" title={t("icon", lang)} p={p}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {slots.map((slot) => (
          <div key={slot.key} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            <IconPickerDisclosure name="item-icons" value={slot.value} label={slot.label} palette={p} showLabel={slots.length > 1} onChange={(icon) => dispatch({ kind: "set-icon-slot", slot: slot.key, value: icon })} />
            {slot.value && (
              <IconBtn
                icon="close"
                p={p}
                size={44}
                onClick={() => {
                  if (navigation?.slots.find((candidate) => candidate.key === slot.key)?.action) dispatch({ kind: "set-action", slot: slot.key, value: undefined });
                  dispatch({ kind: "set-icon-slot", slot: slot.key, value: null });
                }}
                title={t("noIcon", lang)}
              />
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function StyleSection({ kind, p, variant, dispatch }: { kind: ComponentKind; p: Palette; variant: Variant; dispatch: (command: ItemStyleCommand) => void }) {
  const lang = useLang();
  const variants = KIND_SPEC[kind].hasVariant ? variantsOf(kind) : [];
  if (!variants.length || kind === COMPONENT_KIND.card) return null;
  return (
    <Section id="style" icon="palette" title={t("style", lang)} p={p}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {variants.map((value) => <VariantSwatch key={value.key} v={value.key} label={value.label} p={p} on={variant === value.key} onClick={() => dispatch({ kind: "set-variant", value: value.key })} />)}
      </div>
    </Section>
  );
}

function FillSection({ kind, p, style, dispatch }: { kind: ComponentKind; p: Palette; style: ItemStyleModel; dispatch: (command: ItemFillCommand) => void }) {
  const lang = useLang();
  const spec = KIND_SPEC[kind];
  if (!spec.hasFill) return null;
  const fill = style.fill ?? (kind === COMPONENT_KIND.card ? cardDefaultFillOf(style.variant) : "surfaceContainerLow");
  return (
    <Section id="fill" icon="format_color_fill" title={t("background", lang)} p={p}>
      <TokenChips value={fill} onChange={(value) => dispatch({ kind: "set-fill", value })} p={p} none={kind === COMPONENT_KIND.card} noneOn={kind === COMPONENT_KIND.card && !style.fill} onNone={() => dispatch({ kind: "set-fill", value: undefined })} noneColor={kind === COMPONENT_KIND.card ? p[cardDefaultFillOf(style.variant)] : undefined} noneTextColor={kind === COMPONENT_KIND.card ? onToken(cardDefaultFillOf(style.variant), p) : undefined} noneIcon={kind === COMPONENT_KIND.card ? "restart_alt" : undefined} noneLabel={kind === COMPONENT_KIND.card ? t("defaultColor", lang) : undefined} />
      {kind === COMPONENT_KIND.listItem && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: p.onSurfaceVariant, margin: "10px 0 6px" }}>{t("iconBackground", lang)}</div>
          <TokenChips value={style.iconFill && style.iconFill !== "none" ? style.iconFill : "primaryContainer"} onChange={(iconFill) => dispatch({ kind: "set-icon-fill", value: iconFill })} p={p} none noneOn={style.iconFill === "none"} onNone={() => dispatch({ kind: "set-icon-fill", value: "none" })} />
        </>
      )}
    </Section>
  );
}

function StateSection({ kind, p, state, dispatch }: { kind: ComponentKind; p: Palette; state: ItemStateModel; dispatch: (command: ItemStateCommand) => void }) {
  const lang = useLang();
  const spec = KIND_SPEC[kind];
  if (!(spec.hasChecked || spec.hasValue || spec.hasWavy || spec.hasContained || kind === COMPONENT_KIND.listItem)) return null;
  return (
    <Section id="state" icon="tune" title={t("state", lang)} p={p}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "2px 0" }}>
        {kind === COMPONENT_KIND.listItem && <Toggle on={!!state.switch} onChange={(value) => dispatch({ kind: "set-switch", value })} p={p} icon="toggle_on" label={t("listSwitch", lang)} grow />}
        {kind === COMPONENT_KIND.listItem && state.switch && <Toggle on={!!state.checked} onChange={(value) => dispatch({ kind: "set-checked", value })} p={p} icon="toggle_on" label={t("on", lang)} grow />}
        {spec.hasChecked && <Toggle on={!!state.checked} onChange={(value) => dispatch({ kind: "set-checked", value })} p={p} icon={kind === COMPONENT_KIND.chip ? "check_circle" : kind === COMPONENT_KIND.box ? "drag_handle" : "toggle_on"} label={kind === COMPONENT_KIND.chip ? t("selected", lang) : kind === COMPONENT_KIND.box ? t("handle", lang) : t("on", lang)} grow />}
        {kind === COMPONENT_KIND.switch && <Toggle on={!state.noCheck} onChange={(value) => dispatch({ kind: "set-no-check", value: !value })} p={p} icon="check" label={t("thumbCheck", lang)} grow />}
        {spec.hasContained && <Toggle on={!!state.contained} onChange={(value) => dispatch({ kind: "set-contained", value })} p={p} icon="circle" label={t("container", lang)} grow />}
        {spec.hasWavy && <Toggle on={!!state.wavy} onChange={(value) => dispatch({ kind: "set-wavy", value })} p={p} icon="airwave" label={t("wavy", lang)} grow />}
        {spec.hasValue && kind !== COMPONENT_KIND.slider && <Toggle on={state.value !== undefined} onChange={(value) => dispatch({ kind: "set-value", value: value ? 60 : undefined })} p={p} icon="percent" label={t("determinate", lang)} grow />}
        {spec.hasValue && (kind === COMPONENT_KIND.slider || state.value !== undefined) && <Slider icon="percent" value={state.value ?? 40} min={0} max={100} step={1} onChange={(value) => dispatch({ kind: "set-value", value })} p={p} unit="%" />}
      </div>
    </Section>
  );
}

function RailSection({ model, p, dispatch }: { model: ItemRailModel; p: Palette; dispatch: (command: ItemRailCommand) => void }) {
  const lang = useLang();
  return (
    <Section id="rail" icon="side_navigation" title={t("railState", lang)} p={p}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!model.wide ? (
          <>
            <div style={{ fontSize: 12, color: p.onSurfaceVariant }}>{t("railLegacy", lang)}</div>
            <button type="button" onClick={() => dispatch({ kind: "set-rail", expanded: false, modal: undefined })} className="m3-press" style={{ height: 40, width: "100%", borderRadius: 20, border: "1px solid " + p.outline, background: "transparent", color: p.primary, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Icon name="side_navigation" size={18} />
              {t("railUpgrade", lang)}
            </button>
          </>
        ) : (
          <>
            <div role="group" aria-label={t("railState", lang)}>
              <Segmented options={[{ key: "collapsed", label: t("railCollapsed", lang) }, { key: "expanded", label: t("railExpanded", lang) }]} value={model.expanded ? "expanded" : "collapsed"} onChange={(value) => dispatch({ kind: "set-rail", expanded: value === "expanded", modal: model.modal })} p={p} />
            </div>
            <div role="group" aria-label={t("railPresentation", lang)}>
              <div style={{ fontSize: 12, color: p.onSurfaceVariant, marginBottom: 6 }}>{t("railPresentation", lang)}</div>
              {model.mode === "standalone" ? <Segmented options={[{ key: "standard", label: t("railStandard", lang) }, { key: "modal", label: t("railModal", lang) }]} value={model.modal ? "modal" : "standard"} onChange={(value) => dispatch({ kind: "set-rail", expanded: model.expanded, modal: value === "modal" })} p={p} /> : <div style={{ fontSize: 12, color: p.onSurfaceVariant }}>{t("railStandalone", lang)}</div>}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

function GeometrySection({ kind, model, state, frameSize, p, dispatch }: { kind: ComponentKind; model: ItemGeometryModel; state: ItemStateModel; frameSize: { w: number; h: number }; p: Palette; dispatch: (command: ItemGeometryCommand) => void }) {
  const lang = useLang();
  const spec = KIND_SPEC[kind];
  const hasRadius = kind === COMPONENT_KIND.bottomNav || kind === COMPONENT_KIND.navRail || kind === COMPONENT_KIND.topAppBar || kind === COMPONENT_KIND.card || kind === COMPONENT_KIND.image || kind === COMPONENT_KIND.camera || kind === COMPONENT_KIND.map || kind === COMPONENT_KIND.box;
  if (!spec.size && !hasRadius) return null;
  const mapWidthPreset = (value: number) => value === PHONE_W ? frameSize.w : value === CONTENT_W ? contentWidth(frameSize.w) : value === HALF_W ? halfWidth(frameSize.w) : value;
  const mapHeightPreset = (value: number) => value === PHONE_H ? frameSize.h : value === PHONE_H / 2 ? frameSize.h / 2 : value;
  const widthMax = (value: number) => value === PHONE_W ? frameSize.w : value === CONTENT_W ? contentWidth(frameSize.w) : value;
  const heightMax = (value: number) => value === PHONE_H ? frameSize.h : value;
  return (
    <Section id="size" icon="straighten" title={t("size", lang)} p={p}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {spec.hasWavy && <Slider icon="line_weight" title={t("trackThickness", lang)} value={Math.min(state.trackThickness ?? TRACK_DEFAULT, kind === COMPONENT_KIND.circularProgress ? maxRingThickness(model.size ?? spec.w) : TRACK_MAX)} min={TRACK_MIN} max={kind === COMPONENT_KIND.circularProgress ? maxRingThickness(model.size ?? spec.w) : TRACK_MAX} step={1} onChange={(value) => dispatch({ kind: "set-track-thickness", value: value === TRACK_DEFAULT ? undefined : value })} p={p} />}
        {spec.size && (
          <>
            <Slider icon={spec.size.icon} title={kind === COMPONENT_KIND.text ? t("fontSize", lang) : spec.size.icon === "width" ? t("width", lang) : t("size", lang)} value={model.size ?? spec.defSize ?? spec.w} min={spec.size.min} max={widthMax(spec.size.max)} step={spec.size.step} onChange={(value) => dispatch({ kind: "set-size", value })} p={p} unit={kind === COMPONENT_KIND.text ? "sp" : ""} />
            {spec.size.presets && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {(kind === COMPONENT_KIND.button || kind === COMPONENT_KIND.switch) && <button onClick={() => dispatch({ kind: "set-size", value: undefined })} aria-pressed={model.size === undefined} className="m3-press" style={{ height: 28, padding: "0 12px", borderRadius: 14, border: "none", background: model.size === undefined ? p.secondaryContainer : p.surfaceContainerHigh, color: model.size === undefined ? p.onSecondaryContainer : p.onSurfaceVariant, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t("autoWidth", lang)}</button>}
                <SizePresets values={[...new Set([...(frameSize.w !== PHONE_W && spec.size.icon === "width" && spec.size.presets.includes(CONTENT_W) ? [CONTENT_W] : []), ...spec.size.presets.map(mapWidthPreset)])].sort((a, b) => a - b)} value={model.size ?? spec.defSize ?? spec.w} min={spec.size.min} max={widthMax(spec.size.max)} onChange={(value) => dispatch({ kind: "set-size", value })} p={p} labelOf={kind === COMPONENT_KIND.text ? undefined : (value) => widthPresetLabel(value, frameSize.w)} />
              </div>
            )}
          </>
        )}
        {spec.size2 && (
          <>
            <Slider icon={spec.size2.icon} title={t("height", lang)} value={model.size2 ?? spec.h} min={spec.size2.min} max={heightMax(spec.size2.max)} step={spec.size2.step} onChange={(value) => dispatch({ kind: "set-size2", value })} p={p} />
            {spec.size2.presets && <SizePresets values={[...new Set(spec.size2.presets.map(mapHeightPreset))]} value={model.size2 ?? spec.h} min={spec.size2.min} max={heightMax(spec.size2.max)} onChange={(value) => dispatch({ kind: "set-size2", value })} p={p} labelOf={(value) => heightPresetLabel(value, frameSize.h)} />}
          </>
        )}
        {hasRadius && kind === COMPONENT_KIND.image && <Slider icon="rounded_corner" title={t("cornerRadius", lang)} value={model.radiusTop ?? spec.radius} min={0} max={48} step={1} onChange={(value) => dispatch({ kind: "set-radius", side: "top", value })} p={p} />}
        {hasRadius && (kind === COMPONENT_KIND.card || kind === COMPONENT_KIND.box) && (() => {
          const isBox = kind === COMPONENT_KIND.box;
          const top = model.radiusTop ?? (isBox ? 0 : scaleR(spec.radius));
          const bottom = isBox ? model.radiusBottom ?? 0 : top;
          const corners = model.corners ?? (isBox && top !== bottom ? { tl: top, tr: top, bl: bottom, br: bottom } : undefined);
          return (
            <>
              {!corners && <Slider icon="rounded_corner" title={t("cornerRadius", lang)} value={top} min={0} max={48} step={1} onChange={(value) => { dispatch({ kind: "set-radius", side: "top", value }); if (isBox) dispatch({ kind: "set-radius", side: "bottom", value }); }} p={p} />}
              <Toggle on={!!corners} onChange={(each) => dispatch({ kind: "set-corners", value: each ? { tl: top, tr: top, bl: bottom, br: bottom } : undefined, radiusTop: each ? model.radiusTop : corners?.tl ?? top, radiusBottom: each ? model.radiusBottom : isBox ? corners?.tl ?? top : undefined })} p={p} icon="crop_free" label={t("cornersEach", lang)} grow />
              {corners && (["tl", "tr", "bl", "br"] as const).map((key) => <Slider key={key} iconNode={<CornerIcon side={key} />} title={t(key === "tl" ? "cornerTl" : key === "tr" ? "cornerTr" : key === "bl" ? "cornerBl" : "cornerBr", lang)} value={corners[key]} min={0} max={48} step={1} onChange={(value) => dispatch({ kind: "set-corners", value: { ...corners, [key]: value }, radiusTop: model.radiusTop, radiusBottom: model.radiusBottom })} p={p} />)}
            </>
          );
        })()}
        {hasRadius && (kind === COMPONENT_KIND.bottomNav || kind === COMPONENT_KIND.navRail || kind === COMPONENT_KIND.topAppBar) && (
          <>
            <Slider iconNode={<CornerIcon side={kind === COMPONENT_KIND.navRail ? "left" : "top"} />} title={t(kind === COMPONENT_KIND.navRail ? "cornerLeft" : "cornerTop", lang)} value={model.radiusTop ?? 0} min={0} max={40} step={1} onChange={(value) => dispatch({ kind: "set-radius", side: "top", value })} p={p} />
            <Slider iconNode={<CornerIcon side={kind === COMPONENT_KIND.navRail ? "right" : "bottom"} />} title={t(kind === COMPONENT_KIND.navRail ? "cornerRight" : "cornerBottom", lang)} value={model.radiusBottom ?? 0} min={0} max={40} step={1} onChange={(value) => dispatch({ kind: "set-radius", side: "bottom", value })} p={p} />
          </>
        )}
      </div>
    </Section>
  );
}

function NavigationSection({ kind, model, p, dispatch }: { kind: ComponentKind; model: ItemNavigationModel; p: Palette; dispatch: (command: ItemNavigationCommand) => void }) {
  const lang = useLang();
  type SlotKey = ItemNavigationModel["slots"][number]["key"];
  const [actionSlot, setActionSlot] = useState<SlotKey | null>(null);
  const slots = model.slots;
  if (!slots.length || !model.targets.length) return null;
  const activeKey = actionSlot && slots.some((slot) => slot.key === actionSlot) ? actionSlot : slots[0]?.key;
  const active = slots.find((slot) => slot.key === activeKey);
  return (
    <Section id="action" icon="ads_click" title={t("tapTo", lang)} p={p}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {slots.length > 1 && (
          kind === COMPONENT_KIND.tabs ? (
            <div role="radiogroup" aria-label={t("tapTo", lang)} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {slots.map((slot) => {
                const selected = slot.key === activeKey;
                return <button key={slot.key} onClick={() => setActionSlot(slot.key)} title={slot.label} role="radio" aria-checked={selected} className="m3-press" style={{ height: 32, padding: "0 12px", borderRadius: 8, maxWidth: "100%", cursor: "pointer", fontSize: 13, fontWeight: 600, border: "1px solid " + (selected ? "transparent" : p.outline), background: selected ? p.primary : "transparent", color: selected ? p.onPrimary : p.onSurfaceVariant, display: "inline-flex", alignItems: "center", gap: 6 }}>{slot.action && <Icon name="ads_click" size={16} />}<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slot.label}</span></button>;
              })}
            </div>
          ) : (
            <Segmented<SlotKey> options={slots.map((slot) => ({ key: slot.key, icon: slot.icon ?? undefined, label: slot.icon ? undefined : slot.label, title: slot.label, dot: !!slot.action }))} value={activeKey ?? slots[0].key} onChange={setActionSlot} p={p} height={40} />
          )
        )}
        {active && <ActionEditor frames={model.targets} action={active.action ?? undefined} onChange={(value) => dispatch({ kind: "set-action", slot: active.key === "default" ? null : active.key, value })} p={p} />}
      </div>
    </Section>
  );
}

function BehaviorSection({ kind, model, ai, p, dispatch }: { kind: ComponentKind; model: ItemBehaviorModel; ai: AiCapability; p: Palette; dispatch: (command: ItemBehaviorCommand) => void }) {
  const lang = useLang();
  return (
    <Section id="note" icon="bolt" title={t("behavior", lang)} p={p}>
      <AiField
        ai={ai}
        history={model.history}
        onRestore={() => dispatch({ kind: "restore-note", value: model.history[0] ?? "", history: model.note ? [model.note] : undefined })}
        p={p}
        value={model.note}
        onChange={(value) => dispatch({ kind: "set-note", value })}
        placeholder={kind === COMPONENT_KIND.button || kind === COMPONENT_KIND.fab || kind === COMPONENT_KIND.iconButton || kind === COMPONENT_KIND.extendedFab ? t("whenPressed", lang) : t("whatItDoes", lang)}
      />
    </Section>
  );
}

function NormalContentSections({ model, p, dispatch }: { model: ItemInspectorModel; p: Palette; dispatch: (command: ItemCommand) => void }) {
  const spec = KIND_SPEC[model.kind];
  const { text, tabs, media, icons, style, navigation } = model.sections;
  const automaticTextColor = model.kind === COMPONENT_KIND.card && media && !media.noImage && media.imagePos === "background" ? (media.src ? "#ffffff" : p.onPrimaryContainer) : style.fill ? onToken(style.fill, p) : p.onSurface;
  return (
    <>
      {(spec.hasLabel || spec.hasSupporting) && <ItemTextSection kind={model.kind} model={text} p={p} dispatch={dispatch} automaticTextColor={automaticTextColor} />}
      {spec.hasTabs && tabs && <TabsSection key={`${model.id}:${tabs.tabs.length}`} kind={model.kind} model={tabs} p={p} dispatch={dispatch} />}
      {media && <MediaSection kind={model.kind} model={media} p={p} dispatch={dispatch} />}
      {icons && !media?.src && <IconSection key={`${model.id}:${icons.slots.map((slot) => slot.key).join("|")}`} model={icons} navigation={navigation} p={p} dispatch={dispatch} />}
    </>
  );
}

function NormalAppearanceSections({ model, p, dispatch }: { model: ItemInspectorModel; p: Palette; dispatch: (command: ItemCommand) => void }) {
  const { style, state, rail, geometry } = model.sections;
  const frameSize = model.frame ? { w: model.frame.width, h: model.frame.height } : { w: PHONE_W, h: PHONE_H };
  return (
    <>
      <StyleSection kind={model.kind} p={p} variant={style.variant} dispatch={dispatch} />
      <FillSection kind={model.kind} p={p} style={style} dispatch={dispatch} />
      <StateSection kind={model.kind} p={p} state={state} dispatch={dispatch} />
      {rail && <RailSection model={rail} p={p} dispatch={dispatch} />}
      <GeometrySection kind={model.kind} model={geometry} state={state} frameSize={frameSize} p={p} dispatch={dispatch} />
    </>
  );
}

function NormalInteractionSections({ model, p, dispatch }: { model: ItemInspectorModel; p: Palette; dispatch: (command: ItemCommand) => void }) {
  const { navigation, behavior } = model.sections;
  return (
    <>
      {navigation && <NavigationSection kind={model.kind} model={navigation} p={p} dispatch={dispatch} />}
      <BehaviorSection kind={model.kind} model={behavior} ai={model.ai} p={p} dispatch={dispatch} />
    </>
  );
}

function NormalItemSections({ model, p, dispatch }: { model: ItemInspectorModel; p: Palette; dispatch: (command: ItemCommand) => void }) {
  return (
    <>
      <AlignSection single onAlign={(value) => dispatch({ kind: "align", value })} p={p} />
      <NormalContentSections model={model} p={p} dispatch={dispatch} />
      <NormalAppearanceSections model={model} p={p} dispatch={dispatch} />
      <NormalInteractionSections model={model} p={p} dispatch={dispatch} />
    </>
  );
}

function ToggleItemSections({ model, p, dispatch }: { model: ItemInspectorModel; p: Palette; dispatch: (command: ToggleLookCommand) => void }) {
  const { text, icons, media, style } = model.sections;
  if (!style.toggle) return null;
  return <ToggleStateSections kind={model.kind} text={text} icons={media?.src ? undefined : icons} toggle={style.toggle} normalVariant={style.variant} p={p} dispatch={dispatch} />;
}

function ToggleOnStateSections({ model, p, dispatch }: { model: ItemInspectorModel; p: Palette; dispatch: (command: ItemCommand) => void }) {
  const toggle = model.sections.style.toggle;
  if (!toggle) return null;
  return <ToggleItemSections model={model} p={p} dispatch={(command) => dispatch({ kind: "set-toggle", value: applyToggleLookCommand(toggle, command) })} />;
}

function ItemInspectorBody({ model, palette: p, dispatch }: { model: ItemInspectorModel; palette: Palette; dispatch: (command: ItemCommand) => void }) {
  const style = model.sections.style;
  const toggleEnabled = style.toggle !== undefined;
  const [toggleTab, setToggleTab] = useState<ToggleEditorTab>("normal");

  const setToggleEnabled = (enabled: boolean) => {
    setToggleTab("normal");
    dispatch({ kind: "set-toggle", value: enabled ? {} : undefined });
  };

  return (
    <div className="no-scrollbar" style={{ padding: "12px 12px 20px", overflowY: "auto", height: "100%" }}>
      <ItemHeader kind={model.kind} p={p} dispatch={dispatch} />
      {isToggleableKind(model.kind) && <ToggleAppearanceSection toggle={style.toggle} tab={toggleTab} p={p} onEnabledChange={setToggleEnabled} onTabChange={setToggleTab} />}
      {toggleEnabled && toggleTab === "on" ? <ToggleOnStateSections model={model} p={p} dispatch={dispatch} /> : <NormalItemSections model={model} p={p} dispatch={dispatch} />}
    </div>
  );
}

export function ItemInspector({ model, palette: p, dispatch }: { model: ItemInspectorModel; palette: Palette; dispatch: (command: ItemCommand) => void }) {
  return <ItemInspectorBody key={model.id} model={model} palette={p} dispatch={dispatch} />;
}

function EmptyInspector({ p }: { p: Palette }) {
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", color: p.outlineVariant, padding: 24, textAlign: "center" }}>
      <Icon name="ads_click" size={44} />
    </div>
  );
}

function SelectionInspector({ model, palette: p, dispatch }: { model: SelectionInspectorModel; palette: Palette; dispatch: (command: SelectionCommand) => void }) {
  const lang = useLang();
  const bigButton = (icon: string, label: string, command: SelectionCommand) => (
    <button
      onClick={() => dispatch(command)}
      className="m3-press"
      style={{ height: 48, borderRadius: 24, border: "none", background: p.primary, color: p.onPrimary, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" }}
    >
      <Icon name={icon} size={22} />
      {label}
    </button>
  );
  const grouped = model.kind === SELECTION_KIND.group;
  return (
    <div className="no-scrollbar" style={{ padding: "12px 12px 20px", overflowY: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "6px 6px 6px 14px", borderRadius: 20, background: p.secondaryContainer, color: p.onSecondaryContainer }}>
        <Icon name={grouped ? "group_work" : "select_all"} size={20} />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{grouped ? t("group", lang) : lang === "en" ? `${model.count} ${t("selectedParts", lang)}` : `${model.count}${t("selectedParts", lang)}`}</span>
        <IconBtn icon="delete" p={p} danger onClick={() => dispatch({ kind: "delete" })} title={t("deleteSelection", lang)} size={32} />
      </div>
      <AlignSection single={false} onAlign={(value) => dispatch({ kind: "align", value })} p={p} />
      {grouped ? bigButton("ungroup", t("ungroup", lang), { kind: "ungroup" }) : bigButton("group_work", t("makeGroup", lang), { kind: "group" })}
      <IconBtn icon="content_copy" p={p} onClick={() => dispatch({ kind: "duplicate" })} title={t("duplicate", lang)} size={44} />
      <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: p.onSurfaceVariant, padding: "0 6px" }}>{grouped ? t("groupEditNote", lang) : `${t("groupHint", lang)} (Ctrl+G)`}</div>
    </div>
  );
}

export function InspectorHost({ surface, palette: p, dispatch }: { surface: InspectorSurface; palette: Palette; dispatch: InspectorDispatch }) {
  switch (surface.kind) {
    case INSPECTOR_SURFACE_KIND.empty:
      return <EmptyInspector p={p} />;
    case INSPECTOR_SURFACE_KIND.selection:
      return <SelectionInspector model={surface.model} palette={p} dispatch={(command) => dispatch({ target: "selection", ids: surface.model.ids, command })} />;
    case INSPECTOR_SURFACE_KIND.item:
      return <ItemInspector model={surface.model} palette={p} dispatch={(command) => dispatch({ target: "item", id: surface.model.id, command })} />;
    case INSPECTOR_SURFACE_KIND.frame:
      return <FrameInspector model={surface.model} palette={p} dispatch={(command) => dispatch({ target: "frame", id: surface.model.id, command })} />;
    default:
      return assertInspectorNever(surface, "Unhandled inspector surface");
  }
}
