/# ScribIA — Design System

> Referência técnica dos tokens visuais, componentes e padrões de identidade extraídos do código-fonte.

---

## 1. Marca & Terminologia

| Item | Valor |
|---|---|
| **Nome** | **ScribIA** (sempre com "IA" em maiúsculo) |
| **Tagline** | *Transforme palestras em livebooks inteligentes com IA* |
| **Produto principal** | **Livebook** (nunca "ebook" ou "e-book") |
| **Domínio** | `scribia-73649.lovable.app` |

---

## 2. Paleta de Cores

Todas as cores são definidas como variáveis CSS em **HSL** (`src/index.css`).

### Light Mode (`:root`)

| Token | HSL | Hex aprox. | Uso |
|---|---|---|---|
| `--background` | `250 30% 98%` | `#f8f7fc` | Fundo geral |
| `--foreground` | `249 30% 12%` | `#1b1726` | Texto principal |
| `--card` | `0 0% 100%` | `#ffffff` | Fundo de cards |
| `--card-foreground` | `249 30% 12%` | `#1b1726` | Texto em cards |
| `--popover` | `0 0% 100%` | `#ffffff` | Fundo de popovers |
| `--popover-foreground` | `249 30% 12%` | `#1b1726` | Texto em popovers |
| **`--primary`** | **`249 45% 55%`** | **`#6b5bb5`** | Cor principal (botões, links, destaques) |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Texto sobre primary |
| `--primary-glow` | `260 40% 65%` | `#9a7dc7` | Gradiente / brilho do primary |
| **`--secondary`** | **`249 30% 77%`** | **`#b9b4d4`** | Cor base da marca (lavanda) |
| `--secondary-foreground` | `249 30% 12%` | `#1b1726` | Texto sobre secondary |
| `--muted` | `250 20% 95%` | `#f0eef5` | Fundos suaves |
| `--muted-foreground` | `249 15% 45%` | `#6b6380` | Texto secundário / placeholders |
| `--accent` | `249 50% 68%` | `#9585cc` | Destaques / badges |
| `--accent-foreground` | `0 0% 100%` | `#ffffff` | Texto sobre accent |
| `--destructive` | `0 72% 55%` | `#dc4444` | Erros / ações destrutivas |
| `--destructive-foreground` | `0 0% 100%` | `#ffffff` | Texto sobre destructive |
| `--border` | `249 20% 90%` | `#e2dff0` | Bordas |
| `--input` | `249 20% 90%` | `#e2dff0` | Bordas de inputs |
| `--ring` | `249 45% 55%` | `#6b5bb5` | Anel de foco |

### Dark Mode (`.dark`)

| Token | HSL | Hex aprox. |
|---|---|---|
| `--background` | `249 30% 6%` | `#0d0b14` |
| `--foreground` | `250 20% 95%` | `#f0eef5` |
| `--card` | `249 30% 8%` | `#12101b` |
| `--primary` | `249 40% 62%` | `#8272c0` |
| `--secondary` | `249 25% 18%` | `#2a2638` |
| `--muted` | `249 25% 18%` | `#2a2638` |
| `--muted-foreground` | `249 15% 60%` | `#9891a6` |
| `--accent` | `249 40% 50%` | `#6b57a8` |
| `--destructive` | `0 62% 35%` | `#8f2222` |
| `--border` | `249 25% 18%` | `#2a2638` |
| `--ring` | `249 40% 62%` | `#8272c0` |

### Sidebar (Light)

| Token | HSL |
|---|---|
| `--sidebar-background` | `250 25% 97%` |
| `--sidebar-foreground` | `249 25% 20%` |
| `--sidebar-primary` | `249 45% 55%` |
| `--sidebar-accent` | `250 20% 93%` |
| `--sidebar-border` | `249 20% 90%` |

---

## 3. Tipografia

| Propriedade | Valor |
|---|---|
| **Fonte primária** | **Inter** (Google Fonts) |
| **Pesos** | 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold), 800 (ExtraBold) |
| **Fallback stack** | `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, sans-serif` |
| **Anti-aliasing** | `antialiased` (via Tailwind) |

### Carregamento

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

---

## 4. Espaçamento & Layout

| Token / Config | Valor | Uso |
|---|---|---|
| `--radius` | `0.75rem` (12px) | Border radius padrão |
| `border-radius: lg` | `var(--radius)` | Cards, modais |
| `border-radius: md` | `calc(var(--radius) - 2px)` | Botões, inputs |
| `border-radius: sm` | `calc(var(--radius) - 4px)` | Badges, tags |
| Container max-width | `1400px` (screen `2xl`) | Layout centralizado |
| Container padding | `2rem` | Padding lateral |

---

## 5. Sombras & Efeitos

| Token | Valor | Uso |
|---|---|---|
| `--shadow-elegant` | `0 10px 30px -10px hsl(var(--primary) / 0.25)` | Elevação suave com tom da marca |
| `--shadow-glow` | `0 0 40px hsl(var(--primary-glow) / 0.35)` | Efeito de brilho para destaques |
| `--gradient-primary` | `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))` | Botões hero/cta, banners |
| `--gradient-subtle` | `linear-gradient(180deg, hsl(250 30% 98%), hsl(250 20% 95%))` | Fundos de seções alternadas |
| `--transition-smooth` | `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` | Transição padrão |

### Classes utilitárias

```css
.shadow-elegant { box-shadow: var(--shadow-elegant); }
.shadow-glow    { box-shadow: var(--shadow-glow); }
```

---

## 6. Botões

Definidos em `src/components/ui/button.tsx` usando `class-variance-authority`.

### Variantes

| Variante | Classes principais | Uso |
|---|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` | Ação primária padrão |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | Excluir, cancelar |
| `outline` | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` | Ação secundária |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` | Ação terciária |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` | Ação sutil (toolbars) |
| `link` | `text-primary underline-offset-4 hover:underline` | Links inline |
| **`hero`** | `bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] shadow-elegant` | CTA principal na hero |
| **`cta`** | Igual ao `hero` + `focus-visible:ring-2 focus-visible:ring-ring` | CTA com foco acessível |

### Tamanhos

| Tamanho | Classes | Dimensões |
|---|---|---|
| `default` | `h-10 px-4 py-2` | 40px altura |
| `sm` | `h-9 rounded-md px-3` | 36px altura |
| `lg` | `h-11 rounded-md px-8` | 44px altura |
| `icon` | `h-10 w-10` | 40×40px quadrado |

### Base compartilhada

```
inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md
text-sm font-medium ring-offset-background transition-colors
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50
[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0
```

---

## 7. Animações

Definidas em `tailwind.config.ts`.

| Nome | Keyframes | Duração | Easing |
|---|---|---|---|
| `fade-in` | `opacity: 0 → 1`, `translateY(10px → 0)` | 0.3s | ease-out |
| `fade-out` | `opacity: 1 → 0`, `translateY(0 → 10px)` | 0.3s | ease-out |
| `scale-in` | `scale(0.95) → scale(1)`, `opacity: 0 → 1` | 0.2s | ease-out |
| `scale-out` | `scale(1) → scale(0.95)`, `opacity: 1 → 0` | 0.2s | ease-out |
| `slide-in-right` | `translateX(100%) → translateX(0)` | 0.3s | ease-out |
| `slide-out-right` | `translateX(0) → translateX(100%)` | 0.3s | ease-out |
| `accordion-down` | `height: 0 → auto` | 0.2s | ease-out |
| `accordion-up` | `height: auto → 0` | 0.2s | ease-out |
| `enter` | `fade-in` + `scale-in` | 0.3s | ease-out |
| `exit` | `fade-out` + `scale-out` | 0.3s | ease-out |

### Utilitários personalizados

| Classe | Efeito |
|---|---|
| `.story-link` | Sublinhado animado que cresce da direita para a esquerda no hover |
| `.hover-scale` | `transform: scale(1.05)` com transição de 200ms |

---

## 8. Acessibilidade

### Movimento reduzido

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Foco visível

Todos os botões e elementos interativos usam `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` para indicação clara de foco via teclado.

---

## 9. Meta & OG Tags

| Tag | Valor |
|---|---|
| `<title>` | `ScribIA — Transforme palestras em livebooks inteligentes com IA` |
| `meta description` | `ScribIA transforma palestras e eventos em Livebooks inteligentes usando Inteligência Artificial. Do palco ao material pronto em minutos.` |
| `og:type` | `website` |
| `og:image` | `https://scribia-73649.lovable.app/og-image.png` |
| `twitter:card` | `summary_large_image` |
| `twitter:site` | `@scribia_ai` |
| `lang` | `en` (considerar alterar para `pt-BR`) |

---

## 10. Arquivos-chave

| Arquivo | Conteúdo |
|---|---|
| `src/index.css` | Variáveis CSS (tokens de cor, sombras, gradientes) |
| `tailwind.config.ts` | Mapeamento de tokens para classes Tailwind, animações |
| `src/components/ui/button.tsx` | Variantes e tamanhos de botões |
| `components.json` | Configuração shadcn/ui |
| `index.html` | Meta tags, carregamento de fontes |

---

*Gerado automaticamente a partir do código-fonte do ScribIA.*
