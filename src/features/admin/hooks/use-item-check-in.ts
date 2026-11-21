"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchItemCheckInAction, mutateItemCheckInAction } from "@/features/admin/check-in-actions";
import { checkInPath, type ItemCheckInSnapshot, type ItemCheckInResult, type ItemAttendance } from "@/features/admin/lib/item-check-in";
import { createClient } from "@/lib/supabase/client";
import { TABLES } from "@/lib/supabase-helpers/tables";

export function useItemCheckIn(eventId: string, initialItemId: string | null, initialSnapshot: ItemCheckInSnapshot, scan = false, returnTo?: string) {
  const [itemId, setItemId] = useState(initialItemId);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(initialSnapshot.refreshedAt ?? null);
  const current = useRef({ itemId: initialItemId, generation: 0, online: true, busy: false, ready: true, active: true });
  const flight = useRef<{ generation: number; promise: Promise<boolean> } | null>(null);
  const refresh = useCallback((): Promise<boolean> => {
    const target = current.current.itemId;
    const generation = current.current.generation;
    if (!current.current.active || !current.current.online)
      return Promise.resolve(false);
    if (flight.current?.generation === generation)
      return flight.current.promise;
    const promise = (async () => {
      try {
        const next = await fetchItemCheckInAction(eventId, target);
        if (generation !== current.current.generation || !current.current.online)
          return false;
        if ("status" in next) {
          current.current.ready = false;
          setForbidden(true);
          setLoading(false);
          return false;
        }
        setForbidden(false);
        current.current.ready = true;
        setSnapshot(next);
        setError(null);
        setLoading(false);
        setLastRefresh(new Date().toISOString());
        return true;
      } catch {
        if (generation === current.current.generation) {
          current.current.ready = false;
          setError("Couldn't refresh check-in. Check your connection and try again.");
          setLoading(false);
        }
        return false;
      } finally {
        if (flight.current?.generation === generation)
          flight.current = null;
      }
    })();
    flight.current = { generation, promise };
    return promise;
  }, [eventId]);
  useEffect(() => {
    const lifecycle = current.current;
    lifecycle.active = true;
    const connected = () => {
      current.current.online = true;
      current.current.ready = false;
      setOnline(true);
      setLoading(true);
      void refresh();
    };
    const disconnected = () => {
      current.current.online = false;
      current.current.ready = false;
      current.current.generation++;
      setOnline(false);
    };
    if (initialItemId && !new URLSearchParams(window.location.search).has("item"))
      window.history.replaceState(null, "", checkInPath(eventId, initialItemId, scan, returnTo));
    if (!navigator.onLine)
      queueMicrotask(disconnected);
    else
      void refresh();
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    const supabase = createClient();
    const channel = supabase.channel(`item-check-in-${eventId}`).on("postgres_changes", { event: "*", schema: "public", table: TABLES.checkIns }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.eventTickets, filter: `event_id=eq.${eventId}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: TABLES.eventAgendaItems }, () => void refresh()).subscribe();
    return () => {
      lifecycle.active = false;
      lifecycle.generation++;
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
      void supabase.removeChannel(channel);
    };
  }, [eventId, refresh, initialItemId, scan, returnTo]);
  const selectItem = (id: string) => {
    current.current.generation++;
    current.current.ready = false;
    current.current.itemId = id;
    setItemId(id);
    setLoading(true);
    setError(null);
    setSnapshot(old => ({ ...old, attendance: [] }));
    window.history.replaceState(null, "", checkInPath(eventId, id, scan, returnTo));
    void refresh();
  };
  const valid = !!itemId && snapshot.items.some(i => i.id === itemId);
  const enabled = online && !forbidden && !loading && !error && !busy && valid;
  async function mutate(input: { ticketId?: string; code?: string; undoVersion?: string }): Promise<ItemCheckInResult | { status: "undone" } | { status: "stale_undo" } | null> {
    if (!current.current.active || !enabled || !current.current.ready || current.current.itemId !== itemId || !navigator.onLine || !current.current.online || current.current.busy || !itemId)
      return null;
    const generation = current.current.generation;
    current.current.busy = true;
    setBusy(true);
    try {
      const result = await mutateItemCheckInAction({ eventId, itemId, ...input });
      if (generation !== current.current.generation || !current.current.online)
        return null;
      if (result.status === "forbidden") {
        current.current.ready = false;
        setForbidden(true);
        return null;
      }
      current.current.generation++;
      const refreshGeneration = current.current.generation;
      const refreshed = await refresh();
      if (refreshGeneration !== current.current.generation || !current.current.online)
        return null;
      if (!refreshed)
        throw new Error(result.status === "checked_in" || result.status === "undone"
          ? "The change was saved, but the list couldn't refresh. Try refreshing before another action."
          : "Couldn't refresh the check-in list. Try again before another action.");
      return result;
    } catch (failure) {
      if (current.current.itemId === itemId && current.current.online) {
        current.current.ready = false;
        setError("Couldn't refresh check-in. Try again before another action.");
      }
      throw failure;
    } finally {
      current.current.busy = false;
      setBusy(false);
    }
  }
  async function undo(attendance: ItemAttendance, targetId = itemId) {
    if (current.current.itemId !== targetId)
      throw new Error("Select the original check-in item before undoing this attendance.");
    const result = await mutate({ ticketId: attendance.ticketId, undoVersion: attendance.attendanceVersion });
    if (result?.status === "stale_undo")
      throw new Error("This check-in changed. The latest attendance has been refreshed; review it before undoing.");
    if (result?.status !== "undone")
      throw new Error("Undo wasn't saved. Check your connection and try again.");
  }
  return { itemId, snapshot, online, loading, busy, forbidden, error, lastRefresh, enabled, selectItem, refresh, mutate, undo };
}
