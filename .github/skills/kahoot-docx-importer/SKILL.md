---
name: kahoot-docx-importer
description: Guia para manter e evoluir a extensão Chrome "Kahoot — Inseridor por DOCX" (pasta kahoot/), que lê questões de um .docx e preenche automaticamente o editor de quiz do Kahoot (create.kahoot.it). Use sempre que for pedido para debugar, corrigir ou adicionar funcionalidades em content.js, popup.js, docx-reader.js ou manifest.json dentro dessa pasta.
---

# Kahoot — Inseridor por DOCX

Extensão Chrome Manifest V3, sem dependências externas nem build step —
todo o código é JS puro carregado diretamente pelo `manifest.json`.

## Estrutura do projeto

```
kahoot/
├── manifest.json        # MV3, host_permissions apenas para create.kahoot.it
├── popup.html / popup.js  # UI: seleciona o .docx, dispara "Inserir uma"/"Inserir todas"/"Parar"
├── content.js            # injetado em create.kahoot.it, faz todo o preenchimento do DOM
├── docx-reader.js        # parser de .docx (zip + XML) rodando 100% no browser, sem libs
└── markdown/
    ├── README.md              # changelog técnico versionado (v6 → v15...)
    └── ORIENTACOES-DOCX.md    # regras do formato do .docx e passo a passo de instalação
```

Não existe processo de build: qualquer alteração em `content.js`/`popup.js`
é testada recarregando a extensão em `chrome://extensions/` (modo
desenvolvedor, "Carregar sem compactação" apontando para a pasta `kahoot/`).

## content.js — como o preenchimento funciona

O Kahoot é uma SPA em React, então manipular o DOM "na unha" não basta:

- **Localização de elementos**: sempre priorizar os atributos estáveis
  `data-functional-selector` (`question-title__input`,
  `question-answer__input`, `question-answer__toggle-button`,
  `question-form`, `add-question-button`, `create-button__quiz`). Os
  fallbacks por regex/heurística de posição (`getTitleElement`,
  `getAnswerElements`, `clickCorrectFallback`) existem só para o caso desses
  atributos mudarem — mantenha os dois caminhos ao editar essas funções, não
  remova o fallback.
- **Digitar texto compatível com React** (`humanType`): para `<input>`/
  `<textarea>` usa o setter nativo do prototype (`nativeInputValueSetter`)
  e reseta `el._valueTracker` antes de disparar `InputEvent` com
  `inputType: 'insertText'` — isso é obrigatório, porque escrever
  `el.value = x` direto ou usar `execCommand` sozinho deixa o estado interno
  do React dessincronizado do DOM visível (foi a causa raiz do bug
  corrigido na v15, descrito no README). Para campos rich-text
  (`contenteditable`) usa `execCommand('insertText', …)` com fallback para
  `el.innerText =`.
- **Sincronização com autosave**: o Kahoot só persiste a questão quando
  detecta os eventos corretos; texto fixo tipo "Saved to: Your drafts" no
  cabeçalho **não** é confiável como sinal de save (é um falso positivo
  documentado na v14) — prefira observar uma transição real
  (Saved → Saving → Saved) ou aguardar uma folga fixa generosa.
- **Fluxo de múltiplas questões** (`runAll`): preenche a questão atual,
  espera `stepDelay` (mínimo 800ms, padrão 3000ms), clica em "+ Add"
  (`clickAddQuestion`), seleciona o tipo "Quiz" (`selectQuizQuestionType`)
  e só então aguarda a nova questão renderizar (`waitForNewQuestionReady`)
  antes de digitar. Qualquer alteração nesse fluxo deve preservar essa
  ordem — trocar a ordem ou reduzir os delays tende a reintroduzir o bug de
  "questão anterior resetada" já corrigido várias vezes no histórico.
- Mensagens entre popup e content script usam `chrome.runtime.sendMessage`
  com `action`: `ping`, `stop`, `one`, `all`. O listener é guardado por uma
  flag global (`window.__KAHOOT_DOCX_LISTENER_INSTALLED_V15`) para não
  duplicar ao reinjetar o script — ao subir a versão do manifest, atualize
  também o nome dessa flag.

## docx-reader.js — parser do .docx

Implementação manual de leitura de ZIP (sem lib): localiza o EOCD,
percorre o diretório central, extrai `word/document.xml` (suporta
`deflate` via `DecompressionStream` e `store` sem compressão) e faz o
parse do texto com regex sobre `n. pergunta A) ... B) ... C) ... D) ...`,
aceitando tanto parágrafos separados quanto tudo concatenado num único
parágrafo (comportamento comum quando o Word junta a formatação). A
alternativa correta é identificada pelo emoji `✅` ao final do texto.

Ao alterar o parser, mantenha compatibilidade com as duas formas de
entrada (linhas separadas / bloco único) — os dois casos têm cobertura no
README como bugs já resolvidos.

## Regras do formato do .docx (ORIENTACOES-DOCX.md)

- Pergunta: máx. 120 caracteres. Alternativas: máx. 75 caracteres.
- Exatamente 4 alternativas, sempre `A)`, `B)`, `C)`, `D)`.
- Exatamente uma alternativa marcada com `✅` no final.
- Numeração sequencial iniciando em `1.`.
- Proibido qualquer texto além das questões (sem título, saudação, nota).

Se for pedido para gerar ou validar um `.docx` de exemplo, siga esse
padrão à risca — o parser depende dele.

## Convenção de changelog (markdown/README.md)

Cada correção relevante em `content.js` ganha uma entrada de versão nova
no topo do `README.md` (`## vNN — descrição curta`) explicando: causa raiz
identificada, e lista do que mudou. Ao corrigir um bug:
1. Suba a versão em `manifest.json` (`version` e, se aplicável, no `name`).
2. Adicione a entrada correspondente no `README.md` seguindo o mesmo
   estilo das entradas anteriores (diagnóstico → mudanças).
3. Atualize a flag de listener em `content.js` se o número de versão for
   referenciado nela.

## Preferência de estilo

Ao propor correções, prefira mostrar o diff/trecho de código já corrigido
em vez de só explicar o conceito — é assim que o histórico do projeto foi
documentado.
