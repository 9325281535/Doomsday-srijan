"""
Sandbox-only verification runner (no pytest available in this environment).
Imports the real test classes from tests/ and executes every test_* method
manually with plain asserts. Your actual dev machine should just run `pytest`
against the files in tests/ directly — this script exists only to prove the
logic is correct right now, in this sandbox.
"""
import sys
import traceback

sys.path.insert(0, ".")

from tests import test_scenarios as ts
from tests import test_hashing as th
from tests import test_prioritization as tp

passed = 0
failed = 0
failures = []


def run_class(cls):
    global passed, failed
    instance = cls()
    for name in dir(instance):
        if name.startswith("test_"):
            if hasattr(instance, "setup_method"):
                instance.setup_method()
            try:
                getattr(instance, name)()
                passed += 1
                print(f"  PASS  {cls.__name__}.{name}")
            except Exception as e:
                failed += 1
                failures.append((f"{cls.__name__}.{name}", e))
                print(f"  FAIL  {cls.__name__}.{name}  -> {e}")


def run_module_functions(module):
    global passed, failed
    for name in dir(module):
        if name.startswith("test_"):
            fn = getattr(module, name)
            if callable(fn):
                try:
                    fn()
                    passed += 1
                    print(f"  PASS  {module.__name__}.{name}")
                except Exception as e:
                    failed += 1
                    failures.append((f"{module.__name__}.{name}", e))
                    print(f"  FAIL  {module.__name__}.{name}  -> {e}")


print("=== test_scenarios.py ===")
for cls_name in [
    "TestScenario1Baseline",
    "TestScenario3AdversarialClaim",
    "TestScenario5BudgetEscalation",
    "TestScenario2ReplanningOnCorrectedInventory",
    "TestSafetyStockRule",
    "TestConstraintRulesNeverBypassed",
]:
    run_class(getattr(ts, cls_name))

print("\n=== test_hashing.py ===")
run_module_functions(th)

print("\n=== test_prioritization.py ===")
run_module_functions(tp)

print(f"\n{'='*50}\n{passed} passed, {failed} failed\n{'='*50}")

if failures:
    print("\nFAILURE DETAILS:")
    for name, exc in failures:
        print(f"\n--- {name} ---")
        traceback.print_exception(type(exc), exc, exc.__traceback__)
    sys.exit(1)
else:
    print("\nAll deterministic core logic verified against the 4 seeded PS scenarios.")
