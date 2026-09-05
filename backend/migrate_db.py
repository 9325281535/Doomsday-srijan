import sqlite3

conn = sqlite3.connect('trace_scda_dev.db')

# Check existing tables
tables = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print('Existing tables:', tables)

# Add tool_call_count column to decisions
try:
    conn.execute('ALTER TABLE decisions ADD COLUMN tool_call_count INTEGER DEFAULT 0')
    print('SUCCESS: Added tool_call_count column to decisions')
except Exception as e:
    print(f'tool_call_count: {e}')

# Create supplier_trust_events table if missing
if 'supplier_trust_events' not in tables:
    conn.execute('''CREATE TABLE supplier_trust_events (
        id VARCHAR(36) PRIMARY KEY,
        supplier_id VARCHAR NOT NULL,
        po_id VARCHAR,
        decision_id VARCHAR,
        event_type VARCHAR NOT NULL,
        details TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(supplier_id) REFERENCES suppliers(supplier_id),
        FOREIGN KEY(decision_id) REFERENCES decisions(id)
    )''')
    print('SUCCESS: Created supplier_trust_events table')
else:
    print('supplier_trust_events already exists')

# Create production_orders table if missing  
if 'production_orders' not in tables:
    conn.execute('''CREATE TABLE production_orders (
        id VARCHAR(36) PRIMARY KEY,
        production_order_id VARCHAR UNIQUE NOT NULL,
        product VARCHAR NOT NULL,
        required_component VARCHAR NOT NULL,
        units_planned INTEGER NOT NULL,
        component_required_per_unit INTEGER DEFAULT 1,
        deadline DATE NOT NULL,
        priority VARCHAR NOT NULL CHECK(priority IN ('low','medium','high')),
        status VARCHAR DEFAULT 'on_track' CHECK(status IN ('on_track','at_risk','stopped','rescheduled')),
        FOREIGN KEY(required_component) REFERENCES components(component_id)
    )''')
    print('SUCCESS: Created production_orders table')
else:
    print('production_orders already exists')

conn.commit()

# Verify
cols = [row[1] for row in conn.execute('PRAGMA table_info(decisions)').fetchall()]
print('\nFinal decision columns:', cols)
print('Has tool_call_count:', 'tool_call_count' in cols)

tables_final = [row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print('Final tables:', tables_final)

conn.close()
print('\nDatabase migration complete!')
