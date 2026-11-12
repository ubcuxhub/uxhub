import { describe, expect, it } from "vitest";

import {
  APPLICATION_FILE_MAX_BYTES,
  applicationFilePath,
  sanitizeApplicationFileName,
  validateApplicationFile,
} from "./application-files";

describe("applicationFilePath", () => {
  it("keys a file by applicant, application and question", () => {
    expect(
      applicationFilePath({
        userInfoId: "user",
        applicationId: "application",
        questionId: "question",
        fileName: "Résumé (final)!.pdf",
      })
    ).toBe("user/application/question/Resume (final)-.pdf");
  });
});

describe("sanitizeApplicationFileName", () => {
  it("drops folders and leading dots", () => {
    expect(sanitizeApplicationFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeApplicationFileName("C:\\Users\\me\\cv.pdf")).toBe("cv.pdf");
    expect(sanitizeApplicationFileName(".hidden.pdf")).toBe("hidden.pdf");
  });

  it("falls back when nothing usable is left", () => {
    expect(sanitizeApplicationFileName("???")).toBe("file.pdf");
  });

  it("shortens long names but keeps the extension", () => {
    const name = sanitizeApplicationFileName(`${"a".repeat(200)}.pdf`);
    expect(name).toHaveLength(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });
});

describe("validateApplicationFile", () => {
  it("accepts a PDF up to 5 MB", () => {
    expect(
      validateApplicationFile({ type: "application/pdf", size: APPLICATION_FILE_MAX_BYTES })
    ).toBeNull();
  });

  it("refuses other types, empty files and larger files", () => {
    expect(validateApplicationFile({ type: "image/png", size: 10 })).toBe("Upload a PDF.");
    expect(validateApplicationFile({ type: "application/pdf", size: 0 })).toBe(
      "The file is empty."
    );
    expect(
      validateApplicationFile({
        type: "application/pdf",
        size: APPLICATION_FILE_MAX_BYTES + 1,
      })
    ).toBe("The file must be 5 MB or smaller.");
  });
});
