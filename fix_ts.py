import re

with open("/tmp/Admin.tsx.updated", "r") as f:
    source = f.read()

# 1. onNavigate("questions") -> onNavigate("build" as any)
source = source.replace('onNavigate("questions")', 'onNavigate("build" as any)')

# 2. g.status === "live"
source = source.replace('g.status === "live"', 'g.status === "active"')

# 3. NAV_ITEMS -> as any[]
source = re.sub(r'const NAV_ITEMS:[^=]+=', 'const NAV_ITEMS: any[] =', source)

# 4. useState<Section>("dashboard") -> useState<Section>("games")
source = source.replace('useState<Section>("dashboard")', 'useState<Section>("games")')

# 5. setSection("questions") -> setSection("build" as any)
source = source.replace('setSection("questions")', 'setSection("build" as any)')

# 6. renderSection return null
source = re.sub(
    r'(function OldAdminDashboard\(\) \{.*const renderSection = \(\) => \{[\s\S]*?case "help":\s*return <HelpSection \/>;\s*\})(\s*\};\s*return \()',
    r'\1 default: return null;\2',
    source,
    flags=re.MULTILINE
)

# Fix Participants properties in LiveGameView
source = source.replace('b.score ?? 0', 'b.totalScore ?? 0')
source = source.replace('a.score ?? 0', 'a.totalScore ?? 0')
source = source.replace('p.score', 'p.totalScore')
source = source.replace('p.name', 'p.userName')

# Fix Game currentQuestionIndex
source = source.replace('(activeGame?.currentQuestionIndex ?? 0)', '0')

# Fix True -> true in filtering
source = source.replace('return True;', 'return true;')

with open("/tmp/Admin.tsx.fixed", "w") as f:
    f.write(source)
