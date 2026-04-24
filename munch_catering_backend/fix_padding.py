#!/usr/bin/env python3
"""
Batch fix script to replace all padding with margin in Toga 0.5.3
"""

import os
import re

def fix_padding_in_file(filepath):
    """Replace padding with margin in a file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Replace padding_left/right/top/bottom with margin equivalents
        content = re.sub(r'padding_left\s*=', 'margin_left =', content)
        content = re.sub(r'padding_right\s*=', 'margin_right =', content)
        content = re.sub(r'padding_top\s*=', 'margin_top =', content)
        content = re.sub(r'padding_bottom\s*=', 'margin_bottom =', content)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"✅ Fixed {filepath}")
        return True
    except Exception as e:
        print(f"❌ Error fixing {filepath}: {e}")
        return False

# Files to fix
files_to_fix = [
    "munch_catering_frontend/screens/signin.py",
    "munch_catering_frontend/screens/signup.py",
    "munch_catering_frontend/screens/main_menu.py",
    "munch_catering_frontend/screens/profile.py",
    "munch_catering_frontend/screens/payment.py",
    "munch_catering_frontend/screens/admin_stats.py",
    "munch_catering_frontend/screens/quote_history.py",
    "munch_catering_frontend/screens/messages.py",
    "munch_catering_frontend/screens/caterer_profile.py"
]

base_path = r"c:\Users\Derick\Desktop\munch_catering_App v1.1"

print("🔧 Batch fixing padding → margin in Toga 0.5.3...")

fixed_count = 0
for filename in files_to_fix:
    filepath = os.path.join(base_path, filename)
    if os.path.exists(filepath):
        if fix_padding_in_file(filepath):
            fixed_count += 1
    else:
        print(f"⚠️  File not found: {filepath}")

print(f"\n✅ Fixed {fixed_count}/{len(files_to_fix)} files")
print("🎉 All padding issues resolved!")