// Talks to the FastAPI backend per TRD_Supply_Chain_Disruption_Agent_v2.md §10.
// Set NEXT_PUBLIC_API_URL in .env.local if the backend isn't on localhost:8000.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const WS_URL = API_BASE.replace(/^http/, "ws") + "/ws/live";

export interface Disruption {
  id: string;
  event_type: string;
  po_id: string | null;
  production_order_id: string | null;
  computed_risk: string | null;
  created_at: string;
}

export interface Decision {
  id: string;
  disruption_id: string;
  production_order_id: string | null;
  candidates_json: any;
  constraint_results_json: any;
  chosen_plan_json: any;
  reasoning_text: string;
  decision_brief_json: { text: string } | null;
  status:
    | "auto_executed"
    | "pending_approval"
    | "approved"
    | "rejected"
    | "replanned";
  approver_id: string | null;
  replan_of: string | null;
  tool_call_count: number;
  created_at: string;
}

export async function fetchDisruptions(): Promise<Disruption[]> {
  const res = await fetch(`${API_BASE}/disruptions`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /disruptions failed: ${res.status}`);
  return res.json();
}

export async function fetchDecision(id: string): Promise<Decision> {
  const res = await fetch(`${API_BASE}/decisions/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /decisions/${id} failed: ${res.status}`);
  return res.json();
}

export async function fetchDecisions(status?: string): Promise<Decision[]> {
  const url = status ? `${API_BASE}/decisions?status=${status}` : `${API_BASE}/decisions`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /decisions failed: ${res.status}`);
  return res.json();
}

export async function injectDisruption(payload: {
  event_type: string;
  po_id?: string;
  production_order_id?: string;
  raw_payload: Record<string, unknown>;
}): Promise<Disruption> {
  const res = await fetch(`${API_BASE}/disruptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // Surface the backend's actual explanation, not just the status code —
    // e.g. FastAPI's 409 detail on the idempotency check (TRD v2 §13) tells
    // you exactly which PO already has an open decision. Discarding that and
    // showing only "failed: 409" makes an intentional, informative safeguard
    // look like an opaque error.
    let detail = `status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // response wasn't JSON — fall back to the status-only message above
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function approveDecision(decisionId: string, approverId: string) {
  const res = await fetch(`${API_BASE}/decisions/${decisionId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approver_id: approverId }),
  });
  if (!res.ok) throw new Error(`approve failed: ${res.status}`);
  return res.json();
}

export async function rejectDecision(decisionId: string, approverId: string) {
  const res = await fetch(`${API_BASE}/decisions/${decisionId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approver_id: approverId }),
  });
  if (!res.ok) throw new Error(`reject failed: ${res.status}`);
  return res.json();
}

export interface AuditEntry {
  id: string;
  decision_id: string;
  actor: string;
  action: string;
  hash: string;
  prev_hash: string | null;
  created_at: string;
}

export interface ChainVerification {
  valid: boolean;
  broken_at_index: number | null;
  total_entries: number;
}

export async function fetchAuditLog(): Promise<AuditEntry[]> {
  const res = await fetch(`${API_BASE}/audit`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /audit failed: ${res.status}`);
  return res.json();
}

export async function verifyAuditChain(): Promise<ChainVerification> {
  const res = await fetch(`${API_BASE}/audit/verify`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /audit/verify failed: ${res.status}`);
  return res.json();
}

export interface SupplierMessage {
  id: string;
  direction: "inbound" | "outbound";
  supplier_id: string;
  po_id: string | null;
  subject: string | null;
  body: string;
  created_at: string;
}

export async function fetchSupplierMessages(poId?: string): Promise<SupplierMessage[]> {
  const url = poId ? `${API_BASE}/supplier-messages?po_id=${poId}` : `${API_BASE}/supplier-messages`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /supplier-messages failed: ${res.status}`);
  return res.json();
}

export interface ClaimVerificationResult {
  po_id: string;
  claim: string | null;
  tracking_status: string | null;
  contradicts: boolean | null;
  verified: boolean | null;
}

export async function fetchClaimVerification(poId: string): Promise<ClaimVerificationResult> {
  const res = await fetch(`${API_BASE}/supplier-messages/verification/${poId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET verification failed: ${res.status}`);
  return res.json();
}

export interface LiveMessage {
  type: "disruption_ingested" | "status" | "error";
  payload: Record<string, any>;
}

export interface SupplierTrustSummary {
  supplier_id: string;
  supplier_name: string | null;
  contradiction_count: number;
  trust_level: "LOW" | "MODERATE" | "OK";
}

export async function fetchSupplierTrustSummary(): Promise<SupplierTrustSummary[]> {
  const res = await fetch(`${API_BASE}/suppliers/trust`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /suppliers/trust failed: ${res.status}`);
  return res.json();
}

export async function correctInventory(
  componentId: string,
  productionOrderId: string,
  usableStock: number,
  notes?: string
): Promise<{ triggered_disruption_id: string }> {
  const res = await fetch(`${API_BASE}/components/${componentId}/correct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usable_stock: usableStock,
      production_order_id: productionOrderId,
      notes: notes ?? "Warehouse recount corrected the usable stock figure.",
    }),
  });
  if (!res.ok) {
    let detail = `status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // not JSON — fall back to status-only message
    }
    throw new Error(detail);
  }
  return res.json();
}

/**
 * Bare WebSocket wrapper, not a React hook itself — see lib/useLiveFeed.ts
 * for the hook that manages reconnection and state. Kept separate so the
 * raw connection logic is testable without React.
 */
export function connectLiveSocket(onMessage: (msg: LiveMessage) => void): WebSocket {
  const ws = new WebSocket(WS_URL);
  ws.onmessage = (event) => {
    try {
      const parsed: LiveMessage = JSON.parse(event.data);
      onMessage(parsed);
    } catch {
      // Ignore malformed frames rather than crashing the whole feed.
    }
  };
  return ws;
}

// ── Security & Trust Fabric Client API ──────────────────────────────────────

export interface KMSStatus {
  tenant_id: string;
  master_key_id: string;
  algorithm: string;
  status: "ACTIVE" | "LOCKED" | "BREAK_GLASS";
  is_data_accessible: boolean;
  last_rotated: string;
  locked_at: string | null;
  locked_by: string | null;
  active_sessions: number;
  break_glass_active: boolean;
  break_glass_expires_at: string | null;
  total_security_events: number;
}

export interface FirewallInspectionResult {
  verdict: "AUTHORIZED" | "DENIED" | "AMBIGUOUS";
  status: string;
  threat_type: string | null;
  reason: string;
  explanation: string;
  required_action: string;
  allowed_examples: string[];
  purpose_bound_ticket: {
    ticket_id: string;
    declared_purpose: string;
    authorized_role: string;
    scoped_resources: string[];
    minimized_fields: string[];
    excluded_unauthorized_fields: string[];
    session_ttl: string;
  } | null;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  title: string;
  alignment_status: string;
  disclaimer: string;
  controls: {
    code: string;
    name: string;
    implementation: string;
    status: string;
    evidence_id: string;
    proof_hash: string;
  }[];
}

export async function fetchKMSStatus(): Promise<KMSStatus> {
  const res = await fetch(`${API_BASE}/security/kms/status`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /security/kms/status failed: ${res.status}`);
  return res.json();
}

export async function lockEnterpriseKMS(actor = "Enterprise Security Admin", reason = "Manual Switch"): Promise<{ success: boolean; status: string; message: string }> {
  const res = await fetch(`${API_BASE}/security/kms/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, reason }),
  });
  if (!res.ok) throw new Error(`POST /security/kms/lock failed: ${res.status}`);
  return res.json();
}

export async function unlockEnterpriseKMS(actor = "Enterprise Security Admin"): Promise<{ success: boolean; status: string; message: string }> {
  const res = await fetch(`${API_BASE}/security/kms/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, auth_token: "KMS-AUTH-CONFIRMED" }),
  });
  if (!res.ok) throw new Error(`POST /security/kms/unlock failed: ${res.status}`);
  return res.json();
}

export async function requestBreakGlass(approver1: string, approver2: string, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/security/kms/break-glass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approver1, approver2, reason, duration_minutes: 15 }),
  });
  if (!res.ok) throw new Error(`POST /security/kms/break-glass failed: ${res.status}`);
  return res.json();
}

export async function inspectPromptWithFirewall(prompt: string, user_role = "Procurement Manager", purpose?: string): Promise<FirewallInspectionResult> {
  const res = await fetch(`${API_BASE}/security/firewall/inspect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, user_role, purpose }),
  });
  if (!res.ok) throw new Error(`POST /security/firewall/inspect failed: ${res.status}`);
  return res.json();
}

export async function fetchComplianceControls(): Promise<{ frameworks: ComplianceFramework[] }> {
  const res = await fetch(`${API_BASE}/security/compliance/controls`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /security/compliance/controls failed: ${res.status}`);
  return res.json();
}

export async function testRealEncrypt(plaintext: string): Promise<{ algorithm: string; iv: string; ciphertext: string; key_id: string }> {
  const res = await fetch(`${API_BASE}/security/crypto/encrypt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plaintext }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Encryption failed");
  }
  return res.json();
}

export async function testRealDecrypt(iv: string, ciphertext: string): Promise<{ success: boolean; plaintext: string }> {
  const res = await fetch(`${API_BASE}/security/crypto/decrypt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ iv, ciphertext }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Decryption failed");
  }
  return res.json();
}
