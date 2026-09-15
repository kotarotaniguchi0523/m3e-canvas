Warning: truncated output (original token count: 40766)
Total output lines: 4339

"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AnimatePresence, motion, useReducedMotion, useSpring } from "motion/react";
import { toPng } from "html-to-image";
import { buildPrompt, effectivePrompt } from "@/lib/prompt";
import {
  Action,
  actionsOf,
  Axis,
  BACK_TARGET,
  baseRadii,
  explodeGroup,
  freeRadii,
  radiiOfRuns,
  BEZEL,
  canJoin,
  clamp,
  connectSpecOf,
  Doc,
  isPlatform,
  Platform,
  Frame,
  Place,
  AlignKind,
  FramePreset,
  FRAME_GAP,
  FRAME_LABEL_H,
  FrameMode,
  frameOfGroup,
  framePresetPatch,
  frameRadius,
  frameRect,
  frameSizeOf,
  carryItemSize,
  defaultPlatformOf,
  GAP,
  Group,
  groupBounds,
  Item,
  Kind,
  KIND_ORDER,
  KIND_SPEC,
  collapseFree,
  layoutOf,
  lerp,
  makeItem,
  DEFAULT_THEME,
  Theme,
  fontFamilyOf,
  uiFontFamily,
  normalizeTheme,
  setGlobalShape,
  MEASURED,
  NAV_BAR_H,
  Palette,
  paletteOf,
  PHONE_H,
  PHONE_MARGIN,
  PHONE_W,
  PULL_EXP,
  Radii,
  SETTLE_MS,
  sizeOf,
  SNAP_CROSS,
  SNAP_MAIN,
  Transition,
  TRANSITIONS,
  uid,
  uniformRadii,
  FULL_WIDTH,
  fitHeight,
  railExpansionSide,
} from "@/lib/tokens";
import { Icon, M3Node, M3Static, MeasuredContent } from "@/components/M3Node";
import { LayersPanel } from "@/components/Layers";
import { FrameInspector, FrameSizePicker, Inspector } from "@/components/Inspector";
import { Preview } from "@/components/Preview";
import { Logo } from "@/components/Logo";
import { PartsPalette } from "@/components/PartsPalette";
import { PromptPanel } from "@/components/PromptPanel";
import { GitHubLink, Mode, Toolbar } from "@/components/Toolbar";
import { LangMenu } from "@/components/Menus";
import { AiActionKey, AiPanel, aiErrorText } from "@/components/AiPanel";
import { TidyState } from "@/components/ui";
import { AiSettings, DEFAULT_AI, hasKey, isSecureUrl, loadAiSettings, proposeBehavior, proposeDescription, pushHistory, saveAiSettings } from "@/lib/ai";
import { barSlotOf, bodyRect, carryFrame, pullInto, tidyFrame } from "@/lib/tidy";
import { constrainModalRails, modalRailOf, updateRail } from "@/lib/rail";
import { isProject, readProject, saveProject } from "@/lib/project";
import { hasShareHash, readShareHash } from "@/lib/share";
import { LoadingIndicator } from "@/components/Loading";
import { draftDesign } from "@/lib/ai";
import { ShareDialog } from "@/components/ShareMenu";
import { ColorPanel } from "@/components/ColorPanel";
import { MotionPanel, ShapePanel, TypePanel } from "@/components/ThemePanel";
import { ThemeContext, ensureFontLoaded, ensureLangFontLoaded } from "@/lib/theme";
import { BottomSheet, MobileActionBar, MobileInspector, MobileLang, MobileSettings } from "@/components/Mobile";
import { ConfirmDialog, IconBtn, Segmented } from "@/components/ui";
import { Lang, LangContext, SEED_TEXT, getLang, setGlobalLang, t, translateDefaultFrameName, translateDefaultText } from "@/lib/i18n";

/** the screens while a model drafts: primary, tertiary and primary container, drifting */
const DRAFT_GRADIENT = (p: Palette) => `linear-gradient(120deg, ${p.primaryContainer}, ${p.tertiaryContainer}, ${p.primary}, ${p.secondaryContainer}, ${p.primaryContainer})`;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** the dragged part's own travel: a little lag reads as weight */
const CARRY = {
  type: "spring" as const,
  stiffness: 620,
  damping: 38,
  mass: 0.7,
};
/** the gap opening and the run's counter-shift; identical configs so they cancel */
const OPEN = {
  type: "spring" as const,
  stiffness: 700,
  damping: 42,
  mass: 0.55,
};
const INSTANT = { duration: 0 };

/** the icon rail on the left edge of the parts / layers panel */
const RAIL_W = 52;
const MIN_Z = 0.25;
const MAX_Z = 3;
const HISTORY_MAX = 100;
const DOC_KEY = "m3e:doc";
/** the design a draft or a link replaced, until the author keeps or undoes it */
const BEFORE_KEY = "m3e:doc:before";
const DOC_LOCK = "m3e:doc:editor";
const UI_KEY = "m3e:ui";

type View = { x: number; y: number; z: number };
type Snap = { groupId: string; index: number; pull: number };

/** alignment guide: the snapped position plus the line to draw */
type Guide = { x?: number; y?: number; gx?: number; gy?: number };
const GUIDE_PX = 7;

/** Material's 4dp grid: a coordinate rounded to it, measured from the screen's corner */
const GRID = 4;
const onGrid = (v: number, origin: number) => origin + Math.round((v - origin) / GRID) * GRID;
const FRAME_MARGIN = PHONE_MARGIN;

type DragState = {
  item: Item;
  guide: Guide | null;
  offX: number;
  offY: number;
  startX: number;
  startY: number;
  px: number;
  py: number;
  active: boolean;
  fromPalette: boolean;
  overBin: boolean;
  snap: Snap | null;
  settling: boolean;
};

type Gesture =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | {
      kind: "marquee";
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      moved: boolean;
    }
  | {
      kind: "frame";
      id: string;
      sx: number;
      sy: number;
      fx: number;
      fy: number;
      groups: { id: string; x: number; y: number }[];
      moved: boolean;
    }
  | { kind: "group"; id: string; sx: number; sy: number; gx: number; gy: number; moved: boolean; overBin: boolean; guide?: Guide | null };

/** everything in a document apart from its screens and parts */
type DocMeta = Omit<Doc, "groups" | "frames">;
/** an undo step: the screens and parts, plus the rest of the document for steps that replaced it all */
type Snapshot = { groups: Group[]; frames: Frame[]; meta?: DocMeta };

type StateUpdate<T> = T | ((current: T) => T);

/**
 * The persisted document is one logical value. Keeping each field in a separate
 * state cell made it possible for a document replacement to temporarily mix
 * fields from two documents and forced `doc` to be reconstructed at the bottom
 * of the component. The editor keeps nulls internally so reset operations are
 * explicit; serialization converts them back to optional Doc fields.
 */
type EditorDocState = {
  groups: Group[];
  frames: Frame[];
  paletteKey: string;
  customPalette: Palette | null;
  dynamicColor: boolean;
  theme: Theme;
  frame: FrameMode;
  title: string;
  brief: string;
  promptEdit: string | undefined;
  platform: Platform | null;
};

/** Only one of these can be active at a time in the editor UI. */
type SelectionState =
  | { kind: "none" }
  | { kind: "items"; ids: string[] }
  | { kind: "frame"; id: string }
  | { kind: "link"; id: string };

function resolveStateUpdate<T>(next: StateUpdate<T>, current: T): T {
  return typeof next === "function" ? (next as (current: T) => T)(current) : next;
}

/** a screen changing size eases the way a settling part does */
const SIZE_TRANSITION = `width ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1), height ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1), border-radius ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)`;

function translateSnapshot(snap: Snapshot, lang: Lang): Snapshot {
  return {
    groups: snap.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        label: translateDefaultText(item.label, item.kind, "label", lang),
        ...(item.supporting !== undefined && { supporting: translateDefaultText(item.supporting, item.kind, "supporting", lang) }),
        ...(item.tabs && { tabs: item.tabs.map((tab) => ({ ...tab, label: translateDefaultText(tab.label, item.kind, "tab", lang) })) }),
      })),
    })),
    frames: snap.frames.map((frame) => ({ ...frame, name: translateDefaultFrameName(frame.name, lang) })),
  };
}

const SEED_FRAMES: Frame[] = [{ id: "seedF1", name: "Home", x: 0, y: 0 }];

/** Documents saved before the bars grew their system insets have the navigation
 *  bar flush with the old 80dp bottom; keep it on the bottom edge. */
function migrateGroups(groups: Group[], frames: Frame[]): Group[] {
  const oldNavH = KIND_SPEC.bottomNav.h - NAV_BAR_H;
  return groups.map((g) => {
    if (g.items.length !== 1 || g.items[0].kind !== "bottomNav") return g;
    const f = frames.find((fr) => {
      const r = frameRect(fr);
      return g.x >= r.l - 1 && g.x <= r.r && g.y === r.b - oldNavH;
    });
    return f ? { ...g, y: frameRect(f).b - KIND_SPEC.bottomNav.h } : g;
  });
}

/** Seed ids are deterministic so server and client render the same markup. */
/* shown when an edit is refused because the group is locked */
const lockedGroupMsg = () => t("lockedGroup", getLang());

const seed = (lang: Lang = getLang()): Group[] => {
  const text = SEED_TEXT[lang];
  let n = 0;
  const sid = () => `seed${++n}`;
  const mk = (k: Kind) => ({ ...makeItem(k), id: sid() });
  const bar = mk("topAppBar");
  const a = mk("button");
  const b = mk("button");
  a.label = text.favorite;
  a.icon = "star";
  b.label = text.share;
  b.icon = "share";
  b.variant = "tonal";
  const rows = [text.inbox, text.starred, text.archive].map((t, i) => {
    const it = mk("listItem");
    it.label = t;
    it.icon = ["inbox", "star", "archive"][i];
    it.supporting = text.supporting;
    return it;
  });
  const nav = mk("bottomNav");
  const fab = mk("fab");
  return [
    { id: sid(), x: 0, y: 0, axis: "x", items: [bar] },
    { id: sid(), x: PHONE_MARGIN, y: 96, axis: "x", items: [a, b] },
    { id: sid(), x: PHONE_MARGIN, y: 184, axis: "y", items: rows },
    {
      id: sid(),
      x: PHONE_W - 56 - PHONE_MARGIN,
      y: PHONE_H - KIND_SPEC.bottomNav.h - 56 - PHONE_MARGIN,
      axis: "x",
      items: [fab],
    },
    { id: sid(), x: 0, y: PHONE_H - KIND_SPEC.bottomNav.h, axis: "x", items: [nav] },
  ];
};

/** The phone version starts with buttons only: that is all it edits. */
const mobileSeed = (lang: Lang = getLang()): Group[] => {
  const text = SEED_TEXT[lang];
  const mk = (k: Kind) => makeItem(k);
  const a = mk("button");
  const b = mk("button");
  const c = mk("button");
  a.label = text.favorite;
  a.icon = "star";
  b.label = text.share;
  b.icon = "share";
  b.variant = "tonal";
  c.label = text.start;
  c.icon = "arrow_forward";
  return [
    { id: uid(), x: PHONE_MARGIN, y: 120, axis: "x", items: [a, b] },
    { id: uid(), x: PHONE_MARGIN, y: 200, axis: "x", items: [c] },
  ];
};

/** While the model works on a screen, the scheme's colors drift through its bezel. */
function ThinkingRing({ p, frame }: { p: Palette; frame: Frame }) {
  const still = useReducedMotion();
  const { w: frameW, h: frameH } = frameSizeOf(frame);
  const w = frameW + BEZEL * 2;
  const h = frameH + BEZEL * 2;
  const d = Math.ceil(Math.hypot(w, h)) + 80;
  const stops = [p.primary, p.tertiaryContainer, p.inversePrimary, p.secondaryContainer, p.primaryContainer, p.primary];
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <motion.div
        animate={still ? undefined : { rotate: 360 }}
        transition={{ repeat: Infinity, duration: 3.2, ease: "linear" }}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: d,
          height: d,
          marginLeft: -d / 2,
          marginTop: -d / 2,
          background: `conic-gradient(from 0deg, ${stops.join(", ")})`,
          filter: "blur(22px)",
        }}
      />
    </motion.div>
  );
}

type LeftTab = "parts" | "layers" | "color" | "shape" | "type" | "motion" | "ai";
/** the left rail: parts and layers, then the four theme axes of the whole design */
const LEFT_TABS: { key: LeftTab; icon: string; title: "parts" | "layers" | "colors" | "shape" | "typography" | "motion" | "ai" }[] = [
  { key: "parts", icon: "add_box", title: "parts" },
  { key: "layers", icon: "layers", title: "layers" },
  { key: "color", icon: "palette", title: "colors" },
  { key: "shape", icon: "rounded_corner", title: "shape" },
  { key: "type", icon: "text_fields", title: "typography" },
  { key: "motion", icon: "animation", title: "motion" },
  { key: "ai", icon: "auto_awesome", title: "ai" },
];

export default function Editor({ initialLang, onReady }: { initialLang: Lang; onReady?: () => void }) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  /* ---------- document ---------- */
  const [lang, setLang] = useState<Lang>(initialLang);
  const [editAccess, setEditAccess] = useState<"checking" | "editable" | "readonly">("checking");
  const [docState, setDocState] = useState<EditorDocState>(() => ({
    groups: seed(initialLang),
    frames: [{ ...SEED_FRAMES[0], name: t("home", initialLang) }],
    paletteKey: "purple",
    customPalette: null,
    dynamicColor: false,
    theme: DEFAULT_THEME,
    frame: "phone",
    title: "",
    brief: "",
    promptEdit: undefined,
    platform: null,
  }));
  const {
    groups,
    frames,
    paletteKey,
    customPalette,
    dynamicColor,
    theme,
    frame,
    title,
    brief,
    promptEdit,
    platform,
  } = docState;
  const patchDoc = useCallback((patch: Partial<EditorDocState>) => {
    setDocState((prev) => ({ ...prev, ...patch }));
  }, []);
  /* Enforce the standalone-modal rule for imports, grouping, undo and all edits. */
  const setGroups = useCallback((next: StateUpdate<Group[]>) => {
    setDocState((prev) => ({
      ...prev,
      groups: constrainModalRails(resolveStateUpdate(next, prev.groups)),
    }));
  }, []);
  const setFrames = useCallback((next: StateUpdate<Frame[]>) => {
    setDocState((prev) => ({ ...prev, frames: resolveStateUpdate(next, prev.frames) }));
  }, []);
  const setPaletteKey = (value: string) => patchDoc({ paletteKey: value });
  const setCustomPalette = (value: Palette | null) => patchDoc({ customPalette: value });
  const setDynamicColor = (value: boolean) => patchDoc({ dynamicColor: value });
  const setTheme = (value: Theme) => patchDoc({ theme: value });
  const patchTheme = (patch: Partial<Theme>) =>
    setDocState((prev) => ({ ...prev, theme: { ...prev.theme, ...patch } }));
  const setFrame = (value: FrameMode) => patchDoc({ frame: value });
  const changeLanguage = (next: Lang) => {
    setGlobalLang(next);
    initialLangRef.current = next;
    setLang(next);
    const translated = translateSnapshot({ groups: groupsRef.current, frames: framesRef.current }, next);
    const tidy = tidyRef.current;
    if (tidy) {
      tidyRef.current = tidy.after === groupsRef.current ? {
        ...tidy,
        before: translateSnapshot({ groups: tidy.before, frames: framesRef.current }, next).groups,
        after: translated.groups,
      } : null;
    }
    setGroups(translated.groups);
    setFrames(translated.frames);
    historyRef.current.past = historyRef.current.past.map((snap) => translateSnapshot(snap, next));
    historyRef.current.future = historyRef.current.future.map((snap) => translateSnapshot(snap, next));
  };
  const [isMobile, setIsMobile] = useState(false);
  const [sheet, setSheet] = useState<"edit" | "settings" | "lang" | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  /** frame being rendered offscreen for the PNG export */
  const [exportFrame, setExportFrame] = useState<Frame | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const setTitle = (value: string) => patchDoc({ title: value });
  const setBrief = (value: string) => patchDoc({ brief: value });
  const setPromptEdit = (value: string | undefined) => patchDoc({ promptEdit: value });
  /** the author's explicit target; null follows the screens (web once a desktop screen exists) */
  const setPlatform = (value: Platform | null) => patchDoc({ platform: value });
  /** a project file waiting for the author to confirm replacing the canvas */
  const [pendingImport, setPendingImport] = useState<Doc | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  /** the idea typed into the "ask an AI" dialog; kept here so a failed draft does not lose it */
  const [ideaText, setIdeaText] = useState("");
  /** the design a draft replaced, kept until the author keeps or undoes the draft */
  const [draftBefore, setDraftBeforeState] = useState<Doc | null>(null);
  /** true for the moment after a design arrives, so its colours ease over */
  const [revealing, setRevealing] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);
  const guideRef = useRef<string | null>(null);

  /* ---------- editor ui ---------- */
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 });
  /** Keep the server-rendered world hidden until its first fit has completed. */
  const [viewReady, setViewReady] = useState(false);
  /** screens ease to their new place and size for a moment after one changes size */
  const [easing, setEasing] = useState(false);
  /** the canvas transform eases while the camera glides to or from a screen */
  const [cameraEasing, setCameraEasing] = useState(false);
  const [mode, setMode] = useState<Mode>("select");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftW, setLeftW] = useState(RAIL_W + 268);
  const [leftTab, setLeftTab] = useState<LeftTab>("parts");
  /** pointer over the collapsed rail: the logo becomes the open button */
  const [railHover, setRailHover] = useState(false);
  /** the screen whose layers are listed when nothing on a screen is selected */
  const [layersFrameId, setLayersFrameId] = useState<string | null>(null);
  const [rightW, setRightW] = useState(320);
  const [rightTab, setRightTab] = useState<"edit" | "prompt">("edit");
  const [favorites, setFavorites] = useState<Kind[]>([]);
  const [selection, setSelection] = useState<SelectionState>({ kind: "none" });
  /* Selection modes are exclusive. These values are projections for existing
     consumers; the source of truth is the single discriminated state above. */
  const selectedIds = selection.kind === "items" ? selection.ids : [];
  const selectedFrameId = selection.kind === "frame" ? selection.id : null;
  const selectedLinkId = selection.kind === "link" ? selection.id : null;
  const setSelectedIds = (next: StateUpdate<string[]>) => {
    setSelection((prev) => {
      const current = prev.kind === "items" ? prev.ids : [];
      const ids = resolveStateUpdate(next, current);
      return ids.length ? { kind: "items", ids } : prev.kind === "items" ? { kind: "none" } : prev;
    });
  };
  const setSelectedFrameId = (id: string | null) => {
    setSelection((prev) => id ? { kind: "frame", id } : prev.kind === "frame" ? { kind: "none" } : prev);
  };
  const setSelectedLinkId = (id: string | null) => {
    setSelection((prev) => id ? { kind: "link", id } : prev.kind === "link" ? { kind: "none" } : prev);
  };
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<"left" | "right" | null>(null);
  const [, bumpHistory] = useState(0);
  /* ---------- tidy and ai ---------- */
  /** the groups before and after the last tidy; "undo" is offered only while the after-state is still current */
  const tidyRef = useRef<{ frameId: string; before: Group[]; after: Group[] } | null>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI);
  const [aiPending, startAiTransition] = useTransition();
  /** the screen the model is working on, which wears the animated ring meanwhile */
  const [aiFrameId, setAiFrameId] = useState<string | null>(null);
  const aiBusy = aiPending && aiFrameId !== null;
  /** the "applied" confirmation beside the tidy button */
  const [aiNote, setAiNote] = useState<{ text: string; icon: string } | null>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const aiNoteTimer = useRef<number | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const draftRef = useRef<{ before: Doc | null; abort: AbortController | null }>({ before: draftBefore, abort: null });

  const p = paletteOf(paletteKey, customPalette, theme);
  /* corner helpers read the shape scale outside React; keep it current before anything renders */
  setGlobalShape(theme.shape);

  const canvasRef = useRef<HTMLDivElement>(null);
  const measureEls = useRef<Map<string, HTMLElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const pendingRef = useRef<{ timer: number; commit: () => void } | null>(null);
  draftRef.current.before = draftBefore;
  const setDraftBefore = (before: Doc | null) => {
    draftRef.current.before = before;
    setDraftBeforeState(before);
  };
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const framesRef = useRef(frames);
  framesRef.current = frames;
  const widthsRef = useRef(widths);
  widthsRef.current = widths;
  const viewRef = useRef(view);
  viewRef.current = view;
  const previewIdRef = useRef(previewId);
  previewIdRef.current = previewId;
  const leftOpenRef = useRef(leftOpen);
  leftOpenRef.current = leftOpen;
  const leftWRef = useRef(leftW);
  leftWRef.current = leftW;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const spaceRef = useRef(spaceHeld);
  spaceRef.current = spaceHeld;
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const mobileRef = useRef(isMobile);
  mobileRef.current = isMobile;
  /** active touch points, for pinch zoom */
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    d0: number;
    z0: number;
    mx: number;
    my: number;
    vx: number;
    vy: number;
  } | null>(null);
  /** groups that must reposition without animating on the next render */
  const instantRef = useRef<Set<string>>(new Set());
  const loadedRef = useRef(false);
  const initialLangRef = useRef<Lang>(initialLang);
  /** A saved document or the first viewport initialization prevents later reseeding. */
  const hadDocRef = useRef(false);

  /* ---------- history ---------- */
  const historyRef = useRef<{
    past: Snapshot[];
    future: Snapshot[];
    lastPatch: { key: string; at: number };
  }>({ past: [], future: [], lastPatch: { key: "", at: 0 } });

  const snapshot = useCallback((withMeta = false) => {
    setQuickUndo(false);
    historyRef.current.past.push(current(withMeta));
    if (historyRef.current.past.length > HISTORY_MAX) historyRef.current.past.shift();
    historyRef.current.future = [];
    bumpHistory((v) => v + 1);
  }, []);

  /** consecutive edits of the same field collapse into one undo step */
  const snapshotFor = useCallback(
    (key: string) => {
      const now = Date.now();
      const last = historyRef.current.lastPatch;
      if (last.key !== key || now - last.at > 800) snapshot();
      historyRef.current.lastPatch = { key, at: now };
    },
    [snapshot],
  );

  const restore = (snap: Snapshot) => {
    for (const g of snap.groups) instantRef.current.add(g.id);
    if (snap.meta) {
      applyDoc({ ...snap.meta, groups: snap.groups, frames: snap.frames }, true);
      if (!mobileRef.current) {
        const mode = snap.meta.frame === "blank" ? "blank" : "phone";
        setFrame(mode);
        frameRef.current = mode;
      }
    } else {
      setGroups(snap.groups);
      setFrames(snap.frames);
    }
    bumpHistory((v) => v + 1);
  };

  /** the current step as a snapshot; `withMeta` when the step being crossed replaced the whole document */
  const current = (withMeta: boolean): Snapshot => {
    const { groups: _g, frames: _f, ...meta } = docRef.current;
    return { groups: groupsRef.current, frames: framesRef.current, meta: withMeta ? meta : undefined };
  };

  const undo = useCallback(() => {
    setQuickUndo(false);
    const prev = historyRef.current.past.pop();
    if (!prev) return;
    historyRef.current.future.push(current(!!prev.meta));
    restore(prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redo = useCallback(() => {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(current(!!next.meta));
    restore(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    instantRef.current.clear();
  });

  /* ---------- persistence ---------- */
  useEffect(() => {
    /* The first tab keeps this promise pending for its lifetime. Later tabs get
       `null` immediately and stay read-only until they are reloaded. Where the
       browser has no locks (an insecure origin, an old WebKit) the editor works
       as it always did, without the guard. */
    if (!navigator.locks) {
      setEditAccess("editable");
      return;
    }
    let active = true;
    let releaseLock: (() => void) | undefined;
    /* Wait until React has finished its development-only effect replay. This
       prevents the discarded setup from briefly competing with the real one. */
    queueMicrotask(() => {
      if (!active) return;
      void navigator.locks
        .request(DOC_LOCK, { ifAvailable: true }, async (lock) => {
          if (!active) return;
          if (!lock) {
            setEditAccess("readonly");
            return;
          }
          setEditAccess("editable");
          await new Promise<void>((resolve) => {
            releaseLock = resolve;
          });
        })
        .catch(() => {
          if (active) setEditAccess("editable");
        });
    });
    return () => {
      active = false;
      releaseLock?.();
    };
  }, []);

  /** Puts a stored or opened document into the editor. Fields a partial document
   *  leaves out keep their current value, or go back to the default when `reset`. */
  const applyDoc = (doc: Partial<Doc>, reset: boolean) => {
    // A document can arrive during the opening glide, before previewId is set. The
    // screen the glide was heading for belongs to the replaced document, so the pending
    // opening is dropped and the camera returns; an open preview simply closes.
    if (previewTimer.current !== null) abandonPreview();
    else {
      /* a return still on its way would drag the camera off the new document's fit */
      cancelReturn();
      if (previewIdRef.current !== null) {
        setPreviewId(null);
        viewBeforePreview.current = null;
      }
    }
    const frames = Array.isArray(doc.frames) ? doc.frames : framesRef.current;
    if (Array.isArray(doc.groups)) setGroups(migrateGroups(doc.groups, frames));
    if (Array.isArray(doc.frames)) setFrames(doc.frames);
    if (typeof doc.paletteKey === "string" && doc.paletteKey) setPaletteKey(doc.paletteKey);
    else if (reset) setPaletteKey("purple");
    /* normalize once so a scheme saved before the secondary role gets it and keeps it on re-save */
    if (doc.customPalette && typeof doc.customPalette.primary === "string") setCustomPalette(paletteOf("custom", doc.customPalette));
    else if (reset) setCustomPalette(null);
    if (typeof doc.dynamicColor === "boolean") setDynamicColor(doc.dynamicColor);
    else if (reset) setDynamicColor(false);
    if (doc.theme && typeof doc.theme === "object") setTheme(normalizeTheme(doc.theme));
    else if (reset) setTheme(normalizeTheme(undefined));
    if (typeof doc.title === "string") setTitle(doc.title);
    else if (reset) setTitle("");
    if (typeof doc.brief === "string") setBrief(doc.brief);
    else if (reset) setBrief("");
    if (typeof doc.promptEdit === "string") setPromptEdit(doc.promptEdit);
    else if (reset) setPromptEdit(undefined);
    if (isPlatform(doc.platform)) setPlatform(doc.platform);
    else if (reset) setPlatform(null);
  };

  useEffect(() => {
    // React's development double-run would otherwise read back its own first save
    if (loadedRef.current) return;
    try {
      const d = localStorage.getItem(DOC_KEY);
      if (d) {
        hadDocRef.current = true;
        applyDoc(JSON.parse(d) as Partial<Doc>, false);
        // frame mode is decided by the device (media-query effect), not restored
      }
      const before = d ? localStorage.getItem(BEFORE_KEY) : null;
      if (!d) localStorage.removeItem(BEFORE_KEY);
      if (before) {
        const value: unknown = JSON.parse(before);
        if (isProject(value)) setDraftBefore(value);
        else localStorage.removeItem(BEFORE_KEY);
      }
      const u = localStorage.getItem(UI_KEY);
      if (u) {
        const ui = JSON.parse(u);
        if (ui.view) setView(ui.view);
        if (typeof ui.leftOpen === "boolean") setLeftOpen(ui.leftOpen);
        if (typeof ui.rightOpen === "boolean") setRightOpen(ui.rightOpen);
        if (ui.leftW) setLeftW(Math.max(RAIL_W + 244, ui.leftW));
        if (ui.rightW) setRightW(ui.rightW);
        if (Array.isArray(ui.favorites)) setFavorites(ui.favorites);
        if (ui.mode) setMode(ui.mode);
      } else {
        queueMicrotask(() => fitRef.current());
      }
      setGlobalLang(initialLang);
      initialLangRef.current = initialLang;
      if (!d) {
        setGroups(seed(initialLang));
        setFrames([{ ...SEED_FRAMES[0], name: t("home", initialLang) }]);
      }
    } catch {}
    setAiSettings(loadAiSettings());
    loadedRef.current = true;
    /* the document is in state; one frame later it is on screen and the boot overlay may go.
       Not cancelled on cleanup: the development double-run skips this effect the second time. */
    requestAnimationFrame(() => onReadyRef.current?.());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    /* the editor's own text and the parts both pick up the language's Noto face */
    document.body.style.fontFamily = uiFontFamily(lang);
    ensureLangFontLoaded(lang, () => setWidths({}));
  }, [lang]);

  useEffect(() => {
    /* an empty width map makes every measured part read its width again in the new face */
    ensureFontLoaded(theme.font, () => setWidths({}));
  }, [theme.font]);

  /* the page background outside the app root follows the scheme, so dark mode has no white edges */
  useEffect(() => {
    document.body.style.background = p.surface;
    document.body.style.color = p.onSurface;
  }, [p.surface, p.onSurface]);

  /* in-app browsers size the page behind their own toolbars and may ignore dvh,
     so the measured inner height wins over the CSS height (innerHeight, not the
     visual viewport, so pinch-zoom and the keyboard leave the layout alone) */
  useEffect(() => {
    const apply = () => {
      const h = Math.round(window.innerHeight);
      if (h > 0) document.documentElement.style.setProperty("--app-h", `${h}px`);
    };
    /* in-app browsers (X, Instagram, LINE...) keep their own action bar over the
       page bottom, so the controls sit one button higher there. App names in the
       user agent are unreliable; the embedded web view itself is not: iOS web
       views omit the Safari token and Android ones carry "wv" */
    const ua = navigator.userAgent;
    const iosWebView = /iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua);
    const androidWebView = /Android/.test(ua) && /(?:^|\W)wv(?:\W|$)/.test(ua);
    if (iosWebView || androidWebView || /Twitter|Instagram|FBAN|FBAV|Line\//i.test(ua)) {
      document.documentElement.style.setProperty("--bottom-ui", "64px");
    }
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  /* everyone works on phone screens; a phone gets one fixed screen and the select tool only */
  useEffect(() => {
    const mq = window.matchMedia(
      "(max-width: 840px), (pointer: coarse) and (max-width: 1024px)",
    );
    const apply = () => {
      const m = mq.matches;
      setIsMobile(m);
      mobileRef.current = m;
      if (m) {
        setMode("select");
        setSheet(null);
        if (!hadDocRef.current) {
          hadDocRef.current = true;
          setGroups(mobileSeed(initialLangRef.current));
          setFrames([{ id: uid(), name: t("home", initialLangRef.current), x: 0, y: 0 }]);
        }
      }
      hadDocRef.current = true;
      if (frameRef.current !== "phone") {
        setFrame("phone");
        frameRef.current = "phone";
      }
      ensureFrameRef.current();
      queueMicrotask(() => {
        fitRef.current();
        setViewReady(true);
      });
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!loadedRef.current || editAccess !== "editable") return;
    try {
      localStorage.setItem(
        DOC_KEY,
        JSON.stringify({ groups, frames, paletteKey, frame, title, brief, promptEdit, platform: platform ?? undefined, customPalette: customPalette ?? undefined, dynamicColor, theme }),
      );
    } catch {}
  }, [editAccess, groups, frames, paletteKey, frame, title, brief, promptEdit, platform, customPalette, dynamicColor, theme]);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({
          view,
          leftOpen,
          rightOpen,
          leftW,
          rightW,
          favorites,
          mode,
          lang,
        }),
      );
    } catch {}
  }, [
    view,
    leftOpen,
    rightOpen,
    leftW,
    rightW,
    favorites,
    mode,
    lang,
  ]);

  /* ---------- measurement (text-sized kinds) ---------- */
  const allItems = useMemo(() => {
    const map = new Map<string, Item>();
    for (const g of groups) for (const it of g.items) map.set(it.id, it);
    if (drag) map.set(drag.item.id, drag.item);
    return [...map.values()];
  }, [groups, drag]);

  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    measureEls.current.forEach((el, id) => {
      next[id] = Math.ceil(el.getBoundingClientRect().width);
    });
    const keys = Object.keys(next);
    const changed =
      keys.length !== Object.keys(widthsRef.current).length ||
      keys.some((k) => widthsRef.current[k] !== next[k]);
    if (changed) setWidths(next);
  });

  useEffect(() => {
    const refreshWidths = () => setWidths({});
    document.fonts?.ready.then(refreshWidths);
    document.fonts?.addEventListener("loadingdone", refreshWidths);
    return () => document.fonts?.removeEventListener("loadingdone", refreshWidths);
  }, []);

  const sizeRef = useCallback((it: Item) => sizeOf(it, widthsRef.current), []);
  const alongRef = useCallback(
    (it: Item, axis: Axis) => (axis === "x" ? sizeRef(it).w : sizeRef(it).h),
    [sizeRef],
  );
  const prefixOf = useCallback(
    (g: Group, k: number) =>
      g.items.slice(0, k).reduce((s, it) => s + alongRef(it, g.axis) + GAP, 0),
    [alongRef],
  );

  /* ---------- coordinates ---------- */
  const canvasRect = () => canvasRef.current?.getBoundingClientRect();
  const toWorld = (clientX: number, clientY: number) => {
    const r = canvasRect();
    const v = viewRef.current;
    return {
      x: (clientX - (r?.left ?? 0) - v.x) / v.z,
      y: (clientY - (r?.top ?? 0) - v.y) / v.z,
    };
  };
  /* only the open left panel accepts a drop for deletion; the narrow rail never does */
  const inBin = (clientX: number) =>
    !mobileRef.current && leftOpenRef.current && clientX >= 0 && clientX <= leftWRef.current;

  const setZoomAt = useCallback((nz: number, cx?: number, cy?: number) => {
    const r = canvasRect();
    const v = viewRef.current;
    const z = clamp(nz, MIN_Z, MAX_Z);
    const px = cx === undefined ? (r?.width ?? 0) / 2 : cx - (r?.left ?? 0);
    const py = cy === undefined ? (r?.height ?? 0) / 2 : cy - (r?.top ?? 0);
    setView({
      x: px - ((px - v.x) * z) / v.z,
      y: py - ((py - v.y) * z) / v.z,
      z,
    });
  }, []);

  const fit = useCallback(() => {
    const r = canvasRect();
    if (!r) return;
    const gs = groupsRef.current;
    let x0 = -BEZEL;
    let y0 = -BEZEL - FRAME_LABEL_H;
    let x1 = PHONE_W + BEZEL;
    let y1 = PHONE_H + BEZEL;
    const fs = framesRef.current;
    if (frameRef.current === "phone" && fs.length > 0) {
      x0 = Math.min(...fs.map((f) => f.x)) - BEZEL;
      y0 = Math.min(...fs.map((f) => f.y)) - BEZEL - FRAME_LABEL_H;
      x1 = Math.max(...fs.map((f) => frameRect(f).r)) + BEZEL;
      y1 = Math.max(...fs.map((f) => frameRect(f).b)) + BEZEL;
    }
    if (frameRef.current === "blank") {
      if (gs.length === 0) {
        setView({ x: 48, y: 48, z: 1 });
        return;
      }
      x0 = Infinity;
      y0 = Infinity;
      x1 = -Infinity;
      y1 = -Infinity;
      for (const g of gs) {
        for (const pl of layoutOf(g, widthsRef.current)) {
          x0 = Math.min(x0, pl.x);
          y0 = Math.min(y0, pl.y);
          x1 = Math.max(x1, pl.x + pl.w);
          y1 = Math.max(y1, pl.y + pl.h);
        }
      }
    }
    const mobile = mobileRef.current;
    const pad = mobile ? 14 : 40;
    const top = mobile ? 96 : 84; // keep the floating toolbar clear of the frame
    const bottom = mobile ? 96 : pad;
    if (mobile) {
      // a phone zooms to the screen's width and starts at its top; the rest scrolls
      const z = clamp((r.width - pad * 2) / (x1 - x0), MIN_Z, MAX_Z);
      setView({ x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: top - y0 * z, z });
      return;
    }
    const z = clamp(
      Math.min(
        (r.width - pad * 2) / (x1 - x0),
        (r.height - top - bottom) / (y1 - y0),
        1,
      ),
      MIN_Z,
      MAX_Z,
    );
    setView({
      x: (r.width - (x1 - x0) * z) / 2 - x0 * z,
      y: top + (r.height - top - bottom - (y1 - y0) * z) / 2 - y0 * z,
      z,
    });
  }, []);
  const fitRef = useRef(fit);
  fitRef.current = fit;

  /* touch: two fingers pinch-zoom and pan, cancelling whatever one finger started */
  const onTouchCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchesRef.current.size === 2) {
      const [a, b] = [...touchesRef.current.values()];
      const v = viewRef.current;
      pinchRef.current = {
        d0: Math.hypot(a.x - b.x, a.y - b.y),
        z0: v.z,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        vx: v.x,
        vy: v.y,
      };
      dragRef.current = null;
      setDrag(null);
      gestureRef.current = null;
      setGesture(null);
    }
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !touchesRef.current.has(e.pointerId))
        return;
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pinch = pinchRef.current;
      if (!pinch || touchesRef.current.size < 2) return;
      const [a, b] = [...touchesRef.current.values()];
      const r = canvasRef.current?.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const z = clamp((pinch.z0 * d) / Math.max(1, pinch.d0), MIN_Z, MAX_Z);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const px = pinch.mx - (r?.left ?? 0);
      const py = pinch.my - (r?.top ?? 0);
      setView({
        x: px - ((px - pinch.vx) * z) / pinch.z0 + (mx - pinch.mx),
        y: py - ((py - pinch.vy) * z) / pinch.z0 + (my - pinch.my),
        z,
      });
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touchesRef.current.delete(e.pointerId);
      if (touchesRef.current.size <…20766 tokens truncated…             key="__gap"
                initial={g.axis === "x" ? { width: 0 } : { height: 0 }}
                animate={
                  g.axis === "x" ? { width: phMain } : { height: phMain }
                }
                transition={OPEN}
                style={{
                  flex: "0 0 auto",
                  height: g.axis === "x" ? dragSize.h : undefined,
                  width: g.axis === "y" ? dragSize.w : undefined,
                }}
              />
            );
          }
          const ic = connectSpecOf(c.item);
          const radii =
            conn && ic
              ? runRadii(
                  g.axis,
                  r === 0,
                  r === m - 1,
                  r > 0 && cells[r - 1].ph,
                  r < m - 1 && cells[r + 1].ph,
                  pull,
                  ic.outer,
                  ic.inner,
                )
              : baseRadii(c.item);
          return (
            <M3Node
              key={c.item.id}
              item={c.item}
              palette={p}
              widths={widths}
              radii={radii}
              pressed={pressedId === c.item.id}
              selected={selectedSet.has(c.item.id)}
              inRun={g.items.length > 1}
              interactive={!handMode}
              onPointerDown={(e) => onItemPointerDown(e, g, c.index, c.item)}
            />
          );
        })}
      </motion.div>
    );
  };

  const handMode = !isMobile && (mode === "hand" || spaceHeld);
  const panning = gesture?.kind === "pan";
  const marquee = gesture?.kind === "marquee" && gesture.moved ? gesture : null;
  const canvasBg = frame === "phone" ? p.surfaceContainerLow : "#ffffff";

  const panelStyle: React.CSSProperties = {
    background: p.surface,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
    flex: "0 0 auto",
  };

  const showRight = rightOpen && !isMobile;
  const overBin = (!!drag?.active && drag.overBin) || (gesture?.kind === "group" && gesture.overBin);
  const guide = drag?.active ? drag.guide : gesture?.kind === "group" && gesture.moved ? (gesture.guide ?? null) : null;
  const visibleWorld = (() => {
    const r = canvasRef.current?.getBoundingClientRect();
    return {
      l: -view.x / view.z,
      t: -view.y / view.z,
      w: (r?.width ?? 0) / view.z,
      h: (r?.height ?? 0) / view.z,
    };
  })();

  return (
    <LangContext.Provider value={lang}>
    <ThemeContext.Provider value={theme}>
      <div
        className={revealing ? "app-root m3e-reveal" : "app-root"}
        /* the preview sits outside this tree and owns the keyboard while it is up */
        inert={editAccess !== "editable" || previewId !== null}
        aria-hidden={editAccess !== "editable" || previewId !== null}
        style={{
          display: "flex",
          overflow: "hidden",
          background: p.surfaceContainer,
          cursor: resizing ? "col-resize" : undefined,
          userSelect: resizing ? "none" : undefined,
          ["--sb" as string]: p.outlineVariant,
        }}
      >
        {/* hidden measuring layer for text-sized kinds */}
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: -99999,
            top: 0,
            visibility: "hidden",
            pointerEvents: "none",
            fontFamily: fontFamilyOf(theme.font, lang),
          }}
        >
          {allItems
            .filter((it) => MEASURED.includes(it.kind))
            .map((it) => (
              <div
                key={it.id}
                ref={(el) => {
                  if (el) measureEls.current.set(it.id, el);
                  else measureEls.current.delete(it.id);
                }}
                style={{
                  display: "inline-flex",
                  boxSizing: "border-box",
                  border:
                    it.variant === "outlined" &&
                    (it.kind === "button" ||
                      it.kind === "chip" ||
                      it.kind === "extendedFab")
                      ? "1px solid transparent"
                      : "none",
                }}
              >
                <MeasuredContent item={it} p={p} />
              </div>
            ))}
        </div>

        {exportFrame && (
          <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none", fontFamily: fontFamilyOf(theme.font, lang) }}>
            {renderExport(exportFrame)}
          </div>
        )}


        {/* the part in flight rides above every panel so it stays visible while crossing them */}
        {drag?.active && (() => {
          const r = canvasRect();
          return (
            <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  transform: `translate(${(r?.left ?? 0) + view.x}px, ${(r?.top ?? 0) + view.y}px) scale(${view.z})`,
                  transformOrigin: "0 0",
                  fontFamily: fontFamilyOf(theme.font, lang),
                }}
              >
      {/* the part in flight */}
      {drag?.active && (
        <motion.div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            x: sx,
            y: sy,
            pointerEvents: "none",
            zIndex: 50,
          }}
          animate={{
            opacity: drag.overBin ? 0.4 : 1,
            scale: drag.overBin ? 0.84 : 1,
          }}
          transition={{
            type: "spring",
            stiffness: 520,
            damping: 34,
            mass: 0.6,
          }}
        >
          <M3Node
            item={drag.item}
            palette={p}
            widths={widths}
            dragging
            radii={(() => {
              const conn = connectSpecOf(drag.item);
              if (!conn || !drag.snap) return baseRadii(drag.item);
              const g = groupsRef.current.find(
                (x) => x.id === drag.snap!.groupId,
              );
              const mm = (g?.items.length ?? 0) + 1;
              const k = drag.snap.index;
              return runRadii(
                conn.axis,
                k === 0,
                k === mm - 1,
                k > 0,
                k < mm - 1,
                drag.snap.pull,
                conn.outer,
                conn.inner,
              );
            })()}
          />
        </motion.div>
      )}
              </div>
            </div>
          );
        })()}

        {/* ---- left: rail + parts / layers ---- */}
        {!isMobile && (
          <aside style={{ ...panelStyle, width: leftOpen ? leftW : RAIL_W, flexDirection: "row", transition: "width 200ms cubic-bezier(0.2, 0, 0, 1)" }}>
            {/* dropping a canvas part anywhere on this side deletes it, whichever tab is open */}
            {overBin && (
              <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "rgba(179,38,30,0.10)", display: "grid", placeItems: "center", pointerEvents: "none", color: p.error }}>
                <div style={{ width: 72, height: 72, borderRadius: 36, background: p.errorContainer, color: p.onErrorContainer, display: "grid", placeItems: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.14)" }}>
                  <Icon name="delete" size={34} />
                </div>
              </div>
            )}
            <div
              onPointerEnter={() => setRailHover(true)}
              onPointerLeave={() => setRailHover(false)}
              onClick={(e) => {
                // a click on the rail's empty background opens the panel
                if (!leftOpen && e.target === e.currentTarget) setLeftOpen(true);
              }}
              style={{
                width: RAIL_W,
                flex: "0 0 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "10px 0",
                background: p.surfaceContainerLow,
                cursor: leftOpen ? undefined : "pointer",
              }}
            >
              {!leftOpen && railHover ? (
                <IconBtn icon="left_panel_open" p={p} on onClick={() => setLeftOpen(true)} title={t("openPanel", lang)} size={40} />
              ) : (
                <div
                  onClick={() => !leftOpen && setLeftOpen(true)}
                  style={{ width: 40, height: 40, display: "grid", placeItems: "center", cursor: leftOpen ? "default" : "pointer" }}
                >
                  <Logo size={32} color={p.primary} glyph={p.onPrimary} />
                </div>
              )}
              <div style={{ height: 6 }} />
              {LEFT_TABS.map((tab, i) => (
                <div key={tab.key} style={{ marginTop: i === 2 || i === 6 ? 10 : 0 }}>
                  <IconBtn
                    icon={tab.icon}
                    p={p}
                    on={leftOpen && leftTab === tab.key}
                    onClick={() => {
                      setLeftTab(tab.key);
                      setLeftOpen(true);
                    }}
                    title={t(tab.title, lang)}
                    size={44}
                  />
                </div>
              ))}
              <div style={{ flex: 1 }} onClick={() => !leftOpen && setLeftOpen(true)} />
              <LangMenu p={p} onLang={changeLanguage} side="right" size={44} />
              <GitHubLink p={p} size={44} />
            </div>
            {leftOpen && (
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 10px 0 14px",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: p.onSurface,
                    flex: 1,
                  }}
                >
                  {t(LEFT_TABS.find((x) => x.key === leftTab)?.title ?? "parts", lang)}
                </span>
                <IconBtn
                  icon="left_panel_close"
                  p={p}
                  onClick={() => setLeftOpen(false)}
                  title={t("closePanel", lang)}
                />
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {leftTab === "parts" ? (
                  <PartsPalette
                    palette={p}
                    favorites={favorites}
                    onToggleFavorite={(k) =>
                      setFavorites((f) =>
                        f.includes(k) ? f.filter((x) => x !== k) : [...f, k],
                      )
                    }
                    onPartPointerDown={onPartPointerDown}
                  />
                ) : leftTab === "color" ? (
                  <ColorPanel
                    p={p}
                    paletteKey={paletteKey}
                    onPalette={setPaletteKey}
                    custom={customPalette}
                    onCustom={setCustomPalette}
                    dynamic={dynamicColor}
                    onDynamic={setDynamicColor}
                    theme={theme}
                    onTheme={patchTheme}
                  />
                ) : leftTab === "shape" ? (
                  <ShapePanel p={p} theme={theme} onChange={patchTheme} />
                ) : leftTab === "type" ? (
                  <TypePanel p={p} theme={theme} onChange={patchTheme} />
                ) : leftTab === "motion" ? (
                  <MotionPanel p={p} theme={theme} onChange={patchTheme} />
                ) : leftTab === "ai" ? (
                  <AiPanel p={p} settings={aiSettings} onSettings={updateAiSettings} />
                ) : (
                  <LayersPanel
                    p={p}
                    frames={frames}
                    frameId={layersFrame?.id ?? null}
                    onFrame={(id) => {
                      setLayersFrameId(id);
                      setSelectedIds([]);
                      setSelectedFrameId(id);
                    }}
                    groups={layerGroups}
                    widths={widths}
                    selectedIds={selectedIds}
                    onSelect={(ids, add) => {
                      setSelectedIds((cur) => (add ? [...cur.filter((x) => !ids.includes(x)), ...ids] : ids));
                      setSelectedFrameId(null);
                      setSelectedLinkId(null);
                      setRightTab("edit");
                    }}
                    onReorder={reorderLayers}
                    onToggleLock={toggleGroupLock}
                    onReorderItems={reorderGroupItems}
                    onDragging={onLayerDragging}
                  />
                )}
              </div>
            </div>
            )}
            {leftOpen && (
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setResizing("left");
              }}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                right: -3,
                width: 6,
                cursor: "col-resize",
                zIndex: 5,
              }}
            />
            )}
          </aside>
        )}

        {/* ---- canvas ---- */}
        <main
          style={{
            flex: 1,
            position: "relative",
            minWidth: 0,
            padding: isMobile ? 6 : 8,
          }}
        >
          <div
            ref={canvasRef}
            onPointerDown={onCanvasPointerDown}
            onPointerDownCapture={onTouchCapture}
            style={{
              position: "absolute",
              inset: isMobile ? 6 : 8,
              overflow: "hidden",
              borderRadius: 24,
              background: canvasBg,
              cursor: panning ? "grabbing" : handMode ? "grab" : "default",
              touchAction: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
                transformOrigin: "0 0",
                transition: cameraEasing ? `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)` : undefined,
                willChange: "transform",
                visibility: viewReady ? "visible" : "hidden",
                fontFamily: fontFamilyOf(theme.font, lang),
              }}
            >
              {frame === "phone" &&
                frames.map((f) => {
                  const on = f.id === selectedFrameId;
                  const bg = p[f.bg ?? "surface"];
                  const { w, h } = frameSizeOf(f);
                  const radius = frameRadius(f);
                  return (
                    <div
                      key={f.id}
                      data-frame={f.id}
                      style={{ position: "absolute", left: f.x, top: f.y, transition: easing ? `left ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)` : undefined }}
                    >
                      <div
                        onPointerDown={(e) => onFramePointerDown(e, f)}
                        style={{
                          position: "absolute",
                          left: -BEZEL,
                          top: -BEZEL - FRAME_LABEL_H,
                          height: FRAME_LABEL_H,
                          /* follows the zoom, softened: a little larger when zoomed out, a little smaller when zoomed in */
                          transform: `scale(${clamp(1 / view.z, 0.7, 1.4)})`,
                          transformOrigin: "left bottom",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "0 8px",
                          fontSize: 20,
                          fontWeight: 600,
                          color: on ? p.primary : p.onSurfaceVariant,
                          cursor: handMode ? "grab" : "move",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                          fontFamily: uiFontFamily(lang),
                        }}
                      >
                        <div onPointerDown={(e) => e.stopPropagation()}>
                          <FrameSizePicker frame={f} onChange={(preset) => setFramePreset(f.id, preset)} palette={p} compact />
                        </div>
                        {f.name || t("screen", lang)}
                      </div>
                      <div
                        onPointerDown={(e) => onFramePointerDown(e, f)}
                        style={{
                          position: "absolute",
                          left: -BEZEL,
                          top: -BEZEL,
                          overflow: "hidden",
                          width: w + BEZEL * 2,
                          height: h + BEZEL * 2,
                          borderRadius: radius + BEZEL,
                          backgroundColor: p.inverseSurface,
                          backgroundImage: draftBusy ? DRAFT_GRADIENT(p) : undefined,
                          backgroundSize: draftBusy ? "300% 300%" : undefined,
                          animation: draftBusy ? "m3e-drift 3s ease-in-out infinite" : undefined,
                          boxShadow: on
                            ? `0 0 0 3px ${p.primary}, 0 18px 50px rgba(0,0,0,0.16)`
                            : "0 18px 50px rgba(0,0,0,0.14)",
                          cursor: handMode ? "grab" : "move",
                          transition: `box-shadow 120ms, ${SIZE_TRANSITION}`,
                        }}
                      >
                        <AnimatePresence>{aiFrameId === f.id && <ThinkingRing key="ring" p={p} frame={f} />}</AnimatePresence>
                        <div
                          data-screen={f.id}
                          style={{
                            position: "absolute",
                            left: BEZEL,
                            top: BEZEL,
                            width: w,
                            height: h,
                            borderRadius: radius,
                            background: bg,
                            overflow: "hidden",
                            transition: SIZE_TRANSITION,
                          }}
                        >
                          {groups
                            .filter((g) => frameOf.get(g.id) === f.id)
                            .map((g) => renderGroup(g, f.x, f.y))}
                          {groups.some((g) => frameOf.get(g.id) === f.id && modalRailOf(g)) && (
                            <div aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)", pointerEvents: "none", zIndex: 1 }} />
                          )}
                          {draftBusy && (
                            <div style={{ position: "absolute", inset: 0, zIndex: 90, background: canvasBg, display: "grid", placeItems: "center" }}>
                              <LoadingIndicator size={96} color="url(#m3e-drafting)" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {groups
                .filter((g) => !frameOf.has(g.id))
                .map((g) => renderGroup(g, 0, 0))}


              {links.length > 0 && (
                <svg
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    overflow: "visible",
                    pointerEvents: "none",
                  }}
                  width={1}
                  height={1}
                >
                  <defs>
                    <marker
                      id="m3e-arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="8"
                      markerHeight="8"
                      orient="auto"
                    >
                      <path d="M0 0 L10 5 L0 10 z" fill={p.primary} />
                    </marker>
                  </defs>
                  {!draftBusy && links.map((l) => {
                    const on = l.id === selectedLinkId;
                    return (
                      <g key={l.id}>
                        <path
                          d={l.d}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={18 / view.z}
                          style={{ pointerEvents: "stroke", cursor: "pointer" }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setSelectedLinkId(l.id);
                            setSelectedIds([]);
                            setSelectedFrameId(null);
                          }}
                        />
                        <path
                          d={l.d}
                          fill="none"
                          stroke={p.primary}
                          strokeWidth={on ? 3 : 2}
                          strokeDasharray={on ? undefined : "6 6"}
                          strokeLinecap="round"
                          markerEnd="url(#m3e-arrow)"
                          opacity={on ? 1 : 0.7}
                        />
                      </g>
                    );
                  })}
                </svg>
              )}

              {links
                .filter((l) => l.id === selectedLinkId)
                .map((l) => (
                  <div
                    key={l.id}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      left: l.mx,
                      top: l.my,
                      transform: `translate(-50%, 14px) scale(${1 / view.z})`,
                      transformOrigin: "50% 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: 6,
                      borderRadius: 26,
                      background: p.surfaceContainerLow,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
                      zIndex: 60,
                    }}
                  >
                    <Segmented<Transition>
                      options={TRANSITIONS.map((t) => ({
                        key: t.key,
                        icon: t.icon,
                        title: t.label,
                      }))}
                      value={l.t}
                      onChange={(t) => setLinkTransition(l.id, t)}
                      p={p}
                      height={36}
                      grow={false}
                    />
                    <IconBtn
                      icon="link_off"
                      p={p}
                      danger
                      onClick={() => removeLink(l.id)}
                      title={t("removeLink", lang)}
                      size={36}
                    />
                  </div>
                ))}

              {guide?.gx !== undefined && (
                <div
                  style={{
                    position: "absolute",
                    left: guide.gx,
                    top: visibleWorld.t,
                    width: 1.5 / view.z,
                    height: visibleWorld.h,
                    background: p.primary,
                    pointerEvents: "none",
                  }}
                />
              )}
              {guide?.gy !== undefined && (
                <div
                  style={{
                    position: "absolute",
                    top: guide.gy,
                    left: visibleWorld.l,
                    height: 1.5 / view.z,
                    width: visibleWorld.w,
                    background: p.primary,
                    pointerEvents: "none",
                  }}
                />
              )}

              {marquee && (
                <div
                  style={{
                    position: "absolute",
                    left: Math.min(marquee.x0, marquee.x1),
                    top: Math.min(marquee.y0, marquee.y1),
                    width: Math.abs(marquee.x1 - marquee.x0),
                    height: Math.abs(marquee.y1 - marquee.y0),
                    border: `${1 / view.z}px solid ${p.primary}`,
                    background: `${p.primary}14`,
                    borderRadius: 4 / view.z,
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>
          </div>

          {draftBusy && (
            <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
              <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
                <defs>
                  <linearGradient id="m3e-drafting" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={p.primary} />
                    <stop offset="50%" stopColor={p.tertiaryContainer} />
                    <stop offset="100%" stopColor={p.primaryContainer} />
                    <animateTransform attributeName="gradientTransform" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="3s" repeatCount="indefinite" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          )}
          <Toolbar
            p={p}
            mode={mode}
            onMode={setMode}
            frame={frame}
            onFrame={changeFrame}
            zoom={view.z}
            onZoom={(z) => setZoomAt(z)}
            onFit={fit}
            canUndo={historyRef.current.past.length > 0}
            canRedo={historyRef.current.future.length > 0}
            onUndo={undo}
            onRedo={redo}
            onClear={() => {
              if (groupsRef.current.length || framesRef.current.length) setConfirmClear(true);
            }}
            onAddFrame={addFrame}
            onPreview={() => openPreview()}
            tidy={selectedIds.length > 1 ? undefined : tidyState ?? undefined}
            onTidy={tidyTarget ? () => tidy(tidyTarget) : undefined}
            place={tidyTarget?.place}
            onPlace={tidyTarget ? (pl) => setPlace(tidyTarget, pl) : undefined}
            note={aiNote}
            onSaveProject={() => saveProject(doc)}
            onOpenProject={() => projectFileRef.current?.click()}
            onShare={!isMobile ? () => setShareOpen(true) : undefined}
            shareState={draftBusy ? "busy" : draftBefore ? "review" : "idle"}
            onDraftKeep={keepDraft}
            onDraftUndo={undoDraft}
            onDraftSave={() => saveProject(doc)}
            quickUndo={quickUndo}
            rightInset={showRight ? rightW : 0}
            mobile={isMobile}
            onSettings={() => setSheet(sheet === "settings" ? null : "settings")}
            onLangSheet={() => setSheet(sheet === "lang" ? null : "lang")}
            onPrompt={async () => {
              try {
                await navigator.clipboard.writeText(effectivePrompt(doc, widths, lang));
                showToast(t("copied", lang), 1400, "check");
              } catch {}
            }}
          />

          {isMobile && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 80,
                textAlign: "center",
                fontSize: 11,
                lineHeight: 1.4,
                color: p.onSurfaceVariant,
                pointerEvents: "none",
                zIndex: 40,
              }}
            >
              {t("mobileNote", lang)}
            </div>
          )}

          {isMobile && sheet === null && (
            <button
              onClick={addButton}
              title={t("addButton", lang)}
              aria-label={t("addButton", lang)}
              className="m3-press"
              style={{
                position: "absolute",
                right: 16,
                bottom: "calc(16px + var(--bottom-ui, 0px) + env(safe-area-inset-bottom))",
                width: 64,
                height: 64,
                borderRadius: 20,
                border: "none",
                background: p.primary,
                color: p.onPrimary,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                zIndex: 46,
                boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
              }}
            >
              <Icon name="add" size={32} />
            </button>
          )}

          {isMobile && selected && sheet === null && (
            <MobileActionBar
              p={p}
              onEdit={() => setSheet("edit")}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
            />
          )}

          <AnimatePresence>
            {isMobile && sheet === "edit" && selected && (
              <BottomSheet key="edit" p={p} onClose={() => setSheet(null)}>
                <MobileInspector
                  item={selected}
                  palette={p}
                  onChange={patchSelected}
                  onDelete={() => {
                    deleteSelected();
                    setSheet(null);
                  }}
                  onDuplicate={duplicateSelected}
                  onClose={() => setSheet(null)}
                />
              </BottomSheet>
            )}
            {isMobile && sheet === "settings" && (
              <BottomSheet key="settings" p={p} onClose={() => setSheet(null)}>
                <MobileSettings palette={p} paletteKey={paletteKey} onPalette={setPaletteKey} theme={theme} onTheme={patchTheme} />
              </BottomSheet>
            )}
            {isMobile && sheet === "lang" && (
              <BottomSheet key="lang" p={p} onClose={() => setSheet(null)}>
                <MobileLang
                  palette={p}
                  lang={lang}
                  onLang={(l) => {
                    changeLanguage(l);
                    setSheet(null);
                  }}
                />
              </BottomSheet>
            )}
          </AnimatePresence>

          {toast && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 96,
                transform: "translateX(-50%)",
                padding: "10px 18px",
                borderRadius: 20,
                background: p.inverseSurface,
                color: p.inverseOnSurface,
                fontSize: 13,
                fontWeight: 600,
                zIndex: 47,
                pointerEvents: "none",
              }}
            >
              {toast}
            </div>
          )}

          {!rightOpen && !isMobile && (
            <div
              style={{ position: "absolute", right: 20, top: 20, zIndex: 45 }}
            >
              <IconBtn
                icon="right_panel_open"
                p={p}
                on
                onClick={() => setRightOpen(true)}
                title={t("edit", lang)}
                size={44}
              />
            </div>
          )}
        </main>

        {/* ---- right: inspector / prompt ---- */}
        {showRight && (
          <aside style={{ ...panelStyle, width: rightW }}>
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setResizing("right");
              }}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: -3,
                width: 6,
                cursor: "col-resize",
                zIndex: 5,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 10px 6px 12px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <Segmented<"edit" | "prompt">
                  options={[
                    { key: "edit", icon: "tune", title: t("edit", lang), grow: false, wide: true },
                    { key: "prompt", icon: "auto_awesome", label: t("prompt", lang), title: t("prompt", lang), grow: true },
                  ]}
                  value={rightTab}
                  onChange={setRightTab}
                  p={p}
                  height={40}
                />
              </div>
              <IconBtn
                icon="right_panel_close"
                p={p}
                onClick={() => setRightOpen(false)}
                title={t("closePanel", lang)}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {rightTab === "edit" && selectedFrame && !selected ? (
                <FrameInspector
                  frame={selectedFrame}
                  palette={p}
                  onSize={(preset) => setFramePreset(selectedFrame.id, preset)}
                  onChange={(patch) => patchFrame(selectedFrame.id, patch)}
                  onDelete={() => deleteFrame(selectedFrame.id)}
                  onDuplicate={() => duplicateFrame(selectedFrame.id)}
                  onPreview={() => openPreview(selectedFrame.id)}
                  prompt={buildPrompt(doc, widths, selectedFrame.id, lang)}
                  onSaveImage={() => saveFrameImage(selectedFrame)}
                  frames={frames}
                  tidy={tidyState ?? "done"}
                  onTidy={() => tidy(selectedFrame)}
                  onPlace={(pl) => setPlace(selectedFrame, pl)}
                  ai={{ ready: aiReady, reason: aiReason, busy: aiBusy && aiFrameId === selectedFrame.id, onRun: () => runAi("describe", selectedFrame), onCancel: cancelAi }}
                />
              ) : rightTab === "edit" ? (
                <Inspector
                  ai={{
                    ready: aiReady && !!tidyTarget,
                    reason: aiReason,
                    busy: aiBusy,
                    onRun: () => {
                      if (tidyTarget && selected) runAi("behavior", tidyTarget, selected.id);
                    },
                    onCancel: cancelAi,
                  }}
                  item={selectedIds.length > 1 ? null : selected}
                  railStandalone={groups.some((g) => g.items.length === 1 && g.items[0].id === selected?.id)}
                  frame={selectedPartFrame}
                  palette={p}
                  frames={frame === "phone" ? frames : []}
                  onChange={patchSelected}
                  onDelete={deleteSelected}
                  onDuplicate={duplicateSelected}
                  onAlign={alignSelected}
                  multi={selectedIds.length}
                  grouped={!!selectedGroup}
                  onGroup={groupSelected}
                  onUngroup={ungroupSelected}
                />
              ) : (
                <PromptPanel
                  doc={doc}
                  widths={widths}
                  palette={p}
                  onDoc={(patch) => {
                    if (patch.title !== undefined) setTitle(patch.title);
                    if (patch.brief !== undefined) setBrief(patch.brief);
                    if ("promptEdit" in patch) setPromptEdit(patch.promptEdit);
                    if ("platform" in patch) setPlatform(isPlatform(patch.platform) ? patch.platform : null);
                  }}
                />
              )}
            </div>
          </aside>
        )}

        <input
          ref={projectFileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void readProject(file).then((next) => (next ? setPendingImport(next) : showToast(t("invalidProject", lang), 3000, "error")));
          }}
        />

        <ConfirmDialog
          open={pendingImport !== null}
          icon="file_open"
          title={t("replaceProjectTitle", lang)}
          body={t("replaceProject", lang)}
          p={p}
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            if (pendingImport) importDoc(pendingImport);
            setPendingImport(null);
          }}
        />

        <ShareDialog
          p={p}
          doc={doc}
          aiReady={aiReady}
          idea={ideaText}
          onIdea={setIdeaText}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          onDraft={(formData) => {
            setShareOpen(false);
            draftAction(formData);
          }}
          onSetupAi={() => {
            setShareOpen(false);
            setLeftOpen(true);
            setLeftTab("ai");
          }}
        />


        <ConfirmDialog
          open={confirmClear}
          title={t("clearAllTitle", lang)}
          body={t("clearAllBody", lang)}
          p={p}
          onCancel={() => setConfirmClear(false)}
          onConfirm={clearAll}
        />
      </div>

      <AnimatePresence>
        {previewId !== null && frames.length > 0 && (
          <Preview
            key="preview"
            doc={doc}
            widths={widths}
            palette={p}
            startId={previewId}
            onClose={closePreview}
          />
        )}
      </AnimatePresence>

      {editAccess === "readonly" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-access-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "rgba(0,0,0,0.32)",
          }}
        >
            <div
              style={{
                width: "min(420px, 100%)",
                padding: 24,
                borderRadius: 28,
                background: p.surfaceContainerHigh,
                color: p.onSurface,
                boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
              }}
            >
              <Icon name="lock" size={28} />
              <h1 id="edit-access-title" style={{ margin: "16px 0 8px", fontSize: 22, lineHeight: 1.25 }}>
                {t("readOnlyTitle", lang)}
              </h1>
              <p style={{ margin: 0, color: p.onSurfaceVariant, fontSize: 14, lineHeight: 1.5 }}>
                {t("readOnlyBody", lang)}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                <button
                  autoFocus
                  className="m3-press"
                  onClick={() => window.location.reload()}
                  style={{
                    minHeight: 40,
                    padding: "0 20px",
                    border: "none",
                    borderRadius: 20,
                    background: p.primary,
                    color: p.onPrimary,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t("reload", lang)}
                </button>
              </div>
            </div>
        </div>
      )}
    </ThemeContext.Provider>
    </LangContext.Provider>
  );
}
