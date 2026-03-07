#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
search_github.py — 精簡版 GitHub Code Search

使用 GitHub Code Search REST API 搜尋多個 repository 的程式碼，輸出 JSON 至 stdout。
內建 exponential backoff (2s → 4s → 8s → 16s → 32s) 處理 rate limit。

用法:
    python search_github.py <query> [--repos owner/repo1 owner/repo2 ...] [--org ORG] [--ext EXT] [--per-page N] [--text-matches]

範例:
    python search_github.py "sensor_read" --repos facebook/openbmc openbmc/openbmc
    python search_github.py "i2c" --org openbmc --ext c
    python search_github.py "plat_class" --repos facebook/OpenBIC
    python search_github.py "pal_get_fru_health" --repos facebook/openbmc --text-matches

認證 (從 .env 讀取，或設定環境變數):
    GITHUB_TOKEN=your_token_here

輸出格式 (JSON，無 --text-matches):
    {
        "total_count": 42,
        "items": [
            {
                "repo": "facebook/openbmc",
                "path": "common/recipes-core/foo/foo.c",
                "name": "foo.c",
                "url": "https://github.com/facebook/openbmc/blob/..."
            },
            ...
        ],
        "rate_limit_remaining": "9",
        "latency_ms": 880.5
    }

輸出格式 (JSON，有 --text-matches):
    {
        "total_count": 42,
        "items": [
            {
                "repo": "facebook/openbmc",
                "path": "common/recipes-core/foo/foo.c",
                "name": "foo.c",
                "url": "https://github.com/facebook/openbmc/blob/...",
                "text_matches": [
                    {
                        "fragment": "int pal_get_fru_health(uint8_t fru, ...) {",
                        "matches": [
                            { "text": "pal_get_fru_health", "indices": [4, 22] }
                        ]
                    }
                ]
            },
            ...
        ],
        "rate_limit_remaining": "9",
        "latency_ms": 880.5
    }

注意:
    - 若搜尋多個 repos，每個 repo 分別呼叫 API，結果合併後輸出
    - GitHub Code Search API 每次最多回傳 100 筆結果
    - --text-matches 使用 application/vnd.github.text-match+json Accept header，
      回傳每個結果的 code fragment（匹配上下文），可用於判斷匹配位置

需求: pip install requests python-dotenv
"""

import os
import sys
import json
import time
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


# Constants
GITHUB_API_URL = "https://api.github.com/search/code"
MAX_RETRIES = 5
INITIAL_BACKOFF = 2  # seconds


def get_token() -> str:
    token = os.getenv('GITHUB_TOKEN', '')
    if not token:
        _error("缺少 GITHUB_TOKEN 環境變數。\n"
               "請在 .env 檔案中設定 GITHUB_TOKEN=your_token")
    return token


def search_single(query: str, repo: str | None = None, org: str | None = None,
                   ext: str | None = None, per_page: int = 10, token: str = '',
                   text_matches: bool = False) -> dict[str, Any]:
    parts = [query]
    if repo:
        parts.append(f"repo:{repo}")
    elif org:
        parts.append(f"org:{org}")
    if ext:
        parts.append(f"extension:{ext}")
    full_query = ' '.join(parts)

    params = {'q': full_query, 'per_page': min(per_page, 100)}
    accept = 'application/vnd.github.text-match+json' if text_matches else 'application/vnd.github+json'
    headers = {
        'Accept': accept,
        'Authorization': f'Bearer {token}',
        'X-GitHub-Api-Version': '2022-11-28'
    }

    backoff = INITIAL_BACKOFF
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            t0 = time.time()
            resp = requests.get(GITHUB_API_URL, params=params, headers=headers, timeout=15)
            latency_ms = (time.time() - t0) * 1000

            rl_remaining = resp.headers.get('X-RateLimit-Remaining', 'N/A')

            if resp.status_code == 200:
                data = resp.json()
                items = []
                for item in data.get('items', []):
                    entry: dict[str, Any] = {
                        'repo': item.get('repository', {}).get('full_name', ''),
                        'path': item.get('path', ''),
                        'name': item.get('name', ''),
                        'url': item.get('html_url', '')
                    }
                    if text_matches and 'text_matches' in item:
                        entry['text_matches'] = [
                            {
                                'fragment': tm.get('fragment', ''),
                                'matches': [
                                    {'text': m.get('text', ''), 'indices': m.get('indices', [])}
                                    for m in tm.get('matches', [])
                                ]
                            }
                            for tm in item['text_matches']
                        ]
                    items.append(entry)
                return {
                    'success': True,
                    'total_count': data.get('total_count', 0),
                    'items': items,
                    'rate_limit_remaining': rl_remaining,
                    'latency_ms': latency_ms,
                    'error': None
                }

            elif resp.status_code in (429, 403) and rl_remaining == '0':
                # Rate limit — exponential backoff
                if attempt < MAX_RETRIES:
                    print(f"[WARN] Rate limit hit, retrying in {backoff}s... (attempt {attempt}/{MAX_RETRIES})",
                          file=sys.stderr)
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                else:
                    return {'success': False, 'total_count': 0, 'items': [],
                            'rate_limit_remaining': rl_remaining, 'latency_ms': latency_ms,
                            'error': f'Rate limit exceeded after {MAX_RETRIES} retries'}

            elif resp.status_code == 401:
                _error("GitHub Token 認證失敗 (HTTP 401)，請確認 GITHUB_TOKEN 是否正確。")

            else:
                msg = resp.json().get('message', resp.text[:200]) if resp.content else f'HTTP {resp.status_code}'
                return {'success': False, 'total_count': 0, 'items': [],
                        'rate_limit_remaining': rl_remaining, 'latency_ms': latency_ms,
                        'error': f'API error (HTTP {resp.status_code}): {msg}'}

        except requests.Timeout:
            return {'success': False, 'total_count': 0, 'items': [],
                    'rate_limit_remaining': 'N/A', 'latency_ms': 15000,
                    'error': 'Request timeout (15s)'}
        except requests.ConnectionError as e:
            return {'success': False, 'total_count': 0, 'items': [],
                    'rate_limit_remaining': 'N/A', 'latency_ms': 0,
                    'error': f'Connection error: {e}'}

    return {'success': False, 'total_count': 0, 'items': [],
            'rate_limit_remaining': 'N/A', 'latency_ms': 0,
            'error': 'Max retries exceeded'}


def search_multiple_repos(query: str, repos: list[str], ext: str | None = None,
                           per_page: int = 10, token: str = '',
                           text_matches: bool = False) -> dict[str, Any]:
    all_items = []
    total_count = 0
    last_rl_remaining = 'N/A'
    total_latency = 0.0
    errors = []

    for repo in repos:
        result = search_single(query, repo=repo, ext=ext, per_page=per_page,
                               token=token, text_matches=text_matches)
        if result['success']:
            all_items.extend(result['items'])  # type: ignore
            total_count += result['total_count']  # type: ignore
            last_rl_remaining = result['rate_limit_remaining']
            total_latency += result['latency_ms']  # type: ignore
        else:
            errors.append(f"{repo}: {result['error']}")
            print(f"[WARN] Search failed for {repo}: {result['error']}", file=sys.stderr)

    return {
        'total_count': total_count,
        'items': all_items,
        'rate_limit_remaining': last_rl_remaining,
        'latency_ms': total_latency,
        'errors': errors if errors else None
    }


def _error(message: str) -> NoReturn:
    print(f"[ERROR] {message}", file=sys.stderr)
    sys.exit(1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='GitHub Code Search — 搜尋多個 repo 的程式碼，JSON 輸出',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
範例:
  python search_github.py "sensor_read" --repos facebook/openbmc openbmc/openbmc
  python search_github.py "i2c" --org openbmc --ext c
  python search_github.py "plat_class" --repos facebook/OpenBIC --per-page 20
  python search_github.py "pal_get_fru_health" --repos facebook/openbmc --text-matches
        """
    )
    parser.add_argument('query', help='搜尋關鍵字')
    parser.add_argument('--repos', nargs='+', metavar='OWNER/REPO',
                        help='指定 repositories（可多個），與 --org 互斥')
    parser.add_argument('--org', metavar='ORG',
                        help='搜尋整個 organization，與 --repos 互斥')
    parser.add_argument('--ext', metavar='EXT',
                        help='副檔名過濾，例如: c, cpp, py')
    parser.add_argument('--per-page', type=int, default=10, metavar='N',
                        help='每次搜尋回傳筆數（最大 100，預設 10）')
    parser.add_argument('--text-matches', action='store_true',
                        help='回傳匹配的程式碼 fragment（使用 text-match+json Accept header）')

    args = parser.parse_args()

    if args.repos and args.org:
        _error("--repos 和 --org 互斥，請擇一使用。")

    token = get_token()

    if args.repos:
        result = search_multiple_repos(
            args.query, args.repos,
            ext=args.ext, per_page=args.per_page, token=token,
            text_matches=args.text_matches
        )
    else:
        single = search_single(
            args.query, org=args.org,
            ext=args.ext, per_page=args.per_page, token=token,
            text_matches=args.text_matches
        )
        result = {
            'total_count': single['total_count'],
            'items': single['items'],
            'rate_limit_remaining': single['rate_limit_remaining'],
            'latency_ms': single['latency_ms'],
            'errors': [single['error']] if not single['success'] and single.get('error') else None
        }

    print(json.dumps(result, ensure_ascii=False, indent=2))
