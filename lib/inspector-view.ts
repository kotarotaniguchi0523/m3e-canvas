import { CONTENT_W, KINDS, PHONE_W, VARIANTS, type Kind, type Variant, contentWidth, halfWidth } from "./tokens";
import { t } from "./i18n";

export function variantsOf(kind: Kind): { key: Variant; label: string }[] {
  const variants = VARIANTS.map((v) => ({ ...v, label: t(v.key) }));
  switch (kind) {
    case KINDS.card:
      return [
        { key: "tonal", label: t("filled") },
        { key: "elevated", label: t("elevated") },
        { key: "outlined", label: t("outlined") },
      ];
    case KINDS.textField:
    case KINDS.select:
      return [
        { key: "outlined", label: t("outlined") },
        { key: "filled", label: t("filled") },
      ];
    case KINDS.chip:
      return [
        { key: "outlined", label: t("outlined") },
        { key: "tonal", label: t("elevated") },
      ];
    case KINDS.fab:
    case KINDS.extendedFab:
    case KINDS.fabMenu:
      return variants.filter((v) => v.key !== "text" && v.key !== "elevated" && v.key !== "outlined");
    case KINDS.splitButton:
      return variants.filter((v) => v.key !== "text");
    case KINDS.toolbar:
      return [
        { key: "tonal", label: t("standard") },
        { key: "filled", label: t("vibrant") },
      ];
    case KINDS.iconButton:
      return variants.filter((v) => v.key !== "elevated" && v.key !== "text").concat({
        key: "text",
        label: t("standard"),
      });
    case KINDS.box:
    case KINDS.button:
    case KINDS.topAppBar:
    case KINDS.bottomNav:
    case KINDS.navRail:
    case KINDS.searchBar:
    case KINDS.listItem:
    case KINDS.dialog:
    case KINDS.snackbar:
    case KINDS.switch:
    case KINDS.checkbox:
    case KINDS.slider:
    case KINDS.text:
    case KINDS.image:
    case KINDS.camera:
    case KINDS.map:
    case KINDS.divider:
    case KINDS.loadingIndicator:
    case KINDS.linearProgress:
    case KINDS.circularProgress:
    case KINDS.tabs:
    case KINDS.radio:
    case KINDS.badge:
      return variants;
  }
}

/** Hover text for a width preset derived from the selected frame. */
export const widthPresetLabel = (v: number, frameWidth = PHONE_W): string | undefined =>
  v === frameWidth
    ? t("screenWidth")
    : v === contentWidth(frameWidth)
      ? t("contentWidth")
      : v === halfWidth(frameWidth)
        ? t("halfWidth")
        : frameWidth !== PHONE_W && v === CONTENT_W
          ? t("columnWidth")
          : undefined;
