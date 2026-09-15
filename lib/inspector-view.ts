import { CONTENT_W, PHONE_W, VARIANTS, type Kind, type Variant, contentWidth, halfWidth } from "./tokens";
import { t } from "./i18n";

export function variantsOf(kind: Kind): { key: Variant; label: string }[] {
  const variants = VARIANTS.map((v) => ({ ...v, label: t(v.key) }));
  switch (kind) {
    case "card":
      return [
        { key: "tonal", label: t("filled") },
        { key: "elevated", label: t("elevated") },
        { key: "outlined", label: t("outlined") },
      ];
    case "textField":
    case "select":
      return [
        { key: "outlined", label: t("outlined") },
        { key: "filled", label: t("filled") },
      ];
    case "chip":
      return [
        { key: "outlined", label: t("outlined") },
        { key: "tonal", label: t("elevated") },
      ];
    case "fab":
    case "extendedFab":
    case "fabMenu":
      return variants.filter((v) => v.key !== "text" && v.key !== "elevated" && v.key !== "outlined");
    case "splitButton":
      return variants.filter((v) => v.key !== "text");
    case "toolbar":
      return [
        { key: "tonal", label: t("standard") },
        { key: "filled", label: t("vibrant") },
      ];
    case "iconButton":
      return variants.filter((v) => v.key !== "elevated" && v.key !== "text").concat({
        key: "text",
        label: t("standard"),
      });
    case "box":
    case "button":
    case "topAppBar":
    case "bottomNav":
    case "navRail":
    case "searchBar":
    case "listItem":
    case "dialog":
    case "snackbar":
    case "switch":
    case "checkbox":
    case "slider":
    case "text":
    case "image":
    case "camera":
    case "map":
    case "divider":
    case "loadingIndicator":
    case "linearProgress":
    case "circularProgress":
    case "tabs":
    case "radio":
    case "badge":
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
