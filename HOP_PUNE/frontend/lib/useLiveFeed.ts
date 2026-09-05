"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Disruption,
  Decision,
  connectLiveSocket,
  fetchDisruptions,
  fetchDecisions,
} from "@/lib/api";

interface LiveState {
  disruptions: Disruption[];
  decisions: Decision[];
  liveStatuses: Record<string, string>; // disruption_id -> latest WS status string
  contradictedIds: Set<string>; // disruption_ids where claim_contradicted fired at any point —
  // tracked separately from liveStatuses because that status gets overwritten once
  // the run finishes (auto_executed/pending_approval), but per UI/UX Brief v2 §5.1
  // the trust-alert indicator should PERSIST on the card even after resolution,
  // not disappear the moment the final status arrives.
  //
  // KNOWN LIMITATION: this only tracks contradictions that fired WHILE this
  // browser tab was connected via WebSocket. A page reload mid-demo, or a
  // disruption triggered via run_scenario.py rather than the dashboard, won't
  // retroactively populate this set — the underlying contradiction is still
  // real and visible in the decision's reasoning text, just not flagged with
  // this specific badge after a reload. A fully robust version would derive
  // this from the backend's persistent SupplierTrustEvent table instead
  // (GET /suppliers/{id}/trust) — not done here due to time constraints.
  wsConnected: boolean;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 3000;

/**
 * Subscribes to /ws/live and keeps a local map of the latest known status per
 * disruption, falling back to REST polling if the socket drops — per
 * TRD_Supply_Chain_Disruption_Agent_v2.md §13's NFR, the dashboard shouldn't
 * go dark just because one WS connection hiccuped.
 */
export function useLiveFeed(): LiveState {
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, string>>({});
  const [contradictedIds, setContradictedIds] = useState<Set<string>>(new Set());
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [d, dec] = await Promise.all([fetchDisruptions(), fetchDecisions()]);
      setDisruptions(d);
      setDecisions(dec);
    } catch {
      // Swallow — the poll loop or next WS message will retry naturally.
    }
  }, []);

  useEffect(() => {
    refresh();

    function connect() {
      const ws = connectLiveSocket((msg) => {
        if (msg.type === "status" && msg.payload.disruption_id) {
          setLiveStatuses((prev) => ({
            ...prev,
            [msg.payload.disruption_id]: msg.payload.status,
          }));
          if (msg.payload.status === "claim_contradicted") {
            setContradictedIds((prev) => new Set(prev).add(msg.payload.disruption_id));
          }
          // A status change usually means a new/updated decision row exists —
          // refresh from REST rather than trying to reconstruct it from the
          // WS payload alone, so the UI never shows partial/stale data.
          refresh();
        }
        if (msg.type === "disruption_ingested") {
          refresh();
        }
      });

      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        // Fall back to polling immediately, then retry the socket after a beat.
        setTimeout(connect, 2000);
      };
      wsRef.current = ws;
    }

    connect();

    // Polling fallback runs regardless — cheap insurance per TRD v2 §13,
    // and it's what keeps the dashboard alive if WS never connects at all
    // (e.g. a proxy in front of the API that doesn't support upgrades).
    pollRef.current = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      wsRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  return { disruptions, decisions, liveStatuses, contradictedIds, wsConnected, refresh };
}
