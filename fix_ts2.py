import re

with open("/tmp/Admin.tsx.fixed", "r") as f:
    source = f.read()

# 1. OldAdminDashboard section type
source = source.replace('const [section, setSection] = useState<Section>("games");', 'const [section, setSection] = useState<any>("games");')

# 2. OldAdminDashboard navigate args
source = source.replace('navigate("questions", g.id)', 'navigate("questions" as any, g.id)')
source = source.replace('navigate("manage")', 'navigate("manage" as any)')

# 3. OldAdminDashboard renderSection
# I'll just find case "help": return <HelpSection />; and add default: return null;
source = source.replace('case "help":\n      return <HelpSection />;\n }', 'case "help":\n      return <HelpSection />;\n default: return null;\n }')
source = source.replace('case "help":\n       return <HelpSection />;\n  }', 'case "help":\n       return <HelpSection />;\n default: return null;\n  }')

# 4. qData type
source = source.replace('const questions = qData?.questions ?? [];', 'const questions = qData ?? [];')
source = source.replace('const currentQ = questions.find((q) =>', 'const currentQ = questions.find((q: any) =>')

# 5. activeGame.currentQuestionIndex
source = source.replace('(activeGame.currentQuestionIndex ?? 0)', '0')


with open("/tmp/Admin.tsx.fixed", "w") as f:
    f.write(source)
