import { isYearLevel } from "@/lib/constants";
import type { UserInfoUpdate } from "@/lib/supabase/models";

/**
 * A manager's user edit that can't be saved, with a message written for them.
 * Expected, so the action returns it rather than throwing (production builds
 * withhold a thrown error's message from the client).
 */
export class UserEditRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserEditRefusal";
  }
}

/**
 * The `user_info` columns a manager may write. The write goes through the
 * service role, which bypasses RLS, so this list is the only thing between a
 * manager and a privilege escalation. `email` isn't here: it's the sign-in
 * address for a linked account, so saveManagerUserDetailsAction handles it on
 * its own.
 */
const MANAGER_USER_FIELDS = new Set([
  "first_name",
  "last_name",
  "phone",
  "newsletter",
  "student_number",
  "faculty",
  "major",
  "year",
  "membership_type_id",
  "order_date_deprecated",
]);

const PHONE_MAX_LENGTH = 40;

/**
 * The update for one field of a manager's user edit, normalized, or a
 * `UserEditRefusal`. The form's `order_date` is the deprecated column.
 */
export function managerUserUpdate(field: string, value: unknown): UserInfoUpdate {
  const databaseField = field === "order_date" ? "order_date_deprecated" : field;

  if (!MANAGER_USER_FIELDS.has(databaseField)) {
    throw new UserEditRefusal("This user field cannot be edited.");
  }
  if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
    throw new UserEditRefusal("Invalid user field value.");
  }

  if (databaseField === "first_name" || databaseField === "last_name") {
    const normalizedName = typeof value === "string" ? value.trim() : "";
    if (!normalizedName) {
      throw new UserEditRefusal(
        databaseField === "first_name" ? "First name is required." : "Last name is required."
      );
    }
    return { [databaseField]: normalizedName };
  }

  if (databaseField === "phone") {
    const phone = typeof value === "string" ? value.trim() : value === null ? "" : null;
    if (phone === null || phone.length > PHONE_MAX_LENGTH) throw new UserEditRefusal("Enter a valid phone number.");
    return { phone: phone || null };
  }

  if (databaseField === "newsletter" && typeof value !== "boolean") {
    throw new UserEditRefusal("Choose a newsletter preference.");
  }

  if (databaseField === "year" && value !== null && !isYearLevel(value)) {
    throw new UserEditRefusal("Invalid university year.");
  }

  return { [databaseField]: value } as UserInfoUpdate;
}

/** Runs a validator, turning its failure into a refusal with the same message. */
export function refusing<T>(validate: () => T): T {
  try {
    return validate();
  } catch (error) {
    throw new UserEditRefusal(error instanceof Error ? error.message : "Check the form and try again.");
  }
}
