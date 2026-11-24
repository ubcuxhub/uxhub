/**
 * The admin server actions, by domain. This module is a plain re-export (not
 * "use server") so existing `@/features/admin/actions` imports keep working;
 * each action lives, with its guard and result shape, in its own file.
 */
export {
  saveManagerUserDetailsAction,
  updateUserRoleAction,
  type ManagerUserSaveResult,
  type UserRoleResult,
} from "./user-actions";
export {
  deleteAdminEventAction,
  discardUnusedEventImageAction,
  loadAdminEventDeletionInfoAction,
  recoverAdminEventDraftAction,
  recoverAdminEventMutationAction,
  saveAdminEventAction,
  saveAdminEventDraftAction,
  savePastEventResourcesAction,
  searchEventDirectoryAction,
  type SaveAdminEventInput,
  type SaveAdminEventResult,
  type SavedEventPublication,
} from "./event-builder-actions";
export {
  updateApplicationDecisionAction,
  type ApplicationDecisionActionResult,
} from "./application-decision-actions";
export {
  regenerateTicketQrAction,
  voidTicketAction,
  type TicketAdminActionResult,
} from "./ticket-actions";
export {
  setMembershipTermEndsAtAction,
  updateMembershipTypeAction,
} from "./club-settings-actions";
