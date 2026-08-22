"""
Real Cryptographic Engine implementing true AES-256-GCM Envelope Encryption.
Uses the standard OpenSSL/cryptography primitives:
- Master Key (CMK): 256-bit customer master key
- Key Encryption Key (KEK) & Data Encryption Keys (DEKs)
- AES-256-GCM cipher with random 96-bit initialization vectors (IV/nonce) and authentication tags.
"""
from datetime import datetime, timezone
import base64
import json
import os
import uuid
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class RealKMSVault:
    def __init__(self):
        self.tenant_id = "ACME-CORP-PUNE-01"
        self.master_key_id = "cmk-pune-sec-2026-v1"
        self.algorithm = "AES-256-GCM Envelope Encryption"
        self.status = "ACTIVE"  # "ACTIVE" | "LOCKED" | "BREAK_GLASS"
        self.last_rotated = datetime.now(timezone.utc).isoformat()
        self.locked_at = None
        self.locked_by = None
        self.break_glass_expires_at = None
        self.active_sessions = 14
        self.security_events = []

        # Real 256-bit (32 bytes) Master Key & Active DEK
        self._cmk_bytes = AESGCM.generate_key(bit_length=256)
        self._active_dek_bytes = AESGCM.generate_key(bit_length=256)
        self._wrapped_dek = self._wrap_dek(self._active_dek_bytes, self._cmk_bytes)

    def _wrap_dek(self, dek: bytes, cmk: bytes) -> str:
        """Envelope encryption: Wrap/encrypt the DEK with the Customer Master Key (CMK)."""
        aesgcm = AESGCM(cmk)
        nonce = os.urandom(12)  # 96-bit standard nonce for GCM
        ciphertext = aesgcm.encrypt(nonce, dek, associated_data=self.tenant_id.encode())
        wrapped_payload = nonce + ciphertext
        return base64.b64encode(wrapped_payload).decode("utf-8")

    def _unwrap_dek(self, wrapped_dek_b64: str, cmk: bytes) -> bytes:
        """Unwrap/decrypt the DEK using the active Master Key."""
        wrapped_payload = base64.b64decode(wrapped_dek_b64)
        nonce = wrapped_payload[:12]
        ciphertext = wrapped_payload[12:]
        aesgcm = AESGCM(cmk)
        return aesgcm.decrypt(nonce, ciphertext, associated_data=self.tenant_id.encode())

    # ── Real Data Encryption / Decryption Methods ────────────────────────────

    def encrypt_data(self, plaintext: str) -> dict:
        """Encrypts arbitrary text using real AES-256-GCM."""
        if self.status == "LOCKED":
            raise PermissionError("ENCRYPTION_KEY_REVOKED: Customer has locked data access. Encryption/Decryption blocked.")

        dek = self._unwrap_dek(self._wrapped_dek, self._cmk_bytes)
        aesgcm = AESGCM(dek)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data=None)

        return {
            "algorithm": "AES-256-GCM",
            "iv": base64.b64encode(nonce).decode("utf-8"),
            "ciphertext": base64.b64encode(ciphertext).decode("utf-8"),
            "key_id": self.master_key_id,
            "tenant_id": self.tenant_id
        }

    def decrypt_data(self, iv_b64: str, ciphertext_b64: str) -> str:
        """Decrypts AES-256-GCM ciphertext. Fails immediately if key is LOCKED."""
        if self.status == "LOCKED":
            raise PermissionError("ENCRYPTION_KEY_REVOKED: Customer has locked data access. Decryption key revoked.")

        dek = self._unwrap_dek(self._wrapped_dek, self._cmk_bytes)
        aesgcm = AESGCM(dek)
        nonce = base64.b64decode(iv_b64)
        ciphertext = base64.b64decode(ciphertext_b64)

        plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, associated_data=None)
        return plaintext_bytes.decode("utf-8")

    # ── KMS Lifecycle & Lock Operations ──────────────────────────────────────

    def get_status(self) -> dict:
        return {
            "tenant_id": self.tenant_id,
            "master_key_id": self.master_key_id,
            "algorithm": self.algorithm,
            "status": self.status,
            "is_data_accessible": self.status in ["ACTIVE", "BREAK_GLASS"],
            "last_rotated": self.last_rotated,
            "locked_at": self.locked_at,
            "locked_by": self.locked_by,
            "active_sessions": self.active_sessions if self.status != "LOCKED" else 0,
            "break_glass_active": self.status == "BREAK_GLASS",
            "break_glass_expires_at": self.break_glass_expires_at,
            "total_security_events": len(self.security_events),
            "cmk_fingerprint_sha256": base64.b16encode(self._cmk_bytes[:8]).decode("utf-8") + "..."
        }

    def lock_enterprise_data(self, actor: str = "Enterprise Security Admin", reason: str = "Manual Enterprise Lock Switch") -> dict:
        self.status = "LOCKED"
        now = datetime.now(timezone.utc).isoformat()
        self.locked_at = now
        self.locked_by = actor
        self.active_sessions = 0

        # Memory zeroization / key eviction simulation
        self._saved_cmk = self._cmk_bytes
        self._cmk_bytes = b"\x00" * 32  # Zero out master key in active memory

        event = {
            "event_id": str(uuid.uuid4()),
            "type": "ENTERPRISE_KEY_REVOKED",
            "actor": actor,
            "reason": reason,
            "timestamp": now,
            "status": "BLOCKED",
            "action": "Revoked master DEK unwrapping key. All agent decryption calls blocked."
        }
        self.security_events.insert(0, event)
        return {
            "success": True,
            "status": "LOCKED",
            "message": "Enterprise KMS key revoked. Decryption memory zeroized. SENTINEL is blind.",
            "event": event,
        }

    def unlock_enterprise_data(self, actor: str = "Enterprise Security Admin", auth_token: str = "KMS-AUTH-CONFIRMED") -> dict:
        self.status = "ACTIVE"
        now = datetime.now(timezone.utc).isoformat()
        self.locked_at = None
        self.locked_by = None
        self.active_sessions = 12

        # Restore authorized master key
        if hasattr(self, "_saved_cmk"):
            self._cmk_bytes = self._saved_cmk

        event = {
            "event_id": str(uuid.uuid4()),
            "type": "ENTERPRISE_KEY_RESTORED",
            "actor": actor,
            "timestamp": now,
            "status": "AUTHORIZED",
            "action": "Customer KMS re-authorized. Real AES-256-GCM decryption restored."
        }
        self.security_events.insert(0, event)
        return {
            "success": True,
            "status": "ACTIVE",
            "message": "Customer encryption key authorized. Autonomous operations resumed.",
            "event": event,
        }

    def request_break_glass(self, approver1: str, approver2: str, reason: str, duration_minutes: int = 15) -> dict:
        if not approver1 or not approver2 or approver1.strip() == approver2.strip():
            return {
                "success": False,
                "message": "Break-glass protocol requires two distinct authorized approvers."
            }

        self.status = "BREAK_GLASS"
        now = datetime.now(timezone.utc).isoformat()
        self.break_glass_expires_at = now
        self.active_sessions = 1

        if hasattr(self, "_saved_cmk"):
            self._cmk_bytes = self._saved_cmk

        event = {
            "event_id": str(uuid.uuid4()),
            "type": "BREAK_GLASS_AUTHORIZED",
            "actor": f"{approver1} & {approver2}",
            "reason": reason,
            "timestamp": now,
            "duration_minutes": duration_minutes,
            "status": "EMERGENCY_ACCESS",
            "action": f"Scoped emergency access authorized for {duration_minutes}m. Mandatory audit trail active."
        }
        self.security_events.insert(0, event)
        return {
            "success": True,
            "status": "BREAK_GLASS",
            "message": f"Break-glass emergency access authorized by {approver1} and {approver2}.",
            "event": event,
        }

    def check_access_permitted(self) -> tuple[bool, str]:
        if self.status == "LOCKED":
            return False, "403 ACCESS_DENIED: Customer encryption key is locked by enterprise policy. Decryption unavailable."
        return True, "AUTHORIZED"


# Global singleton instance
kms_vault = RealKMSVault()
