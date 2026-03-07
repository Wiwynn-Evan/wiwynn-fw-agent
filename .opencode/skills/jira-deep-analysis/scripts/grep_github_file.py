#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import re
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


def _fetch_raw_content(repo: str, path: str, token: str, ref: str | None = None) -> str:
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

    if data.get('encoding') == 'base64' and data.get('content'):
        try:
            return base64.b64decode(data['content']).decode('utf-8')
        except UnicodeDecodeError:
            _error(f"無法解碼檔案（二進位或非 UTF-8）：{repo}/{path}")

    download_url = data.get('download_url')
    if download_url:
        try:
            dl_resp = requests.get(download_url, timeout=30)
            if dl_resp.ok:
                return dl_resp.text
        except requests.RequestException as e:
            _error(f"無法透過 download_url 取得檔案：{e}")

    _error(f"無法取得檔案內容（檔案可能過大或編碼特殊）：{repo}/{path}")


def grep_file(repo: str, path: str, pattern: str, token: str,
              context_lines: int = 3, max_matches: int = 50,
              ref: str | None = None) -> dict[str, Any]:
    content = _fetch_raw_content(repo, path, token, ref=ref)
    lines = content.split('\n')
    total_lines = len(lines)

    try:
        regex = re.compile(pattern)
    except re.error as e:
        _error(f"無效的正規表達式 '{pattern}': {e}")

    matched_line_nums: list[int] = []
    for i, line in enumerate(lines):
        if regex.search(line):
            matched_line_nums.append(i + 1)
            if len(matched_line_nums) >= max_matches:
                break

    results: list[dict[str, Any]] = []
    for line_num in matched_line_nums:
        start_idx = max(0, line_num - 1 - context_lines)
        end_idx = min(total_lines, line_num - 1 + context_lines + 1)
        context_block = '\n'.join(
            f"{start_idx + j + 1}: {lines[start_idx + j]}"
            for j in range(end_idx - start_idx)
        )
        results.append({
            'line': line_num,
            'content': lines[line_num - 1],
            'context': context_block
        })

    return {
        'repo': repo,
        'path': path,
        'pattern': pattern,
        'total_lines': total_lines,
        'match_count': len(results),
        'truncated': len(matched_line_nums) >= max_matches,
        'matches': results
    }


def _error(message: str) -> NoReturn:
    print(f"[ERROR] {message}", file=sys.stderr)
    sys.exit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='在 GitHub 檔案中搜尋 pattern，回傳匹配行號與上下文',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
範例:
  python grep_github_file.py facebook/openbmc meta-facebook/meta-grandcanyon/recipes-grandcanyon/plat-libs/files/pal/pal.c "pal_get_fru_health"
  python grep_github_file.py facebook/OpenBIC src/platform/gc2-es/plat_class.c "plat_class" --context 5
  python grep_github_file.py facebook/openbmc common/recipes-core/sensor-util/sensor-util.c "sensor_read" --max-matches 20
  python grep_github_file.py facebook/openbmc some/file.c "pattern" --ref some-branch
        """
    )
    parser.add_argument('repo', metavar='OWNER/REPO',
                        help='Repository（格式: owner/repo）')
    parser.add_argument('path', metavar='PATH',
                        help='檔案路徑（相對於 repo 根目錄）')
    parser.add_argument('pattern', metavar='PATTERN',
                        help='搜尋 pattern（支援 Python regex）')
    parser.add_argument('--context', type=int, default=3, metavar='N',
                        help='每個匹配上下各顯示幾行（預設 3）')
    parser.add_argument('--max-matches', type=int, default=50, metavar='N',
                        help='最多回傳幾個匹配結果（預設 50）')
    parser.add_argument('--ref', metavar='REF',
                        help='Git ref（branch / tag / commit SHA）')

    args = parser.parse_args()
    token = get_token()
    result = grep_file(args.repo, args.path, args.pattern, token,
                       context_lines=args.context, max_matches=args.max_matches,
                       ref=args.ref)
    print(json.dumps(result, ensure_ascii=False, indent=2))
