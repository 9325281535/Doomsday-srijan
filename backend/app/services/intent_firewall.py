"""
Intent Firewall & Data Minimization Engine.
Inspects incoming natural language prompts to block overly-broad queries
(e.g., 'give me database of company') and enforces purpose-bound scoping.
"""
import re
from typing import Optional

# Prohibited/overly-broad pattern signatures
BROAD_PATTERNS = [
    (r"\b(give|dump|export|show|get|extract|fetch)\s+(me\s+)?(all\s+)?(the\s+)?(company\s+)?(database|db|data|records|tables)\b", "REQUEST_TOO_BROAD_DATABASE_DUMP"),
    (r"\b(dump|export|give)\s+(all|entire|every)\s+(suppliers?|orders?|pos?|employees?|customers?|credentials?)\b", "REQUEST_TOO_BROAD_MASS_EXTRACTION"),
    (r"\b(who\s+are\s+all\s+employees|employee\s+passwords|payroll|salary|api\s*keys?)\b", "UNAUTHORIZED_SENSITIVE_RESOURCE"),
    (r"\b(drop|delete|truncate|alter)\s+(table|database|all)\b", "DESTRUCTIVE_COMMAND_ATTEMPT"),
]

class IntentFirewall:
    def inspect_prompt(self, prompt: str, user_role: str = "Procurement Manager", purpose: Optional[str] = None) -> dict:
        clean_prompt = prompt.strip()
        lower_prompt = clean_prompt.lower()
        
        # 1. Pattern inspection
        for pattern, threat_type in BROAD_PATTERNS:
            if re.search(pattern, lower_prompt):
                return {
                    "verdict": "DENIED",
                    "status": "BLOCKED_BY_INTENT_FIREWALL",
                    "threat_type": threat_type,
                    "reason": "This request is too broad or attempts unrestricted mass data extraction.",
                    "explanation": (
                        "SENTINEL enforces least-privilege data access under OWASP & GDPR Data Minimisation principles. "
                        "The LLM is blocked from retrieving unrestricted databases without specific incident identifiers and business purpose."
                    ),
                    "required_action": "Specify the required component (e.g. COMP-104), active production order (e.g. PROD-882), and declared business purpose.",
                    "allowed_examples": [
                        "Find alternate suppliers for COMP-104 with lead time < 5 days",
                        "Show delayed purchase orders for PROD-882",
                        "Check stock shortfall for component COMP-205"
                    ],
                    "purpose_bound_ticket": None
                }
        
        # 2. Specificity and Purpose Scoping
        is_specific = any(token in clean_prompt.upper() for token in ["COMP-", "PROD-", "PO-", "SUP-", "DELAY", "DISRUPT", "INVENTORY", "STOCK", "SHORTFALL"])
        
        if not is_specific and len(clean_prompt.split()) < 4:
            return {
                "verdict": "AMBIGUOUS",
                "status": "CLARIFICATION_REQUIRED",
                "threat_type": "INSUFFICIENT_CONTEXT",
                "reason": "Prompt lacks specific target parameters or purpose context.",
                "explanation": "To prevent accidental over-fetching, please declare the component or order ID.",
                "required_action": "Provide specific reference IDs (e.g. COMP-104, PO-7712).",
                "allowed_examples": [
                    "Check suppliers for COMP-104",
                    "Verify tracking on PO-7712"
                ],
                "purpose_bound_ticket": None
            }

        # 3. Purpose-Bound Ticket Creation (GDPR Art. 25 & DPDP Principle of Purpose Limitation)
        declared_purpose = purpose or "resolve_supply_chain_disruption"
        
        # Determine minimized resource scope based on prompt
        resources = []
        if "SUP" in clean_prompt.upper() or "SUPPLIER" in lower_prompt:
            resources.append("supplier_catalog")
        if "PO" in clean_prompt.upper() or "ORDER" in lower_prompt:
            resources.append("purchase_orders")
        if "COMP" in clean_prompt.upper() or "STOCK" in lower_prompt or "INVENTORY" in lower_prompt:
            resources.append("inventory_coverage")
        if not resources:
            resources = ["disruption_telemetry"]

        purpose_ticket = {
            "ticket_id": f"PB-{abs(hash(clean_prompt)) % 100000:05d}",
            "declared_purpose": declared_purpose,
            "authorized_role": user_role,
            "scoped_resources": resources,
            "minimized_fields": [
                "component_id",
                "supplier_id",
                "lead_time_days",
                "unit_price",
                "available_quantity",
                "quality_score",
                "reliability_score"
            ],
            "excluded_unauthorized_fields": [
                "internal_margins",
                "employee_pii",
                "billing_credentials",
                "unrelated_tenant_orders"
            ],
            "session_ttl": "incident_scope"
        }

        return {
            "verdict": "AUTHORIZED",
            "status": "PASSED_INTENT_FIREWALL",
            "threat_type": None,
            "reason": "Request is specific, purpose-bound, and scoped under least-privilege.",
            "explanation": "Intent verified. Data access minimized to authorized incident parameters.",
            "required_action": "Proceed with autonomous resolution.",
            "allowed_examples": [],
            "purpose_bound_ticket": purpose_ticket
        }


intent_firewall = IntentFirewall()
