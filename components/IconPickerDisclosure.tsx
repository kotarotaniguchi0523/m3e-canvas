"use client";

import { useRef } from "react";
import { Palette } from "@/lib/tokens";
import { Icon } from "./M3Node";
import { IconPicker } from "./IconPicker";

/**
 * A picker is an interaction surface, not document state. Native details keeps
 * its open/closed state without mirroring it into React state or synchronizing
 * it from an Effect.
 */
export function IconPickerDisclosure({
  name,
  value,
  label,
  palette,
  onChange,
  size = 44,
  showLabel = false,
}: {
  name: string;
  value: string | null;
  label: string;
  palette: Palette;
  onChange: (value: string | null) => void;
  size?: number;
  showLabel?: boolean;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (disclosure.current) disclosure.current.open = false;
  };
  return (
    <details
      ref={disclosure}
      name={name}
      style={{ position: "relative", display: "inline-block", flex: "0 0 auto" }}
    >
      <summary
        title={label}
        aria-label={label}
        className="m3-press"
        style={{
          minWidth: showLabel ? undefined : size,
          height: size,
          padding: showLabel ? "0 14px 0 10px" : 0,
          borderRadius: size / 2,
          listStyle: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: 12,
          fontWeight: 600,
          background: palette.surfaceContainerHigh,
          color: value ? palette.onSurface : palette.outline,
        }}
      >
        <Icon name={value ?? "block"} size={Math.round(size * 0.5)} />
        {showLabel && <span>{label}</span>}
      </summary>
      <div
        style={{
          position: "absolute",
          top: size + 6,
          left: 0,
          zIndex: 20,
          width: 360,
          maxWidth: "min(360px, 80vw)",
          padding: 8,
          borderRadius: 16,
          background: palette.surfaceContainerLow,
          boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
        }}
      >
        <IconPicker value={value} onChange={onChange} onClose={close} palette={palette} />
      </div>
    </details>
  );
}
