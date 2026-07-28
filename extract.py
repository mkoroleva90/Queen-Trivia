import re

def extract_function(source, func_name):
    # Matches "function FuncName(" or "const FuncName = "
    pattern = r'(function\s+' + func_name + r'\s*\(|const\s+' + func_name + r'\s*=\s*\([^)]*\)\s*=>)'
    match = re.search(pattern, source)
    if not match:
        return None, None, None
    start_idx = match.start()
    
    # Simple brace counting
    brace_count = 0
    in_string = False
    string_char = ''
    in_jsx = False
    
    # Find first brace
    first_brace = source.find('{', start_idx)
    if first_brace == -1:
        return None, None, None
        
    brace_count = 1
    idx = first_brace + 1
    
    while idx < len(source) and brace_count > 0:
        char = source[idx]
        
        # very basic string handling
        if (char == '"' or char == "'" or char == "`") and source[idx-1] != '\\':
            if not in_string:
                in_string = True
                string_char = char
            elif string_char == char:
                in_string = False
                
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                
        idx += 1
        
    return start_idx, idx, source[start_idx:idx]

with open('/tmp/Admin.tsx', 'r') as f:
    source = f.read()

start, end, content = extract_function(source, "AdminDashboard")
print("AdminDashboard:", start, end)

start, end, content = extract_function(source, "ManageGamesSection")
print("ManageGamesSection:", start, end)
