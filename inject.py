import re

with open("/tmp/Admin.tsx", "r") as f:
    source = f.read()

# Replace Section type
source = re.sub(
    r'type Section = "dashboard" \| "create" \| "manage" \| "questions" \| "review" \| "results" \| "help";',
    r'type Section = "games" | "live" | "build" | "results" | "rooms";',
    source
)

# Rename old AdminDashboard to OldAdminDashboard
admin_dash_idx = source.find("function AdminDashboard()")
if admin_dash_idx != -1:
    source = source[:admin_dash_idx] + "function OldAdminDashboard()" + source[admin_dash_idx + len("function AdminDashboard()"):]

# Change the export at the bottom
export_idx = source.find("export default function Admin() {")
if export_idx != -1:
    source = source[:export_idx] + """
// ─── NEW COMPONENT CODE INJECTED HERE ───
// placeholder_to_replace

export default function Admin() {
    const { isAdmin } = useAuth();
    return isAdmin ? <NewAdminDashboard /> : <AdminGate />;
}
"""

with open("new_components.tsx", "r") as f:
    new_comps = f.read()

source = source.replace("// placeholder_to_replace", new_comps)

with open("/tmp/Admin.tsx.updated", "w") as f:
    f.write(source)
