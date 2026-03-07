#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fetch_jira.py — 精簡版 JIRA Issue Fetcher

從 JIRA REST API v3 取得 Issue 詳細資訊，輸出 JSON 至 stdout。

用法:
    python fetch_jira.py <ISSUE-KEY>

範例:
    python fetch_jira.py GC20T5T7-121
    python fetch_jira.py YV4T1M-2232

認證 (從 .env 讀取，或設定環境變數):
    JIRA_URL=https://your-company.atlassian.net
    JIRA_USERNAME=your.email@company.com
    JIRA_API_TOKEN=YOUR_JIRA_API_TOKEN

輸出格式 (JSON):
    {
        "key": "GC20T5T7-121",
        "summary": "...",
        "description": "...",
        "labels": [...],
        "components": [...],
        "issue_type": "Bug"
    }

需求: pip install requests python-dotenv
"""

import os
import sys
import json
from typing import NoReturn
import requests

try:
    from dotenv import load_dotenv
    _script_dir = os.path.dirname(os.path.abspath(__file__))
    _env_path = os.path.join(_script_dir, '.env')
    load_dotenv(_env_path if os.path.exists(_env_path) else None)
except ImportError:
    _script_dir = os.path.dirname(os.path.abspath(__file__))


MAX_DESCRIPTION_LENGTH = 8000


def _error(message: str) -> NoReturn:
    print(f"[ERROR] {message}", file=sys.stderr)
    sys.exit(1)


def _load_jira_credentials() -> tuple[str, str, str]:
    jira_url = os.getenv('JIRA_URL', '').rstrip('/')
    username = os.getenv('JIRA_USERNAME', '')
    api_token = os.getenv('JIRA_API_TOKEN', '')

    missing = [k for k, v in [
        ('JIRA_URL', jira_url),
        ('JIRA_USERNAME', username),
        ('JIRA_API_TOKEN', api_token)
    ] if not v]

    if missing:
        _error(
            f"缺少環境變數: {', '.join(missing)}\n"
            f"請在 .env 檔案中設定。\n"
            f"參考: {_script_dir}/.env.example"
        )

    return jira_url, username, api_token


def _make_jira_request(jira_url: str, username: str, api_token: str, issue_key: str) -> dict:
    endpoint = f"{jira_url}/rest/api/3/issue/{issue_key}"
    try:
        response = requests.get(
            endpoint,
            auth=(username, api_token),
            headers={'Accept': 'application/json'},
            timeout=10
        )
        if response.status_code == 401:
            _error("認證失敗 (HTTP 401)，請確認 JIRA_USERNAME 和 JIRA_API_TOKEN 是否正確。")
        if response.status_code == 404:
            _error(f"Issue 不存在 (HTTP 404): {issue_key}")
        if not response.ok:
            _error(f"API 錯誤 (HTTP {response.status_code}): {response.text[:200]}")
        return response.json()
    except requests.Timeout:
        _error(f"連線逾時 (10s)：{jira_url}")
    except requests.ConnectionError:
        _error(f"無法連線至 JIRA：{jira_url}")


def fetch_jira_issue(issue_key: str) -> dict:
    jira_url, username, api_token = _load_jira_credentials()
    data = _make_jira_request(jira_url, username, api_token, issue_key)
    fields = data.get('fields', {})

    raw_desc = fields.get('description', '')
    description = _extract_description_text(raw_desc)
    if len(description) > MAX_DESCRIPTION_LENGTH:
        description = description[:MAX_DESCRIPTION_LENGTH] + '\n...(description truncated)'

    return {
        'key': issue_key,
        'summary': fields.get('summary', ''),
        'description': description,
        'labels': fields.get('labels', []),
        'components': [c.get('name', '') for c in fields.get('components', [])],
        'issue_type': fields.get('issuetype', {}).get('name', '')
    }


def _extract_description_text(desc) -> str:
    if not desc:
        return ''
    if isinstance(desc, str):
        return desc
    if isinstance(desc, dict):
        return _adf_to_text(desc).strip()
    return str(desc)


def _adf_to_text(node: dict) -> str:
    """
    遞迴提取 Atlassian Document Format (ADF) 純文字。
    ADF 是 JIRA REST API v3 使用的結構化文件格式，無法用 isinstance(str) 直接取用，
    必須遞迴走訪 content 樹狀結構提取 text 節點。
    """
    if not isinstance(node, dict):
        return ''
    if node.get('type') == 'text':
        return node.get('text', '')

    parts = [_adf_to_text(child) for child in node.get('content', [])]
    text = ''.join(parts)

    block_types = ('paragraph', 'heading', 'bulletList', 'orderedList',
                   'listItem', 'blockquote', 'codeBlock', 'rule')
    if node.get('type') in block_types:
        text += '\n'

    return text


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"用法: python {os.path.basename(__file__)} <ISSUE-KEY>", file=sys.stderr)
        print(f"範例: python {os.path.basename(__file__)} GC20T5T7-121", file=sys.stderr)
        sys.exit(1)

    result = fetch_jira_issue(sys.argv[1].upper())
    print(json.dumps(result, ensure_ascii=False, indent=2))
