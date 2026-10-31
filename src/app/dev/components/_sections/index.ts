import type { GallerySection } from "../_gallery/types";
import buttons from "./buttons";
import choiceControls from "./choice-controls";
import composites from "./composites";
import dataTable from "./data-table";
import feedback from "./feedback";
import foundations from "./foundations";
import formControls from "./form-controls";
import navigation from "./navigation";
import overlays from "./overlays";
import people from "./people";
import surfaces from "./surfaces";
import tabsAndMenus from "./tabs-and-menus";

/** Ordered registry of the gallery sections. Frozen: each restyle PR edits only its own section file. */
export const sections: readonly GallerySection[] = [
  foundations,
  buttons,
  formControls,
  surfaces,
  overlays,
  navigation,
  composites,
  feedback,
  choiceControls,
  tabsAndMenus,
  people,
  dataTable,
];
