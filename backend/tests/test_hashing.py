"""
Tests for the tamper-evident audit chain — including the "snap the chain"
demo moment the UI/UX brief and Implementation Plan both call out.
"""
from app.services.hashing import append_entry, verify_chain

SECRET = b"test-secret-key"


def build_clean_chain():
    entries = []
    prev_hash = None
    for i, action in enumerate(["ingested", "negotiated", "auto_executed"]):
        entry = append_entry(
            decision_id="decision-1", actor="agent", action=action, prev_hash=prev_hash, secret_key=SECRET
        )
        entries.append(entry)
        prev_hash = entry.hash
    return entries


def test_clean_chain_verifies():
    entries = build_clean_chain()
    result = verify_chain(entries, SECRET)
    assert result.valid is True
    assert result.broken_at_index is None


def test_tampering_with_a_middle_entry_breaks_verification_from_that_point():
    entries = build_clean_chain()
    # Tamper: someone edits entry[1]'s action after the fact
    entries[1].action = "auto_executed"  # was "negotiated"

    result = verify_chain(entries, SECRET)
    assert result.valid is False
    assert result.broken_at_index == 1  # names the exact link that snapped


def test_reordering_entries_also_breaks_the_chain():
    entries = build_clean_chain()
    entries[0], entries[1] = entries[1], entries[0]

    result = verify_chain(entries, SECRET)
    assert result.valid is False
