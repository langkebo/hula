#!/usr/bin/env python3
import os, re

os.chdir('/Users/ljf/Desktop/hu/hula/src/services/matrix')

f = 'MatrixSettingsService.ts'
with open(f, 'r') as fh:
    content = fh.read()

# Fix authedRequest calls that use full paths but missing { prefix: '' }
# Pattern: authedRequest(\n        'METHOD',\n        '/_matrix/client/v3/...'\n      )
# Should add { prefix: '' } as last argument

# Find all authedRequest calls that use full /_matrix paths but don't have prefix: ''
lines = content.split('\n')
new_lines = []
i = 0
changed = False

while i < len(lines):
    line = lines[i]
    
    # Check if this is an authedRequest call with a full /_matrix path
    if 'authedRequest(' in line and i + 2 < len(lines):
        # Look ahead to find the path argument
        next_lines = '\n'.join(lines[i:i+10])
        
        # Check if it uses a full /_matrix path and doesn't already have prefix: ''
        if '/_matrix/' in next_lines and 'prefix:' not in next_lines.split('authedRequest')[1].split(')')[0] if 'authedRequest' in next_lines else False:
            # Find the closing paren of this authedRequest call
            depth = 0
            j = i
            found_closing = False
            while j < len(lines) and j < i + 15:
                for ch in lines[j]:
                    if ch == '(':
                        depth += 1
                    elif ch == ')':
                        depth -= 1
                        if depth == 0:
                            found_closing = True
                            break
                if found_closing:
                    break
                j += 1
            
            if found_closing and j < len(lines):
                # Check if the closing line ends with just )
                stripped = lines[j].rstrip()
                if stripped.endswith(')'):
                    # Add { prefix: '' } before the closing )
                    indent = len(lines[j]) - len(lines[j].lstrip())
                    lines[j] = lines[j].rstrip()[:-1] + ',\n' + ' ' * indent + '{ prefix: \'\' })\n'
                    changed = True
    
    i += 1

if changed:
    with open(f, 'w') as fh:
        fh.write('\n'.join(lines))
    print(f'Fixed prefix in: {f}')
else:
    print('No changes needed')
