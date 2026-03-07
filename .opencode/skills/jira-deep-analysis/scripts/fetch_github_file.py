#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_github_file.py — 取得 GitHub 檔案內容（含上下文行）

從 GitHub Contents API 取得特定檔案的指定行數附近內容，輸出 JSON 至 stdout。
適合在取得 search_github.py 搜尋結果後，進一步讀取特定檔案片段。

用法:
    python fetch_github_file.py <owner/repo> <path> <line> [--context N] [--ref REF]

範例:
    python fetch_github_file.py facebook/openbmc common/recipes-core/sensor-util/sensor-util.c 42
    python fetch_github_file.py facebook/OpenBIC src/platform/plat_class.c 100 --context 20
    python fetch_github_file.py facebook/openbmc some/file.c 42 --ref main

認證 (從 .env 讀取，或設定環境變數):
    GITHUB_TOKEN=your_token_here

輸出格式 (JSON):
    {
        "repo": "facebook/openbmc",
        "path": "common/recipes-core/sensor-util/sensor-util.c",
        "start_line": 32,
        "end_line": 52,
        "total_lines": 348,
        "content": "... 程式碼片段 ..."
    }

需求: pip install requests python-dotenv
"""

import os
import sys
import json
import base64
import argparse
from typing import Any, NoReturn
import requests

try:
    from dotenv import load_dotenv
    _script_dir = os.path.dirname(os.path.abspath(__file__))
    _env_path = os.path.join(_script_dir, '.env')
    if os.path.exists(_env_path):
        load_dotenv(_env_path)
    else:
        load_dotenv()
except ImportError:
    pass


GITHUB_API_URL = "https://api.github.com"


def get_token() -> str:
    token = os.getenv('GITHUB_TOKEN', '')
    if not token:
        _error("缺少 GITHUB_TOKEN 環境變數。\n"
               "請在 .env 檔案中設定 GITHUB_TOKEN=your_token")
    return token


def fetch_file_content(repo: str, path: str, line: int,
                       context_lines: int = 10, token: str = '', ref: str | None = None) -> dict[str, object]:
    """
    從 GitHub 取得檔案指定行附近的程式碼片段。

    Args:
        repo: Repository (格式: owner/repo)
        path: 檔案路徑
        line: 目標行號 (1-indexed)
        context_lines: 上下各取幾行 (預設 10)
        token: GitHub token
        ref: Git ref (branch / tag / commit SHA)

    Returns:
        包含 content, start_line, end_line, total_lines 的 dict
    """
    url = f"{GITHUB_API_URL}/repos/{repo}/contents/{path}"
    headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': f'Bearer {token}',
        'X-GitHub-Api-Version': '2022-11-28'
    }
    params: dict[str, str] = {}
    if ref:
        params['ref'] = ref

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        if resp.status_code == 404:
            _error(f"檔案不存在：{repo}/{path}")
        if resp.status_code == 401:
            _error("GitHub Token 認證失敗 (HTTP 401)。")
        if not resp.ok:
            _error(f"API 錯誤 (HTTP {resp.status_code})：{resp.text[:200]}")
        data = resp.json()
    except requests.Timeout:
        _error(f"連線逾時 (15s)：{repo}/{path}")
    except requests.ConnectionError as e:
        _error(f"連線失敗：{e}")

    file_content = _decode_content(data, repo, path)

    lines = file_content.split('\n')
    total_lines = len(lines)

    # 計算擷取範圍（0-indexed）
    start_idx = max(0, line - 1 - context_lines)
    end_idx = min(total_lines, line - 1 + context_lines + 1)
    extracted = lines[start_idx:end_idx]

    return {
        'repo': repo,
        'path': path,
        'start_line': start_idx + 1,   # 轉回 1-indexed
        'end_line': end_idx,
        'total_lines': total_lines,
        'content': '\n'.join(extracted)
    }


def _decode_content(data: dict[str, Any], repo: str, path: str) -> str:
    """解碼 GitHub Contents API 回傳的檔案內容。"""
    if data.get('encoding') == 'base64' and data.get('content'):
        try:
            return base64.b64decode(data['content']).decode('utf-8')
        except UnicodeDecodeError:
            _error(f"無法解碼檔案（二進位或非 UTF-8）：{repo}/{path}")

    # 檔案太大時，使用 download_url fallback
    download_url = data.get('download_url')
    if download_url:
        try:
            dl_resp = requests.get(download_url, timeout=30)
            if dl_resp.ok:
                return dl_resp.text
        except requests.RequestException as e:
            _error(f"無法透過 download_url 取得檔案：{e}")

    _error(f"無法取得檔案內容（檔案可能過大或編碼特殊）：{repo}/{path}")


def _error(message: str) -> NoReturn:
    print(f"[ERROR] {message}", file=sys.stderr)
    sys.exit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='取得 GitHub 檔案內容（指定行附近的程式碼片段），JSON 輸出',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
範例:
  python fetch_github_file.py facebook/openbmc common/recipes-core/sensor-util/sensor-util.c 42
  python fetch_github_file.py facebook/OpenBIC src/platform/plat_class.c 100 --context 20
        """
    )
    parser.add_argument('repo', metavar='OWNER/REPO', help='Repository（格式: owner/repo）')
    parser.add_argument('path', metavar='PATH', help='檔案路徑（相對於 repo 根目錄）')
    parser.add_argument('line', type=int, metavar='LINE', help='目標行號（1-indexed）')
    parser.add_argument('--context', type=int, default=10, metavar='N',
                        help='上下各取幾行（預設 10）')
    parser.add_argument('--ref', metavar='REF',
                        help='Git ref（branch / tag / commit SHA）')

    args = parser.parse_args()

    if args.line < 1:
        _error("LINE 必須 >= 1")

    token = get_token()
    result = fetch_file_content(args.repo, args.path, args.line,
                                context_lines=args.context, token=token, ref=args.ref)
    print(json.dumps(result, ensure_ascii=False, indent=2))
