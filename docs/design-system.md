# ScribIA — Design System Specification

## 1. Visão Geral

Este documento é a **fonte de verdade** para todo o design visual do ScribIA. Todas as telas, componentes e layouts devem seguir rigorosamente os tokens, padrões e regras aqui definidos.

**Referências visuais originais:** `referencias/`
- `scribia-dashboard.html` — Dashboard do organizador
- `scribia-desktop.html` — App desktop de captação de áudio
- `scribia-participant.html` — Portal do participante
- `scribia-speakers.html` — Gestão de palestrantes
- `Logo-02.png` — Logotipo oficial

| Data | Versão | Descrição | Autor |
|------|--------|-----------|-------|
| 2026-03-19 | 1.0.0 | Design system inicial baseado nos protótipos HTML | Uma (UX-Design Expert) |

---

## 2. Identidade Visual

### 2.1 Logo

- **Texto:** "SCRIBIA" em font-heading (Syne), weight 800
- **Cor do logo:** `--purple-light` (#8B71FF)
- **Ícone:** Microfone integrado na letra "I" (ver `Logo-02.png`)
- **Uso em sidebar:** Logo + subtítulo "Painel do Organizador" abaixo

### 2.2 Filosofia

Tema **dark-first**, profissional e moderno. Inspirado em interfaces de áudio/produção (waveforms, meters) com a cor roxa como identidade. Sensação de tecnologia + criatividade.

---

## 3. Design Tokens

### 3.1 Cores — Brand

| Token | Hex | Uso |
|-------|-----|-----|
| `--purple` | `#6B4EFF` | Cor primária, botões, links, accent |
| `--purple-light` | `#8B71FF` | Hover states, logo, texto accent |
| `--purple-dark` | `#4A35CC` | Pressed states |
| `--purple-dim` | `rgba(107,78,255,0.12)` | Backgrounds sutis (badges, active nav) |
| `--purple-glow` | `rgba(107,78,255,0.25)` | Box-shadow em botões primários |

### 3.2 Cores — Semânticas

| Token | Hex | Uso |
|-------|-----|-----|
| `--scribia-green` | `#00D4A0` | Sucesso, status ativo, transcrito |
| `--scribia-yellow` | `#FFB830` | Aviso, processando, pendente |
| `--scribia-red` | `#FF5C72` | Erro, falha, destruição, gravando |
| `--scribia-teal` | `#00C6D4` | Info, downloads, métricas |

### 3.3 Cores — Backgrounds (escala escura)

| Token | Hex | Uso |
|-------|-----|-----|
| `--bg` | `#0A0A0F` | Background principal da página |
| `--bg2` | `#111118` | Cards, sidebar, painéis |
| `--bg3` | `#17171F` | Inputs, hover states, backgrounds secundários |
| `--bg4` | `#1E1E28` | Track de progress bars, backgrounds terciários |

### 3.4 Cores — Texto (escala)

| Token | Hex | Uso |
|-------|-----|-----|
| `--text` | `#F0EFF8` | Texto primário (títulos, valores, conteúdo) |
| `--text2` | `#9896B0` | Texto secundário (labels, meta info) |
| `--text3` | `#5C5A72` | Texto terciário (hints, placeholders, nav inativo) |

### 3.5 Cores — Bordas

| Token | Valor | Uso |
|-------|-------|-----|
| `--border-subtle` | `rgba(255,255,255,0.07)` | Bordas de cards, inputs, sidebar |
| `--border-purple` | `rgba(107,78,255,0.3)` | Bordas de elementos ativos, focus, hover |

---

## 4. Tipografia

### 4.1 Fontes

| Uso | Família | Variable CSS | Pesos |
|-----|---------|-------------|-------|
| **Headings** | [Syne](https://fonts.google.com/specimen/Syne) | `--font-heading` | 400, 600, 700, **800** |
| **Body** | [DM Sans](https://fonts.google.com/specimen/DM+Sans) | `--font-sans` | 300, 400, **500** |
| **Code/Mono** | [DM Mono](https://fonts.google.com/specimen/DM+Mono) | `--font-mono` | 400, 500 |

### 4.2 Escala Tipográfica

| Elemento | Font | Size | Weight | Tailwind |
|----------|------|------|--------|----------|
| Page title | Syne | 24px | 700 | `font-heading text-2xl font-bold` |
| Card title | Syne | 14px | 700 | `font-heading text-sm font-bold` |
| Stat value | Syne | 32px | 800 | `font-heading text-[32px] font-extrabold` |
| Logo | Syne | 22px | 800 | `font-heading text-[22px] font-extrabold` |
| Body text | DM Sans | 13px | 400 | `text-[13px]` |
| Label | DM Sans | 12px | 500 | `text-[12px] font-medium` |
| Caption/meta | DM Sans | 11px | 400 | `text-[11px]` |
| Chip text | DM Sans | 10.5px | 500 | `text-[10.5px] font-medium` |
| Nav section | DM Sans | 10px | 400 | `text-[10px] uppercase tracking-[1.2px]` |
| Mono values | DM Mono | 12px | 400 | `font-mono text-xs` |

---

## 5. Layout

### 5.1 Dashboard (Organizador)

```
┌──────────────────────────────────────────────┐
│ Sidebar (220px, fixed, bg2)                  │
│ ┌──────────┐                                 │
│ │ SCRIBIA   │  ┌─────────────────────────────┤
│ │ logo      │  │ Main Content (flex-1, p-8)  │
│ ├──────────┤  │                              │
│ │ Nav       │  │  [Page Title]  [Actions]    │
│ │ items     │  │                              │
│ │           │  │  [Stats Grid 4col]          │
│ │           │  │                              │
│ │           │  │  [Content Grid 2col]        │
│ ├──────────┤  │                              │
│ │ User card │  │                              │
│ └──────────┘  └─────────────────────────────┘
└──────────────────────────────────────────────┘
```

- **Sidebar:** 220px width, `bg-bg2`, `border-r border-border-subtle`, position fixed
- **Main:** `ml-[220px]`, `flex-1`, `p-8`
- **Max content width:** `max-w-6xl` (1152px)

### 5.2 Portal (Participante)

```
┌──────────────────────────────────────────────┐
│ Top Nav (sticky, h-14, bg2)                  │
│ [Logo]     [Event Pill]        [User Avatar] │
├──────────────────────────────────────────────┤
│ Content (max-w-[1100px], mx-auto, px-10)     │
│                                              │
│ [Hero: Greeting + Stats]                     │
│ [Player Section]                             │
│ [Lectures Grid 3col]                         │
└──────────────────────────────────────────────┘
```

### 5.3 Desktop (Captação)

```
┌──────────────────────────────────────────────┐
│ Window Chrome (macOS traffic lights)         │
├──────────────────────────────────────────────┤
│ Top Bar: [Logo] [Event Info] [Status Dot]    │
├─────────────────────┬────────────────────────┤
│ Recorder (1fr)      │ Right Panel (280px)    │
│                     │                        │
│ [Timer 00:42:17]    │ [Session Metadata]     │
│ [Waveform Canvas]   │ [Upload Progress]      │
│ [Device Selector]   │ [System Log]           │
│ [Status Pills 3col] │                        │
│ [Controls: ⏸ ● ■]  │                        │
└─────────────────────┴────────────────────────┘
```

### 5.4 Auth (Login/Register)

```
┌──────────────────────────────────────────────┐
│             bg-bg (full screen)              │
│                                              │
│         ┌──────────────────────┐             │
│         │ Card (bg2, rounded-2xl, p-8)       │
│         │                      │             │
│         │  [SCRIBIA logo]      │             │
│         │  [Form inputs]      │             │
│         │  [Primary button]   │             │
│         │  [Divider "ou"]     │             │
│         │  [Ghost button]     │             │
│         │  [Link to other]    │             │
│         └──────────────────────┘             │
└──────────────────────────────────────────────┘
```

---

## 6. Componentes

### 6.1 Botões

| Variante | Background | Text | Border | Efeito |
|----------|-----------|------|--------|--------|
| **Primary** | `bg-purple` | white | none | `glow-purple`, hover → `bg-purple-light` |
| **Ghost/Outline** | transparent | `text-text2` | `border-border-subtle` | hover → `border-border-purple`, `text-purple-light` |
| **Destructive** | `bg-scribia-red/10` | `text-scribia-red` | `border-scribia-red/25` | hover → `bg-scribia-red/20` |
| **Success** | `bg-scribia-green/10` | `text-scribia-green` | `border-scribia-green/30` | hover → `bg-scribia-green/20` |
| **Icon button** | `bg-bg3` | `text-text2` | `border-border-subtle` | hover → `border-border-purple`, `bg-purple-dim` |

**Tamanhos comuns:**
- Padrão: `px-4 py-2.5 rounded-lg text-[13px] font-medium`
- Pequeno: `px-3 py-1.5 rounded-lg text-[12px]`
- Ícone: `w-7 h-7 rounded-md` (ou `w-9 h-9` para ícones maiores)

### 6.2 Cards

```tsx
<div className="bg-bg2 border border-border-subtle rounded-[14px] overflow-hidden transition-all hover:border-border-purple">
  {/* Card header (opcional) */}
  <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
    <h3 className="font-heading text-sm font-bold text-text">Título</h3>
    <span className="text-xs text-purple-light cursor-pointer">Ação →</span>
  </div>
  {/* Card body */}
  <div className="p-5">...</div>
</div>
```

**Com accent top bar:** Adicionar `relative` + classe `card-accent-purple|green|yellow|teal|red`

### 6.3 Chips / Badges

```tsx
<Chip variant="green">Transcrito</Chip>
<Chip variant="yellow">Processando</Chip>
<Chip variant="purple">E-book Pronto</Chip>
<Chip variant="red">Falhou</Chip>
```

**Estrutura:** Dot (5px circle) + texto. `rounded-full`, `text-[10.5px]`, `font-medium`.

| Variante | Background | Text Color |
|----------|-----------|-----------|
| green | `bg-scribia-green/10` | `text-scribia-green` |
| yellow | `bg-scribia-yellow/12` | `text-scribia-yellow` |
| purple | `bg-purple-dim` | `text-purple-light` |
| red | `bg-scribia-red/10` | `text-scribia-red` |

### 6.4 Inputs / Forms

```tsx
const inputClass = "w-full bg-bg3 border border-border-subtle rounded-lg px-3.5 py-2.5 text-[13px] text-text placeholder:text-text3 outline-none transition-all focus:border-border-purple focus:ring-1 focus:ring-purple/20"
const labelClass = "block text-[12px] font-medium text-text2 mb-1.5"
```

**Select:** Mesmo estilo do input, com `appearance-none` + `cursor-pointer`

**Input com ícone:** Ícone `absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text3` + input `pl-9`

### 6.5 Tabelas

```tsx
<table className="w-full border-collapse">
  <thead>
    <tr>
      <th className="text-[10.5px] text-text3 uppercase tracking-[0.8px] p-3 text-left border-b border-border-subtle">
        Coluna
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="transition-colors hover:bg-bg3">
      <td className="p-3 text-[13px] border-b border-border-subtle">Valor</td>
    </tr>
  </tbody>
</table>
```

### 6.6 Modais

```tsx
{/* Overlay */}
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
  {/* Modal card */}
  <div className="bg-bg2 border border-border-subtle rounded-2xl p-6 w-full max-w-lg animate-fade-up">
    <h2 className="font-heading text-xl font-bold text-text mb-5">Título</h2>
    {/* Conteúdo */}
    {/* Footer com botões */}
    <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
      <button className="... ghost ...">Cancelar</button>
      <button className="... primary ...">Confirmar</button>
    </div>
  </div>
</div>
```

### 6.7 Stat Cards

```tsx
<StatCard
  label="Palestras"
  value={24}
  sub="de 28 planejadas"
  badge="▲ 3 esta semana"
  badgeVariant="green"
  accent="purple"
/>
```

**Grid:** `grid grid-cols-4 gap-4` no dashboard

### 6.8 Progress Bars

```tsx
<ProgressBar label="Transcrição" value={24} max={24} color="green" />
<ProgressBar label="E-books gerados" value={19} max={24} color="purple" />
```

**Track:** `h-1 bg-bg4 rounded-sm`
**Fill:** cor variável, `transition-all duration-500`

### 6.9 Sidebar Navigation

```tsx
{/* Nav item ativo */}
<a className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] bg-purple-dim text-purple-light border border-border-purple">
  <Icon className="w-4 h-4 opacity-80" />
  Label
</a>

{/* Nav item inativo */}
<a className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] text-text2 hover:bg-bg3 hover:text-text border border-transparent">
  <Icon className="w-4 h-4 opacity-80" />
  Label
</a>

{/* Seção */}
<div className="text-[10px] text-text3 uppercase tracking-[1.2px] px-3 pt-4 pb-1.5">
  Seção
</div>
```

### 6.10 User Avatar

```tsx
<div className="w-8 h-8 rounded-full bg-purple-dim border border-border-purple flex items-center justify-center text-xs font-heading font-bold text-purple-light">
  MR
</div>
```

Tamanhos: `w-6 h-6` (mini), `w-8 h-8` (default), `w-9 h-9` (speaker list)

---

## 7. Animações

| Nome | Uso | CSS |
|------|-----|-----|
| `fadeUp` | Entrada de cards, modais | `opacity:0 → 1`, `translateY(12px → 0)`, `0.4s ease` |
| `pulse-dot` | Indicador de gravação, status online | `scale(1 → 0.85)`, `opacity(1 → 0.6)`, `2s infinite` |
| `stagger-children` | Grid de cards no dashboard | Delay incremental: 0.05s, 0.10s, 0.15s... |

**Classes Tailwind:**
- `animate-fade-up` — entrada suave
- `animate-pulse-dot` — pulsação para dots de status
- `stagger-children` — container para stagger nos filhos

---

## 8. Espaçamento e Border Radius

### Border Radius

| Uso | Valor | Tailwind |
|-----|-------|----------|
| Botões, inputs | 8px | `rounded-lg` |
| Cards | 14px | `rounded-[14px]` |
| Modais | 16px | `rounded-2xl` |
| Chips, pills | 20px | `rounded-full` |
| Avatares | 50% | `rounded-full` |
| Ícone buttons | 6px | `rounded-md` |

### Espaçamento do Dashboard

| Elemento | Valor |
|----------|-------|
| Sidebar width | 220px |
| Main padding | 32px (`p-8`) |
| Card padding (body) | 20px (`p-5`) |
| Card padding (header) | 18px 20px |
| Gap entre cards | 16-20px |
| Stats grid gap | 16px |
| Section margin-bottom | 28-36px |

---

## 9. Ícones

**Biblioteca:** [Lucide React](https://lucide.dev)

**Tamanhos padrão:**
- Nav icons: `w-4 h-4`
- Button inline icons: `w-3.5 h-3.5`
- Icon buttons: `w-3 h-3`
- Feature icons (empty states): `w-5 h-5` a `w-7 h-7`

**Cor:** Herda do texto (`currentColor`) — não usar cor hardcoded.

---

## 10. Mapeamento de Status

### Lecture Status → Chip

| Status | Variante | Label |
|--------|----------|-------|
| `scheduled` | default | Agendada |
| `recording` | red | Gravando |
| `processing` | yellow | Processando |
| `completed` | green | Concluída/Transcrito |
| `failed` | red | Falhou |

### Event Status → Chip

| Status | Variante | Label |
|--------|----------|-------|
| `draft` | yellow | Rascunho |
| `active` | green | Ativo |
| `completed` | purple | Concluído |
| `archived` | red | Arquivado |

### Processing Job → Dot Color

| Status | Cor do dot |
|--------|-----------|
| `queued` | `bg-text3` |
| `processing` | `bg-purple-light` (+ animate-pulse) |
| `completed` | `bg-scribia-green` |
| `failed` | `bg-scribia-red` |

---

## 11. Arquivos de Implementação

### Tokens e Tema
- `apps/web/src/app/globals.css` — Todos os design tokens, utilitários, animações

### Fontes
- `apps/web/src/app/layout.tsx` — Google Fonts: Syne, DM Sans, DM Mono

### Componentes UI (átomos)
| Componente | Path |
|-----------|------|
| Button | `apps/web/src/components/ui/button.tsx` |
| Chip | `apps/web/src/components/ui/chip.tsx` |
| StatCard | `apps/web/src/components/ui/stat-card.tsx` |
| ProgressBar | `apps/web/src/components/ui/progress-bar.tsx` |
| Modal | `apps/web/src/components/ui/modal.tsx` |

### Layout (organismos)
| Componente | Path |
|-----------|------|
| Sidebar | `apps/web/src/components/layout/sidebar.tsx` |
| Dashboard Layout | `apps/web/src/app/dashboard/layout.tsx` |

---

## 12. Regras Invioláveis

1. **NUNCA** usar classes genéricas do Tailwind como `bg-gray-*`, `text-gray-*`, `bg-blue-*`, `border` sem token
2. **SEMPRE** usar os tokens Scribia: `bg-bg2`, `text-text2`, `border-border-subtle`, `bg-purple`, etc.
3. **SEMPRE** usar `font-heading` (Syne) para títulos e valores de destaque
4. **NUNCA** usar emojis como indicadores de status — usar `<Chip>` ou dots coloridos
5. **SEMPRE** aplicar `animate-fade-up` em cards e modais que aparecem
6. **SEMPRE** usar `glow-purple` em botões primários
7. **SEMPRE** manter o tema dark como padrão (sem `.dark` class necessária)
8. Inputs devem ter `focus:border-border-purple focus:ring-1 focus:ring-purple/20`
9. Hover em cards: `hover:border-border-purple` (nunca shadow genérico)
10. Bordas de separação interna: `border-border-subtle` (nunca `border-gray-*`)

---

## 13. Desktop App (Tauri + Vite + React)

O app desktop **compartilha os mesmos design tokens** mas usa CSS puro (sem Tailwind).

### Implementação

| Arquivo | Conteúdo |
|---------|----------|
| `apps/desktop/index.html` | Google Fonts (Syne, DM Sans, DM Mono), lang pt-BR |
| `apps/desktop/src/App.css` | Todos os tokens CSS como custom properties, classes reutilizáveis |
| `apps/desktop/src/pages/Login.tsx` | Tela de login dark com logo SCRIBIA |
| `apps/desktop/src/pages/EventSelection.tsx` | Seleção de evento com topbar + cards |
| `apps/desktop/src/pages/RecordingSession.tsx` | Gravação com window chrome, timer, VU meter, controles, log |

### Classes CSS disponíveis (App.css)

**Botões:** `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-success`, `.btn-warning`, `.btn-rec`, `.btn-ctrl`, `.btn-link`, `.btn-sm`

**Layout:** `.window-chrome`, `.topbar`, `.logo`, `.event-info`, `.timer-display`, `.controls`

**Cards:** `.card`, `.card-header`, `.card-title`, `.card-body`

**Status:** `.chip`, `.chip-green`, `.chip-yellow`, `.chip-red`, `.chip-purple`, `.status-pill`, `.rec-indicator`

**Inputs:** `.input`, `.select`, `.label`

**Info panels:** `.info-card`, `.info-card-header`, `.info-row`, `.device-row`, `.upload-card`, `.log-body`

**Utilitários:** `.font-heading`, `.font-mono`, `.avatar`, `.animate-fade-up`, `.error-msg`

### Layout da Tela de Gravação

Segue exatamente a referência `scribia-desktop.html`:
- Window chrome com traffic lights (macOS style)
- Top bar: Logo + Event info + Status dot
- Grid: Recorder (1fr) + Right panel (280px)
- Recorder: Timer → VU Meter → Device selector → Status pills → Controls
- Right: Session metadata → Upload progress → System log

### Regras Desktop

1. Tokens CSS em `:root` — **idênticos** aos do web (`--purple`, `--bg`, `--text`, etc.)
2. Usar classes CSS, **nunca** inline styles para cores/backgrounds
3. Usar `.font-heading` para títulos (Syne) e `.font-mono` para valores numéricos (DM Mono)
4. Window chrome: `-webkit-app-region: drag` no container, `no-drag` nos botões

---

*ScribIA Design System v1.1.0 — Web (Tailwind CSS v4) + Desktop (CSS puro) — Baseado nos protótipos HTML de referência*
