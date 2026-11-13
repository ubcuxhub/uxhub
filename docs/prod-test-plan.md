# Prod test plan: event builder, teams, QR check-in

**People (5):** you as **Host** (admin, with a phone) + testers **A**, **B**, **C**, **D** (own accounts, own phones). All are Managers, so they can see the draft.

The flag is on. Drafts never show in the Events list, so always use the direct links below.

## 1. Event builder (Host)
The draft **QA Team Test** is already set up: free, teams on (max 3), one check-in session, Nov 12–19.
1. Open it in the builder: [Edit QA Team Test](https://www.ubcuxhub.ca/admin/events/ba0548e5-ed36-44b2-967e-04e312961890/edit).
2. Add a description with **bold** text and a header colour, then save. **Don't click Publish.**
3. Reload. ✅ The changes are kept.
4. [Create new event](https://www.ubcuxhub.ca/admin/events/create-new) named **QA Team Test** again and save. ✅ It saves (URL ends in `-1`). Then delete it.
5. Send everyone the event link: [QA Team Test](https://www.ubcuxhub.ca/portal/events/qa-team-test)

## 2. Register (A, B, C, D)
1. Open [QA Team Test](https://www.ubcuxhub.ca/portal/events/qa-team-test). ✅ "Draft" banner, header, description.
2. Click **Register** → **Confirm registration**. ✅ No card form.
3. Back on the event page. ✅ Ticket with a QR code, and a **Your team** card.

## 3. Teams (A, B, C, D)
1. **A:** **Create team** → name "Test Team" → **Copy link**. Send it to B, C and D.
2. **B:** open the link in a private window (signed out). ✅ Login, then **Join Test Team?** → **Join team**.
3. **C:** on the event page, **Join a team** → paste the link → **Join team**. ✅ "3 of 3 members", invite link gone.
4. **D:** open the link. ✅ An error says the team is full.
5. **A:** **Manage team → Rename team**. ✅ Everyone sees the new name after a refresh.
6. **C:** **Manage team → Leave team**. ✅ C sees **Create team** / **Join a team** again.
7. **D:** open the link again → **Join team**. ✅ D is on the team (spot freed by C).
8. **C:** **Create team** with no name. ✅ It shows as "C's first name's team".

## 4. Check-in (Host on phone; A–D show tickets)
1. Open the [scanner](https://www.ubcuxhub.ca/admin/events/ba0548e5-ed36-44b2-967e-04e312961890/check-in/scan) on your phone. Allow the camera.
2. Scan **A**'s ticket. ✅ Green, A's name.
3. **Scan next**, scan A again. ✅ "Already checked in at …".
4. Scan a **screenshot** of B's ticket. ✅ Green.
5. **Can't scan?** → search C → pick C. ✅ Green.
6. Scan **D**'s ticket on a dimmed screen. ✅ Green.
7. On a laptop, open the [check-in page](https://www.ubcuxhub.ca/admin/events/ba0548e5-ed36-44b2-967e-04e312961890/check-in). ✅ A–D are checked in.

## 5. Quick check
- Open [Events](https://www.ubcuxhub.ca/portal/events). ✅ "No events scheduled yet" (the test event is a draft).

## 6. Cleanup (Host)
1. **A** and **C:** **Manage team → Delete team**.
2. Delete QA Team Test from its [event page](https://www.ubcuxhub.ca/admin/events/ba0548e5-ed36-44b2-967e-04e312961890). If it refuses because tickets exist, ask Claude to remove the test rows.
3. Keep the flag on, or set it to `false` and redeploy.
