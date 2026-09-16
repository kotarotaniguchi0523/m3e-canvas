import { COMPONENT_KIND, CONTENT_W, PHONE_W, VARIANTS, type ComponentKind, type Variant, contentWidth, halfWidth } from "./tokens";
import { t } from "./i18n";

export function variantsOf(kind: ComponentKind): { key: Variant; label: string }[] {
  const variants = VARIANTS.map((v) => ({ ...v, label: t(v.key) }));
  switch (kind) {
    case COMPONENT_KIND.card:
      return [
        { key: "tonal", label: t("filled") },
        { key: "elevated", label: t("elevated") },
        { key: "outlined", label: t("outlined") },
      ];
    case COMPONENT_KIND.textField:
    case COMPONENT_KIND.select:
      return [
        { key: "outlined", label: t("outlined") },
        { key: "filled", label: t("filled") },
      ];
    case COMPONENT_KIND.chip:
      return [
        { key: "outlined", label: t("outlined") },
        { key: "tonal", label: t("elevated") },
      ];
    case COMPONENT_KIND.fab:
    case COMPONENT_KIND.extendedFab:
    case COMPONENT_KIND.fabMenu:
      return variants.filter((v) => v.key !== "text" && v.key !== "elevated" && v.key !== "outlined");
    case COMPONENT_KIND.splitButton:
      return variants.filter((v) => v.key !== "text");
    case COMPONENT_KIND.toolbar:
      return [
        { key: "tonal", label: t("standard") },
        { key: "filled", label: t("vibrant") },
      ];
    case COMPONENT_KIND.iconButton:
      return variants.filter((v) => v.key !== "elevated" && v.key !== "text").concat({
        key: "text",
        label: t("standard"),
      });
    case COMPONENT_KIND.box:
    case COMPONENT_KIND.button:
    case COMPONENT_KIND.topAppBar:
    case COMPONENT_KIND.bottomNav:
    case COMPONENT_KIND.navRail:
    case COMPONENT_KIND.searchBar:
    case COMPONENT_KIND.listItem:
    case COMPONENT_KIND.dialog:
    case COMPONENT_KIND.snackbar:
    case COMPONENT_KIND.switch:
    case COMPONENT_KIND.checkbox:
    case COMPONENT_KIND.slider:
    case COMPONENT_KIND.text:
    case COMPONENT_KIND.image:
    case COMPONENT_KIND.camera:
    case COMPONENT_KIND.map:
    case COMPONENT_KIND.divider:
    case COMPONENT_KIND.loadingIndicator:
    case COMPONENT_KIND.linearProgress:
    case COMPONENT_KIND.circularProgress:
    case COMPONENT_KIND.tabs:
    case COMPONENT_KIND.radio:
    case COMPONENT_KIND.badge:
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
