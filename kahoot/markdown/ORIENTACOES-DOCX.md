# Orientações para Geração do Arquivo DOCX (Kahoot)

Este documento contém todas as especificações e regras obrigatórias para a geração do arquivo `.docx` que será importado pela extensão do Kahoot. O cumprimento rigoroso deste padrão garante que o leitor (`docx-reader.js`) extraia e preencha todas as perguntas e alternativas sem erros.

---

## 🛠️ Como Instalar a Extensão no Google Chrome

Para instalar e ativar a extensão no seu navegador Chrome, siga os passos abaixo:

1. **Abra a tela de extensões do Chrome:**
   - Digite `chrome://extensions/` na barra de endereços do Chrome e pressione **Enter**;
   - Ou clique nos **três pontinhos** no canto superior direito do navegador > **Extensões** > **Gerenciar extensões**.
2. **Ative o "Modo do desenvolvedor":**
   - No canto superior direito da página `chrome://extensions/`, ative a chave seletora **Modo do desenvolvedor** (*Developer mode*).
3. **Carregue a extensão:**
   - No canto superior esquerdo, clique no botão **Carregar sem compactação** (*Load unpacked*).
   - Na janela de arquivos, selecione a pasta **`kahoot`** do projeto (a pasta que contém o arquivo `manifest.json`).
4. **Fixe o ícone para acesso rápido:**
   - Clique no ícone de quebra-cabeça 🧩 (menu de extensões) ao lado da barra de endereços do Chrome.
   - Localize a extensão e clique no alfinete 📌 para fixá-la na barra de ferramentas.

> [!TIP]
> **Dica de atualização:** Sempre que houver alguma alteração nos arquivos da extensão (`content.js`, `popup.js`, etc.), basta voltar na página `chrome://extensions/` e clicar no botão de recarregar 🔄 no card da extensão.

---

## 📌 Pré-requisitos para Importação na Extensão

Para que a extensão funcione e insira as questões corretamente na sua conta do Kahoot:

1. **Estar logado:** Certifique-se de que você já fez login na sua conta do [Kahoot!](https://create.kahoot.it/).
2. **Acessar a página de rascunhos:** Acesse diretamente a página:
   👉 [https://create.kahoot.it/my-library/kahoots/drafts](https://create.kahoot.it/my-library/kahoots/drafts)
3. **Iniciar a criação:** Na página, clique no botão **Create** (ou **Criar**) no topo para abrir o editor de um novo Kahoot (ou abra um rascunho existente).
4. **Abrir a extensão:** Com o editor do Kahoot aberto na aba ativa do navegador, abra o popup da extensão, selecione o arquivo `.docx` gerado e clique em **Inserir todas** (ou **Inserir uma**).

> [!IMPORTANT]
> A aba ativa do seu navegador deve ser a do editor do Kahoot (`https://create.kahoot.it/...`). Se a extensão for acionada fora do editor, ela emitirá um aviso pedindo para abrir o editor antes de continuar.

---

## 1. Regras Fundamentais e Limites de Caracteres

| Elemento | Limite Máximo | Obrigatório | Observação |
| :--- | :--- | :--- | :--- |
| **Enunciado da Questão** | **120 caracteres** | Sim | Limite do próprio Kahoot. Contar espaços e pontuação. |
| **Alternativas de Resposta** | **75 caracteres** | Sim | Limite do próprio Kahoot. Contar espaços. |
| **Quantidade de Alternativas** | **Exatamente 4** | Sim | Obrigatoriamente: **A)**, **B)**, **C)** e **D)**. |
| **Alternativa Correta** | **Exatamente 1** | Sim | Sinalizada com o emoji `✅` ao final da alternativa. |
| **Textos Adicionais** | **PROIBIDO** | - | Não incluir saudações, introduções, cabeçalhos ou notas. |

> [!IMPORTANT]
> **Apenas Perguntas e Respostas:** O documento deve conter **exclusivamente** as questões numeradas e suas 4 alternativas. Nunca adicione títulos como *"Simulado de História"*, avisos, explicações ou comentários ao final.

---

## 2. Estrutura Padrão do Modelo (`doc-question-model.docx`)

Cada questão deve ser numerada sequencialmente (`1.`, `2.`, `3.`, etc.), seguida do enunciado e das quatro alternativas identificadas por letra maiúscula e parêntese de fechamento (`A)`, `B)`, `C)`, `D)`).

### Exemplo Visual:

```text
1. Primeira pergunta gerada pela IA?
A) Resposta da IA errada
B) Resposta da IA errada outra vez
C) Resposta da IA correta ✅
D) Resposta da IA errada novamente

2. Segunda pergunta gerada pela IA?
A) Resposta da IA correta ✅
B) Resposta da IA errada
C) Resposta da IA errada outra vez
D) Resposta da IA errada novamente

3. Terceira pergunta gerada pela IA?
A) Resposta da IA errada
B) Resposta da IA errada outra vez
C) Resposta da IA errada novamente
D) Resposta da IA correta ✅
```

---

## 3. Detalhamento de Formatação

1. **Numeração das Questões:**
   - Use o formato `1. `, `2. `, `3. ` (ou `1) `, `2) `).
   - Inicie sempre do número 1 e mantenha a ordem sequencial.

2. **Marcação das Alternativas:**
   - As letras devem ser sempre maiúsculas: `A)`, `B)`, `C)` e `D)`.
   - Pode ser usado fechamento por parêntese `A)` ou traço `A -`, mas recomenda-se `A)`.

3. **Indicação da Resposta Correta:**
   - Insira o emoji `✅` (código Unicode: `U+2705`) no final da alternativa correta.
   - Deixe um espaço antes do emoji (exemplo: `C) Resposta correta ✅`).
   - Não marque mais de uma alternativa com `✅` na mesma questão.

4. **Quebras de Linha e Parágrafos:**
   - É preferível colocar cada pergunta e cada alternativa em uma linha (parágrafo) própria.
   - O leitor também suporta quando o Word agrupa a questão em um único parágrafo contínuo, desde que a separação `A)`, `B)`, `C)` e `D)` esteja presente.

---

## 4. Prompt Pronto para Gerar as Questões com IA

Copie e cole o prompt abaixo no ChatGPT, Claude ou Gemini para obter o conteúdo formatado pronto para ser salvo em DOCX:

```text
Atue como um especialista em elaboração de avaliações para o Kahoot.
Crie [QUANTIDADE] questões de múltipla escolha sobre o tema [TEMA OU TEXTO-BASE].

REGRAS OBRIGATÓRIAS DE FORMATAÇÃO:
1. Cada pergunta deve ter NO MÁXIMO 120 caracteres.
2. Cada alternativa deve ter NO MÁXIMO 75 caracteres.
3. Cada questão deve ter exatamente 4 alternativas: A), B), C) e D).
4. Indique a alternativa correta inserindo o emoji ✅ ao final dela. Apenas uma alternativa correta por questão.
5. Inicie cada questão com numeração sequencial (1., 2., 3., etc.).
6. NÃO adicione nenhum texto introdutório, cabeçalho, saudação ou explicação (apenas as perguntas e respostas).

MODELO DE SAÍDA:
1. Pergunta resumida aqui?
A) Alternativa incorreta
B) Alternativa incorreta
C) Alternativa correta ✅
D) Alternativa incorreta

2. Segunda pergunta resumida?
A) Alternativa correta ✅
B) Alternativa incorreta
C) Alternativa incorreta
D) Alternativa incorreta
```

---

## 5. Checklist Rápido de Validação

Antes de carregar o arquivo `.docx` na extensão:

- [ ] Nenhuma pergunta ultrapassa **120 caracteres**.
- [ ] Nenhuma alternativa ultrapassa **75 caracteres**.
- [ ] Todas as questões possuem exatamente **4 alternativas (A, B, C, D)**.
- [ ] Todas as questões possuem exatamente **uma alternativa com o emoji ✅**.
- [ ] O documento não contém introduções, títulos genéricos ou conclusões.
- [ ] O arquivo está salvo na extensão `.docx`.
- [ ] Você está logado no Kahoot e com o editor aberto a partir da página [drafts](https://create.kahoot.it/my-library/kahoots/drafts) (botão **Create**).
