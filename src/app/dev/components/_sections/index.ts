import type { GallerySection } from "../_gallery/types";
import buttons from "./buttons";
import composites from "./composites";
import foundations from "./foundations";
import formControls from "./form-controls";
import navigation from "./navigation";
import overlays from "./overlays";
import surfaces from "./surfaces";

/** Ordered registry of the gallery sections. Frozen: each restyle PR edits only its own section file. */
export const sections: readonly GallerySection[] = [
  foundations,
  buttons,
  formControls,
  surfaces,
  overlays,
  navigation,
  composites,
];
