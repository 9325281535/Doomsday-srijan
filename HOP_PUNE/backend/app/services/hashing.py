"""
Hash-chained, tamper-evident audit trail. Same pattern as the team's prior
SafeReport project: HMAC-SHA256 over each entry + the previous entry's hash,
so any edit to row N breaks verification for every row after it.

Enforcement lives in the DB migration (REVOKE UPDATE, DELETE ON audit_log),
not just in this code — this module only produces/verifies hashes.

See: Backend_Schema_Supply_Chain_Disruption_Agent_v2.md §2.10
     TRD_Supply_Chain_Disruption_Agent_v2.md §2, §7 (prior version)
"""
import hashlib
import hmac
import json
from dataclasses import dataclass
from typing import Any, Optional


def compute_hash(entry: dict[str, Any], prev_hash: Optional[str], secret_key: bytes) -> str:
    payload = json.dumps(entry, sort_keys=True, default=str) + (prev_hash or "")
    return hmac.new(secret_key, payload.encode("utf-8"), hashlib.sha256).hexdigest()


@dataclass
class AuditEntry:
    decision_id: str
    actor: str
    action: str
    hash: str
    prev_hash: Optional[str]


def append_entry(
    decision_id: str,
    actor: str,
    action: str,
    prev_hash: Optional[str],
    secret_key: bytes,
) -> AuditEntry:
    entry = {"decision_id": decision_id, "actor": actor, "action": action}
    new_hash = compute_hash(entry, prev_hash, secret_key)
    return AuditEntry(
        decision_id=decision_id,
        actor=actor,
        action=action,
        hash=new_hash,
        prev_hash=prev_hash,
    )


@dataclass
class ChainVerificationResult:
    valid: bool
    broken_at_index: Optional[int]


def verify_chain(entries: list[AuditEntry], secret_key: bytes) -> ChainVerificationResult:
    """Walk the chain in order, recomputing each hash. Returns the first broken link, if any."""
    prev_hash: Optional[str] = None
    for i, e in enumerate(entries):
        expected = compute_hash(
            {"decision_id": e.decision_id, "actor": e.actor, "action": e.action},
            prev_hash,
            secret_key,
        )
        if expected != e.hash or e.prev_hash != prev_hash:
            return ChainVerificationResult(valid=False, broken_at_index=i)
        prev_hash = e.hash
    return ChainVerificationResult(valid=True, broken_at_index=None)
