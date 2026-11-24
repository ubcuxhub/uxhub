import { BUCKETS } from "./buckets";
import type { DbClient } from "./types";

/**
 * Files members attach to application answers, in the private
 * `application-files` bucket (supabase/migrations/20261106193115).
 *
 * Members upload and remove with their own session (the browser client), and
 * Storage's policies decide: upload only into their own draft, under a
 * file_upload question of its event; remove only while the application is a
 * draft or gone; read their own, and admins read submitted ones. The answer to
 * the question stores the key `applicationFilePath` returns.
 */

/** Matches the bucket's `file_size_limit`. */
export const APPLICATION_FILE_MAX_BYTES = 5 * 1024 * 1024;
/** Matches the bucket's `allowed_mime_types`. */
export const APPLICATION_FILE_TYPES = ["application/pdf"] as const;

/** Why a file cannot be uploaded, or null when it can. */
export function validateApplicationFile(file: {
  size: number;
  type: string;
}): string | null {
  if (!(APPLICATION_FILE_TYPES as readonly string[]).includes(file.type)) {
    return "Upload a PDF.";
  }
  if (file.size > APPLICATION_FILE_MAX_BYTES) {
    return "The file must be 5 MB or smaller.";
  }
  if (file.size === 0) return "The file is empty.";
  return null;
}

/**
 * A storage-safe version of a file name: no folders, only letters, digits,
 * spaces, dots, dashes, underscores and brackets, at most 120 characters,
 * keeping the extension.
 */
export function sanitizeApplicationFileName(fileName: string): string {
  const base = fileName.slice(fileName.lastIndexOf("/") + 1).split("\\").pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._ ()-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[\s.-]+/, "")
    .trim();
  if (!cleaned) return "file.pdf";
  if (cleaned.length <= 120) return cleaned;

  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 120 - extension.length).trimEnd() + extension;
}

/** `<user_info_id>/<application_id>/<question_id>/<file name>`. */
export function applicationFilePath(input: {
  userInfoId: string;
  applicationId: string;
  questionId: string;
  fileName: string;
}): string {
  return [
    input.userInfoId,
    input.applicationId,
    input.questionId,
    sanitizeApplicationFileName(input.fileName),
  ].join("/");
}

/**
 * Uploads a file to `path` and returns `path`. Fails if an object is already
 * there: a replacement goes up under a new key (`numberedApplicationFilePath`
 * when the name is the same), and the old one is removed once the answer
 * names the new key.
 */
export async function uploadApplicationFile(
  supabase: DbClient,
  path: string,
  file: Blob
): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKETS.applicationFiles)
    .upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw error;
  return path;
}

/**
 * The same key with a numbered file name, for a replacement that would
 * otherwise reuse the key of the file it replaces: `cv.pdf` becomes
 * `cv (1).pdf`, and `cv (1).pdf` becomes `cv (2).pdf`.
 */
export function numberedApplicationFilePath(path: string): string {
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot) : "";
  const stem = extension ? name.slice(0, dot) : name;
  const numbered = /^(.*) \((\d+)\)$/.exec(stem);
  const base = numbered ? numbered[1] : stem;
  const suffix = ` (${numbered ? Number(numbered[2]) + 1 : 1})`;
  // Shorten the name, not the number, to stay within the 120-character limit.
  const room = Math.max(1, 120 - extension.length - suffix.length);
  return path.slice(0, slash + 1) + base.slice(0, room).trimEnd() + suffix + extension;
}

export async function removeApplicationFiles(
  supabase: DbClient,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await supabase.storage
    .from(BUCKETS.applicationFiles)
    .remove(paths);

  if (error) throw error;
}

/** Every file key under one application, across its questions. */
export async function listApplicationFiles(
  supabase: DbClient,
  input: { userInfoId: string; applicationId: string }
): Promise<string[]> {
  const bucket = supabase.storage.from(BUCKETS.applicationFiles);
  const prefix = `${input.userInfoId}/${input.applicationId}`;

  const { data: folders, error } = await bucket.list(prefix, { limit: 1000 });
  if (error) throw error;

  const paths: string[] = [];
  for (const folder of folders ?? []) {
    // Folders come back without an id; a stray object at this level is kept.
    if (folder.id) {
      paths.push(`${prefix}/${folder.name}`);
      continue;
    }
    const { data: files, error: filesError } = await bucket.list(
      `${prefix}/${folder.name}`,
      { limit: 1000 }
    );
    if (filesError) throw filesError;
    for (const file of files ?? []) {
      paths.push(`${prefix}/${folder.name}/${file.name}`);
    }
  }
  return paths;
}

/**
 * A short-lived download link for an uploaded file, or null when the caller
 * cannot read it (or it is gone).
 */
export async function createApplicationFileUrl(
  supabase: DbClient,
  path: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKETS.applicationFiles)
    .createSignedUrl(path, expiresInSeconds, {
      download: path.slice(path.lastIndexOf("/") + 1),
    });

  if (error) return null;
  return data.signedUrl;
}
