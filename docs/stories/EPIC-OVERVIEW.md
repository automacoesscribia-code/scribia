# ScribIA — Epic Overview

## Épicos

| Epic | Nome | Stories | Prioridade |
|------|------|---------|------------|
| **1** | Foundation & Infrastructure | 1.1 — 1.5 | P0 (Must) |
| **2** | Desktop App — Captação de Áudio | 2.1 — 2.4 | P0 (Must) |
| **3** | Processing Pipeline | 3.1 — 3.4 | P0 (Must) |
| **4** | Controlador de Evento (Admin) | 4.1 — 4.5 | P0 (Must) |
| **5** | Portal do Participante | 5.1 — 5.4 | P0 (Must) |
| **6** | Recursos Adicionais | 6.1 — 6.3 | P1 (Should) |
| **7** | **Telas de Referência (UI Completa)** | 7.1 — 7.3 | **P0 (Must)** |
| **8** | **Fluxo Completo do Palestrante** | 8.1 — 8.5 | **P0 (Must)** |

## Status de Implementação (2026-03-19)

| Story | Nome | Status Story | Status Código | Gap |
|-------|------|-------------|--------------|-----|
| 1.1 | Monorepo Setup | Ready | ~90% | Turbo builds não testados |
| 1.2 | Database Schema | Ready | ~70% | Schema definido, migrations pendentes |
| 1.3 | Authentication | Ready | ~80% | Login/Register OK, password reset falta |
| 1.4 | Storage Setup | Ready | ✅ 100% | Buckets + policies + utilities implementados |
| 1.5 | AI Provider Setup | Ready | ✅ 100% | Gemini + Claude providers, PDF/DOCX builders, 7 tests |
| 2.1 | Tauri App Setup | Ready | ~60% | App compila, config básica OK |
| 2.2 | Audio Capture | Ready | ✅ 100% | Rust cpal capture + WAV chunking implementado |
| 2.3 | Audio Upload | Ready | ✅ 100% | Upload manager com retry exponencial |
| 2.4 | Session Control | Ready | ✅ 100% | UI completa + waveform canvas + status pills + log |
| 3.1 | Transcription Pipeline | Ready | ✅ 100% | Edge Function transcribe.ts |
| 3.2 | Summary & Topics | Ready | ✅ 100% | Edge Function generate-summary.ts |
| 3.3 | E-book Generation | Ready | ✅ 100% | Edge Functions generate-ebook.ts + generate-playbook.ts |
| 3.4 | Processing Monitor | Ready | ✅ 100% | ProcessingStatus component com realtime |
| 4.1 | Events CRUD | Ready | ✅ 95% | Cover image upload deferred |
| 4.2 | Lectures & Speakers | Ready | ✅ 90% | Falta página standalone de speakers |
| 4.3 | Participants Mgmt | Ready | ✅ 85% | Email invite flow simplificado |
| 4.4 | Event Analytics | Ready | ✅ 90% | Dashboard com KPIs, engagement chart, tabela por palestra |
| 4.5 | Final Report | Ready | ✅ 100% | Edge Function + ReportGenerator UI |
| 5.1 | Participant Portal | Ready | ✅ 100% | Portal completo com hero, player, lecture cards |
| 5.2 | Audio Player | Ready | ✅ 100% | Waveform + controles + speed + volume |
| 5.3 | E-book Viewer | Ready | ✅ 90% | Markdown renderer inline, playbook com checklists |
| 5.4 | Lecture Detail Page | Ready | ✅ 100% | Tabs (áudio/ebook/playbook), summary, accessed_at tracking |
| 6.1 | Divulgation Cards | Ready | ✅ 100% | CardPreview UI + generate-card Edge Function |
| 6.2 | PDF/DOCX Materials | Ready | ✅ 100% | MaterialsDownload UI + generate-materials Edge Function |
| 6.3 | Audio Edit/Replace | Ready | ✅ 100% | AudioEditor UI (replace + trim) com backup |
| **7.1** | **Dashboard Real** | **Ready** | **✅ 100%** | Stats + tabela + ações + progresso |
| **7.2** | **Speakers Page** | **Ready** | **✅ 100%** | Convites + CSV + pendentes/confirmados |
| **7.3** | **Desktop UI Completa** | **Ready** | **✅ 100%** | Canvas waveform + status pills + upload + log |
| **8.1** | **Speaker Role Database** | **Ready** | **✅ 100%** | Migration + trigger + RLS + helper + middleware |
| **8.2** | **Speaker Invitation Flow** | **Ready** | **✅ 100%** | Edge Function + speakers page + set-password + /speaker |
| **8.3** | **Desktop Speaker Login** | **Ready** | **✅ 100%** | Role detection + SpeakerLectures + check_local_chunks |
| **8.4** | **Local Audio + Deploy** | **Ready** | **✅ 100%** | app_data_dir storage + deploy manual + open folder |
| **8.5** | **Speaker Web Redirect** | **Ready** | **✅ 100%** | Middleware + pagina /speaker (done in 8.1+8.2) |

## Waves de Execução (Atualizado)

### Wave 1 — UI Frontend (PRÓXIMA) ⬅️ AGORA
Implementar as telas de referência que faltam. Não depende de backend.

| Story | Descrição | Referência Visual |
|-------|-----------|-------------------|
| **7.1** | Dashboard Real do Organizador | `scribia-dashboard.html` |
| **7.2** | Página de Palestrantes | `scribia-speakers.html` |
| **5.1** | Portal do Participante completo | `scribia-participant.html` |
| **7.3** | Desktop UI Completa | `scribia-desktop.html` |

### Wave 2 — Foundation Pendente
Completar infraestrutura necessária para o backend.

| Story | Descrição |
|-------|-----------|
| 1.4 | Storage Setup (Supabase buckets + policies) |
| 1.5 | AI Provider Setup (OpenAI + Anthropic clients) |

### Wave 3 — Desktop Backend (Stories 2.2 — 2.4)
Implementar captura de áudio real em Rust e upload chunked.

### Wave 4 — Processing Pipeline (Stories 3.1 — 3.4)
Edge Functions para transcrição, resumo, e-book, playbook.

### Wave 5 — Portal Viewers (Stories 5.2 — 5.4)
Audio player funcional, e-book viewer, lecture detail page.

### Wave 6 — Analytics & Reports (Stories 4.4 — 4.5)
Dashboard de analytics e relatório final.

### Wave 7 — Extras (Stories 6.1 — 6.3)
Cards de divulgação, PDF/DOCX, edição de áudio.

### Wave 8 — Fluxo Completo do Palestrante (Stories 8.1 — 8.5) ⬅️ PROXIMA
Convite real por email, conta de speaker, desktop com filtro por palestrante, audio local + deploy manual.

| Story | Descrição | Dependências |
|-------|-----------|--------------|
| **8.1** | Speaker Role no Database | 1.2, 1.3 |
| **8.2** | Fluxo de Convite por Email | 8.1, 7.2 |
| **8.3** | Desktop Login do Speaker | 8.1, 8.2, 7.3 |
| **8.4** | Audio Local + Deploy Manual | 8.3, 2.2, 2.3 |
| **8.5** | Redirect Web + Pagina Info | 8.1, 8.2 |

## Dependências entre Stories

```
1.1 (Monorepo) → ALL
1.2 (Database) → 4.1, 4.2, 4.3, 3.1
1.3 (Auth)     → 4.1, 5.1
1.4 (Storage)  → 2.3, 3.1
1.5 (AI Provider) → 3.2, 3.3, 4.5, 6.2

2.1 (Tauri setup) → 2.2, 2.3, 2.4, 7.3
2.2 (Audio capture) → 2.3
2.3 (Upload) → 3.1

3.1 (Transcription) → 3.2, 3.3, 3.4
3.2 (Summary) → 3.3, 3.4

4.1 (Events CRUD) → 4.2, 4.3, 7.1
4.2 (Lectures CRUD) → 2.4, 5.2, 7.2
4.3 (Participants) → 5.1

5.1 (Portal) → 5.2, 5.3, 5.4

7.1 (Dashboard) ← 4.1, 4.2 (dados)
7.2 (Speakers) ← 4.2 (dados)
7.3 (Desktop UI) ← 2.1 (Tauri base)

8.1 (Speaker DB) ← 1.2, 1.3
8.2 (Speaker Invite) ← 8.1, 7.2
8.3 (Desktop Speaker) ← 8.1, 8.2, 7.3
8.4 (Local Audio + Deploy) ← 8.3, 2.2, 2.3
8.5 (Speaker Web) ← 8.1, 8.2
```

## ADR References

| ADR | Decisão | Stories Afetadas |
|-----|---------|------------------|
| ADR-001 v2 | AI Provider model-agnostic (Gemini default), pdf-lib + docx (Deno-native) | 1.5, 3.2, 3.3, 4.5, 6.2 |
| ADR-002 | Satori + resvg-js para PNG generation (Deno WASM) | 6.1 |
| ADR-003a | Story 4.4 AC7 delega geração de relatório para 4.5 | 4.4, 4.5 |
| ADR-003b | URI scheme `scribia://` via Tauri deep-link plugin | 2.1 |
| ADR-003c | Web Audio API para trim de áudio (zero deps) | 6.3 |
| ADR-003d | AI model configurável via `AI_PROVIDER` env var | 1.1, 1.5, 3.2, 3.3, 4.5 |
| **ADR-004** | **Design System Scribia v1.1 — dark-first, purple brand, Syne+DM Sans+DM Mono** | **ALL UI stories (4.x, 5.x, 7.x)** |

---
*Morgan — Product Manager | River — Scrum Master | ADRs by Aria (Architect) — 2026-03-20*
