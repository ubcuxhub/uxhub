import type { GallerySection } from "../_gallery/types";
import adminData from "./admin-data";
import buttons from "./buttons";
import choiceControls from "./choice-controls";
import colourPicker from "./colour-picker";
import composites from "./composites";
import dataTable from "./data-table";
import dateTime from "./date-time";
import events from "./events";
import feedback from "./feedback";
import fieldExtensions from "./field-extensions";
import formControls from "./form-controls";
import foundations from "./foundations";
import lists from "./lists";
import media from "./media";
import navigation from "./navigation";
import overlays from "./overlays";
import people from "./people";
import routeTabs from "./route-tabs";
import searchableDropdown from "./searchable-dropdown";
import sectionNavigator from "./section-navigator";
import sidePeekDrawer from "./side-peek-drawer";
import surfaces from "./surfaces";
import tabsAndMenus from "./tabs-and-menus";
import templates from "./templates";
import ticket from "./ticket";

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
  fieldExtensions,
  dateTime,
  colourPicker,
  events,
  media,
  adminData,
  searchableDropdown,
  sidePeekDrawer,
  sectionNavigator,
  lists,
  ticket,
  routeTabs,
  templates,
];
