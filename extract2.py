import re

def extract_function(source, func_name):
    # Matches "function FuncName(" or "const FuncName = "
    pattern = r'function\s+' + func_name + r'\s*\([^)]*\)\s*\{'
    # Try regex first for simple ones, but args can have {} inside.
    # Actually, we can just find "function FuncName"
    start_match = re.search(r'function\s+' + func_name + r'\b', source)
    if not start_match:
        return None, None
        
    start_idx = start_match.start()
    
    # We will just count all braces from function start. Wait, the first { might be in args.
    # So we need to parse until function body ends. 
    # Function body ends when brace_count == 0, but it might go to 0 during args!
    # E.g. function Foo({ a }) { ... }
    # So we need to keep track of parens too.
    paren_count = 0
    brace_count = 0
    idx = start_idx
    started_parens = False
    started_braces = False
    
    in_string = False
    string_char = ''
    
    while idx < len(source):
        char = source[idx]
        if (char == '"' or char == "'" or char == "`") and source[idx-1] != '\\':
            if not in_string:
                in_string = True
                string_char = char
            elif string_char == char:
                in_string = False
                
        if not in_string:
            if char == '(':
                paren_count += 1
                started_parens = True
            elif char == ')':
                paren_count -= 1
            elif char == '{':
                brace_count += 1
                started_braces = True
            elif char == '}':
                brace_count -= 1
                if started_braces and brace_count == 0 and paren_count == 0:
                    return start_idx, idx + 1
        idx += 1
    return None, None

with open('/tmp/Admin.tsx', 'r') as f:
    source = f.read()

funcs = ["AdminDashboard", "ManageGamesSection", "SettingsSection", "ResultsSection"]
for fn in funcs:
    start, end = extract_function(source, fn)
    print(f"{fn}: {start} to {end}")

