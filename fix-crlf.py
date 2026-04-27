#!/usr/bin/env python3
"""
fix-crlf.py
修改 JSX/JS 檔案後的安全驗證腳本。
用法：python3 fix-crlf.py src/pages/admin/Registrants.jsx
"""
import sys, os, subprocess

def fix_and_verify(filepath):
    abs_path = os.path.abspath(filepath)
    if not os.path.exists(abs_path):
        print(f"❌ 找不到檔案：{abs_path}")
        return False

    # 1. 讀取並正規化換行
    with open(abs_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_len = len(content)
    content = content.replace('\r\n', '\n').replace('\r', '\n')

    with open(abs_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

    lines = content.splitlines()
    print(f"✅ CRLF 正規化完成：{abs_path}")
    print(f"   總行數：{len(lines)}")

    # 2. 檢查結尾是否完整（最後非空行應為 }）
    non_empty = [l for l in lines if l.strip()]
    last_line = non_empty[-1].strip() if non_empty else ''
    if last_line == '}':
        print(f"✅ 結尾正常：最後有效行為 `{last_line}`")
    else:
        print(f"⚠️  結尾異常：最後有效行為 `{last_line}`（預期為 `}}`）")
        print("   最後 5 行：")
        for l in lines[-5:]:
            print(f"   {repr(l)}")
        return False

    # 3. 顯示 git diff 狀態
    result = subprocess.run(
        ['git', 'diff', '--stat', 'HEAD', filepath],
        capture_output=True, text=True,
        cwd=os.path.dirname(abs_path) or '.'
    )
    if result.stdout.strip():
        print(f"✅ git 偵測到變更：{result.stdout.strip()}")
    else:
        print("ℹ️  git diff 無變更（可能已是最新或尚未 stage）")

    return True

if __name__ == '__main__':
    targets = sys.argv[1:] or [
        'src/pages/admin/Registrants.jsx',
        'src/pages/admin/CheckinRecords.jsx',
        'src/pages/pwa/CheckinMain.jsx',
        'src/pages/pwa/QrScanner.jsx',
        'src/lib/excel.js',
    ]
    all_ok = True
    for t in targets:
        ok = fix_and_verify(t)
        if not ok:
            all_ok = False
    print()
    print("✅ 全部通過，可安全 commit。" if all_ok else "❌ 有檔案異常，請先修正再 commit。")
