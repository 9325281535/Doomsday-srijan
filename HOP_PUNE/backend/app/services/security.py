"""
SENTINEL Security & Trust Fabric Services.
Implements:
1. Customer-controlled Enterprise Key Lock (KMS abstraction)
2. Intent Firewall (validates request specificity, rejects overbroad queries)
3. Purpose-bound Data Minimization & Policy Engine
4. Break-Glass emergency access management
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
import uuid

# In-memory KMS & Policy state for the demo
_ENTERPRISE_KEY_STATE = {
    "status": "ACTIVE",  # ACTIVE | LOCKED | BREAK_GLASS
    "key_id": "KMS-KEY-PUNE-PLANT-01",
    "algorithm": "AES-256-GCM (Envelope Encrypted)",
    "last_rotated": "2026-08-23T00:00:00Z",
    "locked_at": None,
    "locked_by": None,
    "break_glass": None,
}

_SECURITY_AUDIT_EVENTS: List[Dict[str, Any]] = [
    {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": "KMS_INIT",
        "actor": "system",
        "details": "Customer Master Key initialized. Envelope encryption active.",
        "status": "SUCCESS"
    }
]

def get_key_status() -> Dict[str, Any]:
    # Check if break-glass expired
    bg = _ENTERPRISE_KEY_STATE.get("break_glass")
    if bg and bg.get("expires_at"):
        exp = datetime.fromisoformat(bg["expires_at"])
        if datetime.now(timezone.utc) > exp:
            _ENTERPRISE_KEY_STATE["status"] = "LOCKED"
            _ENTERPRISE_KEY_STATE["break_glass"] = None
            log_security_event("BREAK_GLASS_EXPIRED", "system", "Break-glass window expired. Re-locked.", "SUCCESS")
            
    return _ENTERPRISE_KEY_STATE

def lock_enterprise_data(actor: str = "security_admin") -> Dict[str, Any]:
    _ENTERPRISE_KEY_STATE["status"] = "LOCKED"
    _ENTERPRISE_KEY_STATE["locked_at"] = datetime.now(timezone.utc).isoformat()
    _ENTERPRISE_KEY_STATE["locked_by"] = actor
    _ENTERPRISE_KEY_STATE["break_glass"] = None
    
    log_security_event(
        event_type="ENTERPRISE_LOCK_ENGAGED",
        actor=actor,
        details="Customer revoked KMS decryption token. All agent data access blocked.",
        status="LOCKED"
    )
    return _ENTERPRISE_KEY_STATE

def unlock_enterprise_data(actor: str = "security_admin") -> Dict[str, Any]:
    _ENTERPRISE_KEY_STATE["status"] = "ACTIVE"
    _ENTERPRISE_KEY_STATE["locked_at"] = None
    _ENTERPRISE_KEY_STATE["locked_by"] = None
    _ENTERPRISE_KEY_STATE["break_glass"] = None
    
    log_security_event(
        event_type="ENTERPRISE_LOCK_RELEASED",
        actor=actor,
        details="Customer KMS key re-authorized. Agent data access restored.",
        status="ACTIVE"
    )
    return _ENTERPRISE_KEY_STATE

def request_break_glass(actor: str, reason: str, duration_minutes: int = 15) -> Dict[str, Any]:
    expires = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
    _ENTERPRISE_KEY_STATE["status"] = "BREAK_GLASS"
    _ENTERPRISE_KEY_STATE["break_glass"] = {
        "requested_by": actor,
        "reason": reason,
        "duration_minutes": duration_minutes,
        "expires_at": expires.isoformat(),
        "scope": "Emergency Supply Chain Disruption Containment"
    }
    
    log_security_event(
        event_type="BREAK_GLASS_ACTIVATED",
        actor=actor,
        details=f"Emergency break-glass access granted for {duration_minutes}m. Reason: {reason}",
        status="WARNING"
    )
    return _ENTERPRISE_KEY_STATE

def log_security_event(event_type: str, actor: str, details: str, status: str):
    event = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "actor": actor,
        "details": details,
        "status": status
    }
    _SECURITY_AUDIT_EVENTS.insert(0, event)
    return event

def get_security_audit_logs() -> List[Dict[str, Any]]:
    return _SECURITY_AUDIT_EVENTS

def check_intent_firewall(prompt_or_query: str) -> Dict[str, Any]:
    """
    Evaluates prompts for excessive scope, prompt injection, or overbroad data dumping.
    """
    vague_keywords = [
        "give me database", "dump database", "export all", "show all users",
        "give me all data", "select * from", "drop table", "passwords",
        "employee payroll", "salary", "customer personal data"
    ]
    
    query_lower = prompt_or_query.lower()
    
    for kw in vague_keywords:
        if kw in query_lower:
            return {
                "decision": "BLOCKED",
                "risk_level": "CRITICAL",
                "reason": "Request scope violates Data Minimization (GDPR Art. 25 / DPDP) and OWASP LLM01/LLM06 rules.",
                "clarification_prompt": "Your request is too broad or contains sensitive unauthorized domains. Please specify the exact component ID, disruption PO, and business purpose."
            }
            
    return {
        "decision": "AUTHORIZED",
        "risk_level": "LOW",
        "reason": "Request is specific, purpose-bound, and within supply chain operational domain.",
        "clarification_prompt": None
    }
