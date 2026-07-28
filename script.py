import re

def main():
    with open('/tmp/Admin.tsx', 'r') as f:
        content = f.read()
    
    # 1. Update Section type
    content = re.sub(
        r'type Section = "dashboard" \| "create" \| "manage" \| "questions" \| "review" \| "results" \| "help";',
        r'type Section = "games" | "live" | "build" | "results" | "rooms";',
        content
    )

    # We need to build the python replacement chunks to replace the exact text
    
    with open('/tmp/Admin.tsx.updated', 'w') as f:
        f.write(content)

if __name__ == "__main__":
    main()
