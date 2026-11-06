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
 * there; remove it first (see `replaceApplicationFile`).
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
 * Uploads `file` for a question and removes the file it replaces, returning
 * the new key for the answer. The new file goes up first, so a failed upload
 * leaves the old answer intact; a same-named file is removed first, since
 * objects cannot be overwritten.
 */
export async function replaceApplicationFile(
  supabase: DbClient,
  input: { path: string; file: Blob; previousPath?: string | null }
): Promise<string> {
  if (input.previousPath === input.path) {
    await removeApplicationFiles(supabase, [input.path]);
  }
  await uploadApplicationFile(supabase, input.path, input.file);
  if (input.previousPath && input.previousPath !== input.path) {
    await removeApplicationFiles(supabase, [input.previousPath]);
  }
  return input.path;
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
