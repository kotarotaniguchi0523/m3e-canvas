/** The closed set of component kinds supported by the document model. */
export const KINDS = {
  box: "box",
  button: "button",
  iconButton: "iconButton",
  fab: "fab",
  extendedFab: "extendedFab",
  chip: "chip",
  topAppBar: "topAppBar",
  bottomNav: "bottomNav",
  navRail: "navRail",
  searchBar: "searchBar",
  card: "card",
  listItem: "listItem",
  dialog: "dialog",
  snackbar: "snackbar",
  textField: "textField",
  select: "select",
  switch: "switch",
  checkbox: "checkbox",
  slider: "slider",
  text: "text",
  image: "image",
  camera: "camera",
  map: "map",
  divider: "divider",
  loadingIndicator: "loadingIndicator",
  linearProgress: "linearProgress",
  circularProgress: "circularProgress",
  splitButton: "splitButton",
  fabMenu: "fabMenu",
  toolbar: "toolbar",
  tabs: "tabs",
  radio: "radio",
  badge: "badge",
} as const;

export type Kind = (typeof KINDS)[keyof typeof KINDS];

const KIND_VALUES: readonly string[] = Object.values(KINDS);

export const isKind = (value: unknown): value is Kind => typeof value === "string" && KIND_VALUES.includes(value);
