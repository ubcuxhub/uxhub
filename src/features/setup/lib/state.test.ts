import { describe, expect, it } from "vitest";

import { INTEREST_OPTIONS, SETUP_STEPS } from "./options";
import {
  getSetupRedirect,
  resolveSetupDestination,
  nextSetupStep,
  resolveAvatar,
  SETUP_PATH,
  toSetupState,
  toSetupStep,
} from "./state";

describe("getSetupRedirect", () => {
  it("sends members who haven't finished or skipped setup from the portal home", () => {
    for (const step of ["about", "dietary", "photo", "interests"]) {
      expect(getSetupRedirect({ setup_step: step }, "/portal")).toBe(SETUP_PATH);
    }
  });

  it("lets finished members, and backfilled existing ones, through", () => {
    expect(getSetupRedirect({ setup_step: "done" }, "/portal")).toBeNull();
  });

  it("never gates checkout, membership, event, admin, API or setup routes", () => {
    for (const path of [
      "/portal/events/uxathon",
      "/portal/events/uxathon/checkout",
      "/portal/membership/join",
      "/portal/membership/explorer/checkout",
      "/portal/setup",
      "/portal/",
      "/admin",
      "/api/profile-photo",
    ]) {
      expect(getSetupRedirect({ setup_step: "dietary" }, path)).toBeNull();
    }
  });

  it("fails open on a step it doesn't know", () => {
    expect(getSetupRedirect({ setup_step: "welcome" }, "/portal")).toBeNull();
    expect(toSetupStep(null)).toBe("done");
  });
});

describe("nextSetupStep", () => {
  it("asks what best describes you first", () => {
    expect(SETUP_STEPS[0]).toBe("about");
  });

  it("moves to the step after the one saved or skipped", () => {
    expect(nextSetupStep("about", "about")).toBe("dietary");
    expect(nextSetupStep("dietary", "dietary")).toBe("photo");
    expect(nextSetupStep("photo", "photo")).toBe("interests");
    expect(nextSetupStep("interests", "interests")).toBe("done");
  });

  it("resumes after a step the member went back to", () => {
    expect(nextSetupStep("interests", "dietary")).toBe("photo");
    expect(nextSetupStep("photo", "about")).toBe("dietary");
  });

  it("keeps a finished member finished", () => {
    expect(nextSetupStep("done", "dietary")).toBe("done");
    expect(nextSetupStep("done", "about")).toBe("done");
  });
});

describe("toSetupState", () => {
  it("maps the row's columns", () => {
    expect(
      toSetupState({
        setup_step: "photo",
        user_type: "faculty",
        user_type_confirmed_at: "2026-11-10T00:00:00+00:00",
        diets: ["halal"],
        allergies: ["soy"],
        other_allergies: ["Kiwi"],
        avatar_preset: null,
        profile_photo_path: "profiles/a/b.png",
        interests: ["ux-research"],
      })
    ).toEqual({
      step: "photo",
      userType: "faculty",
      userTypeConfirmed: true,
      diets: ["halal"],
      allergies: ["soy"],
      otherAllergies: ["Kiwi"],
      avatarPreset: null,
      profilePhotoPath: "profiles/a/b.png",
      interests: ["ux-research"],
    });
  });
});

describe("toSetupState, user type", () => {
  it("treats a type nobody confirmed as unanswered", () => {
    const state = toSetupState({
      setup_step: "about",
      user_type: "ubcStudent",
      user_type_confirmed_at: null,
      diets: [],
      allergies: [],
      other_allergies: [],
      avatar_preset: null,
      profile_photo_path: null,
      interests: [],
    });
    expect(state).toMatchObject({ step: "about", userType: "ubcStudent", userTypeConfirmed: false });
  });
});

describe("resolveAvatar", () => {
  it("prefers an uploaded photo, then a preset, then initials", () => {
    expect(resolveAvatar({ profile_photo_path: "profiles/a/b.png", avatar_preset: "flower" })).toEqual({
      kind: "photo",
      path: "profiles/a/b.png",
    });
    expect(resolveAvatar({ profile_photo_path: null, avatar_preset: "flower" })).toEqual({
      kind: "preset",
      preset: "flower",
    });
    expect(resolveAvatar({ profile_photo_path: null, avatar_preset: null })).toEqual({ kind: "initials" });
  });
});

describe("interest taxonomy", () => {
  it("fits the 20-tag cap on user_info.interests with unique ids", () => {
    const ids = INTEREST_OPTIONS.map((option) => option.id);
    expect(ids.length).toBeLessThanOrEqual(20);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("resolveSetupDestination", () => {
  it("sends an unfinished member heading for the portal home to setup", () => {
    expect(resolveSetupDestination("/portal", "dietary")).toBe(SETUP_PATH);
    expect(resolveSetupDestination("/portal", "about")).toBe(SETUP_PATH);
    expect(resolveSetupDestination("/portal?x=1#top", "dietary")).toBe(SETUP_PATH);
  });

  it("honours any other destination, and a finished or missing step", () => {
    expect(resolveSetupDestination("/portal/events/foo/checkout", "dietary")).toBe(
      "/portal/events/foo/checkout"
    );
    expect(resolveSetupDestination("/auth/update-password", "dietary")).toBe(
      "/auth/update-password"
    );
    expect(resolveSetupDestination("/portal", "done")).toBe("/portal");
    expect(resolveSetupDestination("/portal", null)).toBe("/portal");
  });
});
