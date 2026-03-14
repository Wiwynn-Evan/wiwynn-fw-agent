# Tools

Utility scripts for the **wiwynn-fw-agent** project.

---

## sync_repos.sh

一鍵同步 `bic_fw_code` 和 `bmc_fw_code` 兩個 firmware 原始碼 repo（執行 `git pull`）。

### 同步的 Repo

| 目錄                              | 遠端來源                                 |
| --------------------------------- | ---------------------------------------- |
| `bic_fw_code/facebook_openbic`    | `https://github.com/facebook/OpenBIC`    |
| `bmc_fw_code/facebook_openbmc`    | `https://github.com/facebook/openbmc`    |

### 前置需求

- **Git** 已安裝並可在命令列中使用
- **GitHub 存取權限** — 你的 Git credential 必須對上述兩個 repo 有 read 權限
- 已確認 `bic_fw_code/facebook_openbic` 及 `bmc_fw_code/facebook_openbmc` 兩個目錄存在且已 clone 好

### 使用方式

在 **專案根目錄** 下執行（Git Bash / WSL / Linux shell）：

```bash
# 拉取兩個 repo 的當前分支最新程式碼
bash tools/sync_repos.sh

# 指定切換到某個分支再拉取
bash tools/sync_repos.sh main
```

### 執行範例

```
============================================
  Wiwynn FW Agent — Repo Sync Tool
============================================

[INFO]  Processing: bic_fw_code/facebook_openbic
[INFO]  Current branch: main
[INFO]  Running git pull...
Already up to date.
[OK]    bic_fw_code/facebook_openbic synced successfully.

[INFO]  Processing: bmc_fw_code/facebook_openbmc
[INFO]  Current branch: main
[INFO]  Running git pull...
Already up to date.
[OK]    bmc_fw_code/facebook_openbmc synced successfully.

============================================
[OK]    All repos synced successfully!
============================================
```

### Exit Code

- `0` — 所有 repo 同步成功
- `N` — 有 N 個 repo 同步失敗
