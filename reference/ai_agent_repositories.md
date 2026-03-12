# AI Agent 相關 GitHub 儲存庫參考指南

這份文件整理了我們討論過的幾個關鍵 AI 開發工具與 Agent 框架，涵蓋了執行引擎、終端助手、專家 Prompt 以及官方擴充等類別。

---

## 1. 執行與研究引擎類 (Execution & Research)
這類工具強大在於具備「自主執行」與「深度搜尋」能力，適合處理長任務。

### [bytedance/deer-flow](https://github.com/bytedance/deer-flow) (字節跳動)
*   **定位**：全能型 SuperAgent 運行環境。
*   **核心**：具備「研究、編程、創作」三大能力，擁有 Docker 沙盒、長期記憶與子 Agent 編排。
*   **特點**：擅長自動化長流程任務，能產出報告、PPT 或運行中的網頁。

### [OpenHands (原 OpenDevin)](https://github.com/All-Hands-AI/OpenHands)
*   **定位**：自主 AI 軟體工程師。
*   **核心**：目標是開源版的 Devin，能在沙盒中操作終端、寫代碼、修 Bug。
*   **特點**：專注於自主完成 GitHub Issue 並產出 Pull Request。

---

## 2. 終端與開發助手類 (Terminal & Tools)
這類工具專注於與開發流程深度集成，在命令行裡輔助代碼編寫。

### [OpenCode](https://github.com/open-code-ai/opencode)
*   **定位**：多模型、跨平台的終端 AI 助手。
*   **核心**：支援 70+ 種模型切換，專注於 TUI（終端界面）下的代碼生成與交互。

### [code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)
*   **定位**：OpenCode 的威力加強版。
*   **核心**：將 OpenCode 升級為「多 Agent 協作系統」，擁有 11 個專業開發分身（重構、測試等）。

---

## 3. 提示詞與專家性格類 (Prompts & Roles)
這類工具提供專業的「腦袋（人設）」，而非硬體或執行框架。

### [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)
*   **定位**：AI 虛擬代理商（Agency）人設庫。
*   **核心**：包含數十種專業職業 Prompt（如前端巫師、Reddit 忍者、壓力測試專家）。
*   **作用**：賦予 AI 更專業的說話語氣、思考邏輯與工作 SOP。

---

## 4. 官方資源與擴充類 (Resources & Extensions)
為了讓現有的主流工具（如 GitHub Copilot）發揮最大威力的補給站。

### [github/awesome-copilot](https://github.com/github/awesome-copilot) (GitHub 官方)
*   **定位**：GitHub Copilot 的專屬補給站。
*   **核心**：提供自定義 Agent、指令（Instructions）、技能（Skills）與 Agentic Workflows。
*   **作用**：讓 Copilot 變得更符合專案需求，並能在 GitHub Actions 中自動化執行。


https://github.com/ComposioHQ/awesome-claude-skills

---
*文件生成日期：2026-03-10*
