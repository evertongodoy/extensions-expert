Kahoot — Inseridor por DOCX v12

Correção (v12): as questões eram criadas, mas ao trocar de uma para criar a
próxima, o Kahoot resetava a anterior para vazia (card "Question" genérico
com "!"), mesmo com todas as questões e alternativas certas no DOCX.

Causa provável: corrida entre o autosave do Kahoot e a troca de questão. O
script clicava em "+ Add" para criar a próxima questão antes do Kahoot
terminar de sincronizar/persistir o que tinha acabado de ser digitado na
anterior — ao criar a nova questão, o app parece recarregar/re-renderizar o
estado da lista, e a edição ainda não salva se perde. Ao preencher
manualmente isso não acontece porque naturalmente demoramos mais entre uma
ação e outra.

Correções aplicadas:
- O tempo mínimo de espera entre questões subiu de 900ms para 1500ms (padrão
  sugerido no popup: 3000ms, era 1400ms).
- Antes de clicar em "+ Add" para a próxima questão, o script agora espera a
  página "ficar quieta" (sem mutações no DOM por ~600ms, com teto de
  segurança) — um proxy de que o Kahoot terminou de reagir ao que foi
  digitado, em vez de simplesmente contar um tempo fixo.
- Depois de preencher a pergunta, o script confere se o texto realmente
  ficou no editor; se não, tenta inserir de novo antes de seguir em frente.

Se ainda acontecer de alguma questão voltar vazia depois desse ajuste, me
mande o HTML de um card de questão incompleto (o quadradinho "Question" com
o "!" roxo, na barra lateral esquerda) — com um seletor estável, dá pra
implementar uma verificação automática que reabre e repreenche qualquer
questão que tenha sido resetada, exatamente como fizemos com os botões
+Add e Quiz.

Correção (v11, mantida): o card Quiz é localizado pelo atributo estável
data-functional-selector="create-button__quiz".

Correção (v10, mantida): o botão "+ Add" é localizado pelo atributo estável
data-functional-selector="add-question-button", evitando clicar numa <div>
"wrapper" que não dispara o onClick do React.

Correção (v9, mantida): a busca do botão "+ Add" não trava mais numa faixa
fixa de posição vertical.

Correção (v6, mantida): evita duplicação/triplicação do texto da pergunta no
editor rich-text do Kahoot.


## v13
Antes de criar o próximo Quiz, força blur/focusout dos campos, clica em uma área neutra e aguarda a confirmação de autosave do Kahoot (Saved to: Your drafts). Isso evita navegar para a próxima questão enquanto a atual ainda está apenas no estado visual do editor.

## v14 — corrige a perda de dados ao criar o próximo Quiz (bug reportado no v13)
Diagnóstico (via gravação de tela, frame a frame): o texto "Saved to: Your
drafts" já aparece fixo no cabeçalho do Kahoot desde o carregamento da
página, ANTES de qualquer edição. A checagem do v13 aceitava esse texto
como "confirmação de save" depois de só ~2.5s, mesmo sem nunca ter visto o
indicador "Saving" aparecer — ou seja, era um falso positivo: a extensão
achava que tinha salvo e criava o próximo Quiz, e o Kahoot descartava a
edição da questão anterior, que ainda não tinha sido de fato persistida. No
vídeo, o "Saving" real só aparece depois de clicar em "+ Add" (a mudança
estrutural), não a cada edição de texto.

Mudanças:
- `commitAndWaitSaved()` agora só aceita como "salvo" uma transição real
  observada (sumiu "Saved" → apareceu "Saving" → voltou "Saved"). Se nunca
  observar essa transição, não confia mais no texto fixo do cabeçalho — em
  vez disso aguarda uma folga fixa bem maior (4.5s) antes de seguir.
- Nova função `ensureQuestionIntact()`: logo antes de clicar em "+ Add",
  relê a pergunta e as 4 respostas diretamente da tela e compara com o que
  deveria estar lá; se sumiu, refaz o preenchimento (até 2 tentativas)
  antes de avançar, em vez de só descobrir o problema depois.
- Trava de segurança `anySidebarWarningVisible()`: depois de criar o
  próximo Quiz, verifica (heurística por forma/posição, já que não temos
  acesso ao DOM real do Kahoot para confirmar a marcação exata) se algum
  item da barra lateral esquerda ficou marcado como incompleto. Se sim, a
  execução para IMEDIATAMENTE com uma mensagem de alerta, em vez de
  continuar e corromper as questões restantes.
- Espera mínima entre questões subiu de 1500ms/3000ms para 3000ms/3000ms
  (piso mais seguro, ainda configurável no popup).

## v15 — correção definitiva da sincronização ao criar novo Quiz (+ Add)
Causa real identificada:
1. **Estado do React não atualizado**: a versão anterior alterava o DOM diretamente ou chamava o setter de prototype sem resetar o `_valueTracker` do React e sem emitir `InputEvent` compatível (`inputType: 'insertText'`, `data`). Com isso, visualmente o texto aparecia, mas o estado interno do React continuava vazio. Ao clicar em "+ Add", o componente anterior era desmontado ou re-renderizado a partir do seu estado interno vazio, fazendo a questão anterior apagar.
2. **Seletores oficiais e multilíngue**: o Kahoot possui atributos estáveis `data-functional-selector` (`question-title__input`, `question-answer__input`, `question-answer__toggle-button` e `question-form`). A versão anterior dependia de regexes em inglês (`/start typing your question/i`) e heurísticas de coordenadas que falhavam na interface em português.
3. **Seleção de alternativa correta estável**: os botões de resposta correta agora usam `[data-functional-selector="question-answer__toggle-button"]`, garantindo que a questão seja validada pelo Kahoot como completa.
4. **Remoção de falsos positivos**: removida a verificação que detectava o "!" da *nova* questão vazia recém-criada e cancelava a execução por engano.
5. **Autosave sem travamento**: removido o timeout de 16 segundos da v14 que procurava texto fixo em inglês. O formulário do Kahoot agora é notificado diretamente via evento `change` e `input`, salvando de forma rápida e segura.
