// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  finishSetupAction: vi.fn(),
  saveSetupAboutAction: vi.fn(),
  saveSetupDietaryAction: vi.fn(),
  saveSetupPhotoAction: vi.fn(),
  skipSetupStepAction: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
// Static image imports have no size under Vitest.
vi.mock("@/components/shared/Hubbo", () => ({
  Hubbo: ({ emotion }: { emotion: string }) => <span data-hubbo={emotion} />,
}));

// Radix measures radios with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { USER_TYPE_LOCKED_MESSAGE, type SetupState } from "../lib/state";
import { NO_ABOUT_ANSWER, NO_DIETARY_ANSWER, NO_PHOTO_CHOICE, SetupFlow } from "./SetupFlow";
import type { SetupClient } from "./setup-client";

const BLANK: SetupState = {
  step: "dietary",
  userType: "ubcStudent",
  userTypeConfirmed: false,
  diets: [],
  allergies: [],
  otherAllergies: [],
  avatarPreset: null,
  profilePhotoPath: null,
  interests: [],
};

function fakeClient(): SetupClient & { [K in keyof SetupClient]: ReturnType<typeof vi.fn> } {
  const echo = (patch: Partial<SetupState>) => Promise.resolve({ ...BLANK, ...patch });
  return {
    saveAbout: vi.fn(async ({ userType }) => ({
      ok: true,
      setup: await echo({ userType, userTypeConfirmed: true, step: "dietary" }),
    })),
    saveDietary: vi.fn((needs) => echo({ ...needs, step: "photo" })),
    savePhoto: vi.fn(({ avatarPreset }) => echo({ avatarPreset, step: "interests" })),
    finish: vi.fn(({ interests }) => echo({ interests, step: "done" })),
    skip: vi.fn(() => echo({ step: "photo" })),
    uploadPhoto: vi.fn(() => echo({ profilePhotoPath: "profiles/me/a.jpg" })),
    photoUrl: vi.fn((path: string | null) => (path ? `https://cdn.test/${path}` : null)),
  } as never;
}

let client: ReturnType<typeof fakeClient>;

function renderFlow(initial: Partial<SetupState> = {}, props: { userTypeLocked?: boolean } = {}) {
  return render(
    <SetupFlow
      initial={{ ...BLANK, ...initial }}
      name="Jamie Lee"
      firstName="Jamie"
      client={client}
      {...props}
    />,
  );
}

const heading = () => screen.getByRole("heading", { level: 1 });
const chip = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}$`) });
const press = (name: string) => fireEvent.click(chip(name));
const radio = (name: RegExp) => screen.getByRole("radio", { name });

beforeEach(() => {
  client = fakeClient();
  window.scrollTo = vi.fn();
});
afterEach(cleanup);

describe("SetupFlow", () => {
  it("resumes at the stored step without stealing focus on load", () => {
    renderFlow({ step: "interests" });
    expect(heading().textContent).toBe("What are you into?");
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
    expect(document.activeElement).not.toBe(heading());
  });

  it("starts a member who finished at step 1, with their answers", () => {
    renderFlow({ step: "done", userType: "faculty", userTypeConfirmed: true });
    expect(heading().textContent).toBe("What best describes you?");
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(radio(/faculty member/).getAttribute("aria-checked")).toBe("true");
  });

  describe("step 1, about you", () => {
    it("selects nothing until the member answers, and asks instead of disabling Continue", async () => {
      renderFlow({ step: "about" });
      expect(screen.getByRole("radiogroup", { name: "What best describes you?" })).toBeTruthy();
      expect(screen.getAllByRole("radio").every((item) => item.getAttribute("aria-checked") === "false")).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(await screen.findByText(NO_ABOUT_ANSWER)).toBeTruthy();
      expect(client.saveAbout).not.toHaveBeenCalled();
    });

    it("saves the answer, then moves on with focus on the new heading", async () => {
      renderFlow({ step: "about" });
      fireEvent.click(radio(/not from UBC/));
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));

      await waitFor(() => expect(heading().textContent).toBe("Any dietary needs?"));
      expect(client.saveAbout).toHaveBeenCalledWith({ userType: "nonUbc" });
      expect(document.activeElement).toBe(heading());
      expect(screen.getByRole("status").textContent).toBe("Step 2 of 4: Any dietary needs?");
    });

    it("shows the server's refusal and stays on the step", async () => {
      client.saveAbout.mockResolvedValueOnce({ ok: false, error: USER_TYPE_LOCKED_MESSAGE });
      renderFlow({ step: "about" });
      fireEvent.click(radio(/faculty member/));
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect((await screen.findByRole("alert")).textContent).toBe(USER_TYPE_LOCKED_MESSAGE);
      expect(heading().textContent).toBe("What best describes you?");
    });

    it("can only confirm the stored type while a membership holds it", () => {
      renderFlow({ step: "about", userType: "faculty" }, { userTypeLocked: true });
      expect(radio(/faculty member/).getAttribute("aria-checked")).toBe("true");
      expect(radio(/faculty member/).hasAttribute("disabled")).toBe(false);
      expect(radio(/UBC student/).hasAttribute("disabled")).toBe(true);
      expect(radio(/not from UBC/).hasAttribute("disabled")).toBe(true);
      expect(screen.getByText(USER_TYPE_LOCKED_MESSAGE)).toBeTruthy();
    });

    it("can be skipped", async () => {
      renderFlow({ step: "about" });
      fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
      await waitFor(() => expect(heading().textContent).toBe("Any dietary needs?"));
      expect(client.skip).toHaveBeenCalledWith("about");
      expect(client.saveAbout).not.toHaveBeenCalled();
    });

    it("has no Back, since there's nothing before it", () => {
      renderFlow({ step: "about" });
      expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    });
  });

  describe("step 2, dietary needs", () => {
    it("asks for an answer instead of disabling Save", async () => {
      renderFlow();
      const save = screen.getByRole("button", { name: "Save dietary needs" });
      expect(save.hasAttribute("disabled")).toBe(false);
      fireEvent.click(save);
      expect(await screen.findByText(NO_DIETARY_ANSWER)).toBeTruthy();
      expect(client.saveDietary).not.toHaveBeenCalled();
    });

    it("makes “no dietary needs” exclusive with every other answer", () => {
      renderFlow();
      press("Vegan");
      press("Peanuts");
      press("I don't have any dietary needs");
      expect(chip("Vegan").getAttribute("aria-pressed")).toBe("false");
      expect(chip("Peanuts").getAttribute("aria-pressed")).toBe("false");
      press("Halal");
      expect(chip("I don't have any dietary needs").getAttribute("aria-pressed")).toBe("false");
    });

    it("adds other allergies on Enter, refuses duplicates, and removes them", () => {
      renderFlow();
      const input = screen.getByLabelText("Other allergies");
      fireEvent.change(input, { target: { value: " Sesame " } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(screen.getByRole("list", { name: "Other allergies added" }).textContent).toContain("Sesame");
      expect((input as HTMLInputElement).value).toBe("");

      fireEvent.change(input, { target: { value: "sesame" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(screen.getByRole("alert").textContent).toBe("sesame is already on the list.");
      expect(input.getAttribute("aria-invalid")).toBe("true");

      fireEvent.click(screen.getByRole("button", { name: "Remove Sesame" }));
      expect(screen.queryByRole("list", { name: "Other allergies added" })).toBeNull();
      expect(document.activeElement).toBe(input);
    });

    it("saves typed-but-not-added text with the chips, then moves on with focus on the new heading", async () => {
      renderFlow();
      press("Vegetarian");
      fireEvent.change(screen.getByLabelText("Other allergies"), { target: { value: "Kiwi" } });
      fireEvent.click(screen.getByRole("button", { name: "Save dietary needs" }));

      await waitFor(() => expect(heading().textContent).toBe("Choose a photo"));
      expect(client.saveDietary).toHaveBeenCalledWith({
        diets: ["vegetarian"],
        allergies: [],
        otherAllergies: ["Kiwi"],
      });
      expect(document.activeElement).toBe(heading());
      expect(screen.getByRole("status").textContent).toBe("Step 3 of 4: Choose a photo");
    });

    it("can be skipped", async () => {
      renderFlow();
      fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
      await waitFor(() => expect(heading().textContent).toBe("Choose a photo"));
      expect(client.skip).toHaveBeenCalledWith("dietary");
      expect(client.saveDietary).not.toHaveBeenCalled();
    });

    it("keeps the member on the step when a save fails", async () => {
      client.saveDietary.mockRejectedValueOnce(new Error("hidden in production"));
      renderFlow();
      press("I don't have any dietary needs");
      fireEvent.click(screen.getByRole("button", { name: "Save dietary needs" }));
      expect((await screen.findByRole("alert")).textContent).toMatch(/Couldn't save/);
      expect(heading().textContent).toBe("Any dietary needs?");
    });

    it("goes Back to step 1", async () => {
      renderFlow();
      fireEvent.click(screen.getAllByRole("button", { name: "Back" })[0]);
      await waitFor(() => expect(heading().textContent).toBe("What best describes you?"));
    });
  });

  describe("step 3, photo", () => {
    it("offers the presets as one radio group beside the preview", async () => {
      renderFlow({ step: "photo" });
      const group = screen.getByRole("radiogroup", { name: "Icons" });
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(6);
      expect(group.contains(radios[0])).toBe(true);

      fireEvent.click(screen.getByRole("radio", { name: "Pink starburst" }));
      expect(screen.getByRole("radio", { name: "Pink starburst" }).getAttribute("aria-checked")).toBe("true");
      expect(screen.getByText("Jamie Lee")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Use this photo" }));
      await waitFor(() => expect(heading().textContent).toBe("What are you into?"));
      expect(client.savePhoto).toHaveBeenCalledWith({ avatarPreset: "starburst" });
    });

    it("asks for a choice instead of disabling the button", async () => {
      renderFlow({ step: "photo" });
      fireEvent.click(screen.getByRole("button", { name: "Use this photo" }));
      expect(await screen.findByText(NO_PHOTO_CHOICE)).toBeTruthy();
      expect(client.savePhoto).not.toHaveBeenCalled();
    });

    it("rejects files that aren't JPG or PNG before cropping", () => {
      renderFlow({ step: "photo" });
      const input = screen.getByLabelText("Upload a photo");
      const gif = new File(["gif"], "cat.gif", { type: "image/gif" });
      fireEvent.change(input, { target: { files: [gif] } });
      expect(screen.getByRole("alert").textContent).toMatch(/Uploads must be JPG or PNG/);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("offers an uploaded photo as a choice and keeps it on save", async () => {
      renderFlow({ step: "photo", profilePhotoPath: "profiles/me/a.jpg" });
      const own = screen.getByRole("radio", { name: "Your photo" });
      expect(own.getAttribute("aria-checked")).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "Use this photo" }));
      await waitFor(() => expect(client.savePhoto).toHaveBeenCalledWith({ avatarPreset: null }));
    });

    it("goes Back without saving", async () => {
      renderFlow({ step: "photo" });
      // Two Backs: the header icon (phones) and the footer button (desktop).
      fireEvent.click(screen.getAllByRole("button", { name: "Back" })[0]);
      await waitFor(() => expect(heading().textContent).toBe("Any dietary needs?"));
      expect(document.activeElement).toBe(heading());
      expect(client.skip).not.toHaveBeenCalled();
    });
  });

  describe("step 4, interests and welcome", () => {
    it("counts the chosen interests and finishes into Welcome", async () => {
      renderFlow({ step: "interests" });
      expect(screen.getByText("0 selected")).toBeTruthy();
      press("UX research");
      press("Workshops");
      expect(screen.getByText("2 selected")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
      await waitFor(() => expect(heading().textContent).toBe("Welcome to UX Hub, Jamie"));
      expect(client.finish).toHaveBeenCalledWith({ interests: ["ux-research", "workshops"] });
      expect(document.activeElement).toBe(heading());
      expect(screen.getByRole("link", { name: "Go to your portal" }).getAttribute("href")).toBe("/portal");
    });

    it("leaves out managers' free tags it can't show as chips", () => {
      renderFlow({ step: "interests", interests: ["Figma whiz", "uxathon"] });
      expect(screen.getByText("1 selected")).toBeTruthy();
    });

    it("shows a busy, width-keeping button while saving", async () => {
      let resolve!: (state: SetupState) => void;
      client.finish.mockReturnValueOnce(new Promise<SetupState>((done) => (resolve = done)));
      renderFlow({ step: "interests" });
      fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
      const finish = screen.getByRole("button", { name: "Finish setup" });
      expect(finish.getAttribute("aria-busy")).toBe("true");
      expect(screen.getByRole("button", { name: "Skip for now" }).hasAttribute("disabled")).toBe(true);
      await act(async () => resolve({ ...BLANK, step: "done" }));
    });
  });
});
