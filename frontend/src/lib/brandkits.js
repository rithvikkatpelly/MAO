import { useMemo } from "react";
import { useItems } from "./items";
import { DEFAULT_BRAND, useBrand } from "./storage";

// The primary kit lives on the profile; extra kits (clients, side brands) are
// "brand_kit" items. A project picks one with design.brandKitId.

export const PRIMARY_KIT = "primary";

export function useBrandKits() {
  const primary = useBrand();
  const { items } = useItems("brand_kit");
  return useMemo(
    () => [
      { ...primary, id: PRIMARY_KIT, kit_name: "Primary" },
      ...items.map((k) => ({ ...DEFAULT_BRAND, ...k })),
    ],
    [primary, items],
  );
}

export function resolveBrand(kits, id) {
  return kits.find((k) => k.id === (id || PRIMARY_KIT)) ?? kits[0];
}

export function useProjectBrand(project) {
  const kits = useBrandKits();
  return resolveBrand(kits, project?.design?.brandKitId);
}
