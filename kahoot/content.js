let stopped = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const visible = e => !!(e && e.getBoundingClientRect().width > 2 && e.getBoundingClientRect().height > 2);
const text = e => (e.innerText || e.textContent || '').trim();

function report(s) {
  console.log('[Kahoot DOCX]', s);
  chrome.runtime.sendMessage({ type: 'status', text: s }).catch(() => {});
}

function meta(e) {
  return [
    e.placeholder,
    e.getAttribute?.('aria-label'),
    e.getAttribute?.('data-functional-selector'),
    e.getAttribute?.('data-placeholder'),
    e.getAttribute?.('role'),
    text(e)
  ].filter(Boolean).join(' ');
}

function editableCandidates() {
  return [...document.querySelectorAll('textarea,input[type="text"],[contenteditable="true"],[role="textbox"]')].filter(visible);
}

/**
 * Dispara evento completo de mouse simulando fielmente o clique humano.
 */
function clickReal(el) {
  if (!el) return false;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;

  const downOpts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons: 1 };
  const upOpts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0, buttons: 0 };

  try { el.dispatchEvent(new PointerEvent('pointerover', upOpts)); } catch (_) {}
  try { el.dispatchEvent(new MouseEvent('mouseover', upOpts)); } catch (_) {}
  try { el.dispatchEvent(new PointerEvent('pointerdown', downOpts)); } catch (_) {}
  try { el.dispatchEvent(new MouseEvent('mousedown', downOpts)); } catch (_) {}
  if (typeof el.focus === 'function') {
    try { el.focus(); } catch (_) {}
  }
  try { el.dispatchEvent(new PointerEvent('pointerup', upOpts)); } catch (_) {}
  try { el.dispatchEvent(new MouseEvent('mouseup', upOpts)); } catch (_) {}
  try { el.dispatchEvent(new MouseEvent('click', upOpts)); } catch (_) {}
  return true;
}

/**
 * Digita texto de forma compatível com React e ProseMirror/Kahoot.
 */
async function humanType(el, textVal, delay = 40) {
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.focus();

  const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';

  if (isInput) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    const setter = el.tagName === 'TEXTAREA' ? nativeTextAreaValueSetter : nativeInputValueSetter;
    if (setter) {
      setter.call(el, textVal);
    } else {
      el.value = textVal;
    }

    if (el._valueTracker) {
      el._valueTracker.setValue(textVal === '' ? 'a' : '');
    }

    try {
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: textVal
      }));
    } catch (_) {}

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

  } else {
    // Rich-text / contenteditable
    let success = false;
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      success = document.execCommand('insertText', false, textVal);
    } catch (_) {}

    if (!success || !(el.innerText || el.textContent || '').includes(textVal.slice(0, 10))) {
      el.innerText = textVal;
    }

    try {
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: textVal
      }));
    } catch (_) {}

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  await sleep(delay);
  try {
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  } catch (_) {}
  el.blur();
}

/**
 * Localiza o elemento de pergunta.
 */
function getTitleElement() {
  const el = document.querySelector('[data-functional-selector="question-title__input"]');
  if (el && visible(el)) {
    if (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true') {
      return el;
    }
    const child = el.querySelector('[contenteditable="true"],textarea,input,[role="textbox"]');
    return child || el;
  }

  // Fallback multilíngue
  const all = editableCandidates();
  let q = all.find(e =>
    /start typing your question|comece a digitar|digite sua pergunta|escribir tu pregunta|question|pergunta/i.test(meta(e)) &&
    !/answer|resposta|respuesta/i.test(meta(e))
  );
  if (q) return q;

  const scored = all.map(e => {
    const r = e.getBoundingClientRect();
    let s = 0;
    if (r.top > 120 && r.top < 400) s += 5;
    if (r.left > 180 && r.width > 450) s += 5;
    if (r.height < 200) s += 2;
    if (/kahoot title|título do kahoot/i.test(meta(e))) s -= 20;
    return { e, s };
  }).sort((a, b) => b.s - a.s);

  return scored[0]?.s > 4 ? scored[0].e : null;
}

/**
 * Localiza os 4 campos de resposta.
 */
function getAnswerElements(qel) {
  const els = [...document.querySelectorAll('[data-functional-selector="question-answer__input"]')].filter(visible);
  if (els.length >= 4) {
    const sorted = els.sort((a, b) => {
      const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
      return Math.abs(A.top - B.top) > 30 ? A.top - B.top : A.left - B.left;
    }).slice(0, 4);

    return sorted.map(e => {
      if (e.isContentEditable || e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') return e;
      const child = e.querySelector('[contenteditable="true"],textarea,input,[role="textbox"]');
      return child || e;
    });
  }

  // Fallback
  const all = editableCandidates().filter(e => e !== qel);
  let named = all.filter(e =>
    /add answer|adicionar resposta|añadir resposta|añadir respuesta|answer|resposta|respuesta/i.test(meta(e))
  );
  if (named.length >= 4) {
    return named.sort((a, b) => {
      const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
      return Math.abs(A.top - B.top) > 30 ? A.top - B.top : A.left - B.left;
    }).slice(0, 4);
  }

  let pool = all.filter(e => {
    const r = e.getBoundingClientRect();
    return r.top > 400 && r.width > 180 && r.height < 220;
  });
  return pool.sort((a, b) => {
    const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
    return Math.abs(A.top - B.top) > 30 ? A.top - B.top : A.left - B.left;
  }).slice(0, 4);
}

function answerCard(el) {
  let best = null, n = el;
  for (let i = 0; i < 10 && n; i++, n = n.parentElement) {
    const r = n.getBoundingClientRect();
    if (r.width > 300 && r.height > 70 && r.height < 220) {
      best = n;
      if (r.width > 400) break;
    }
  }
  return best || el.parentElement;
}

function clickCorrectFallback(answerEl) {
  const card = answerCard(answerEl);
  if (!card) return false;

  const selectors = [
    'button[data-functional-selector="question-answer__toggle-button"]',
    'button[data-functional-selector*="toggle"]',
    'button[aria-label*="correct" i]',
    'button[aria-label*="correta" i]',
    'button[aria-label*="answer" i]',
    '[role="checkbox"]',
    'input[type="checkbox"]',
    'button[data-functional-selector*="correct" i]'
  ];

  for (const s of selectors) {
    for (const b of card.querySelectorAll(s)) {
      if (visible(b)) {
        b.scrollIntoView({ block: 'center' });
        b.click();
        return true;
      }
    }
  }

  const r = card.getBoundingClientRect();
  const points = [[r.right - 38, r.top + r.height / 2], [r.right - 55, r.top + r.height / 2], [r.right - 30, r.bottom - 30]];
  for (const [x, y] of points) {
    let hit = document.elementFromPoint(x, y);
    if (!hit) continue;
    let clickable = hit.closest('button,[role="button"],[role="checkbox"],label') || hit;
    if (clickable && card.contains(clickable)) {
      clickable.click();
      return true;
    }
  }
  return false;
}

function isToggleChecked(btn) {
  if (!btn) return false;
  return btn.getAttribute('aria-checked') === 'true' ||
         btn.getAttribute('data-state') === 'checked' ||
         /checked|selected/i.test(btn.className || '') ||
         btn.querySelector('svg') !== null ||
         btn.innerHTML.includes('<svg') ||
         btn.innerHTML.includes('path');
}

/**
 * Seleciona a alternativa correta com verificação dupla.
 */
async function selectCorrectAnswer(index, ans) {
  const toggles = [...document.querySelectorAll(
    '[data-functional-selector="question-answer__toggle-button"]'
  )].filter(visible);

  if (toggles.length >= 4) {
    toggles.sort((a, b) => {
      const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
      return Math.abs(A.top - B.top) > 30 ? A.top - B.top : A.left - B.left;
    });

    const target = toggles[index];
    if (target) {
      target.scrollIntoView({ block: 'center' });
      target.click();
      await sleep(100);

      // Se ainda não estiver visualmente marcado, força via clique completo
      if (!isToggleChecked(target)) {
        clickReal(target);
        await sleep(100);
      }
      return true;
    }
  }

  if (ans && ans[index]) {
    return clickCorrectFallback(ans[index]);
  }
  return false;
}

/**
 * Preenche a questão inteira com verificação de integridade dos campos.
 */
async function fill(q) {
  const qel = getTitleElement();
  if (!qel) throw Error('Campo da pergunta não encontrado no editor do Kahoot.');

  await humanType(qel, q.question);
  await sleep(60);

  // Verificação de reforço do título caso o editor rich text tenha oscilado
  const currentTitle = (qel.value || qel.innerText || qel.textContent || '').trim();
  if (!currentTitle.includes(q.question.slice(0, 10))) {
    await humanType(qel, q.question);
    await sleep(60);
  }

  const ans = getAnswerElements(qel);
  if (ans.length < 4) throw Error(`Encontrei apenas ${ans.length} campos de resposta.`);

  for (let i = 0; i < 4; i++) {
    if (!ans[i]) continue;
    await humanType(ans[i], q.answers[i]);
    await sleep(50);
  }
  await sleep(100);

  await selectCorrectAnswer(q.correct, ans);
  await sleep(100);

  // Notifica o formulário oficial do Kahoot para consolidar o estado
  const form = document.querySelector('[data-functional-selector="question-form"]') || document.querySelector('form');
  if (form) {
    form.dispatchEvent(new Event('change', { bubbles: true }));
    form.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await sleep(150);

  report(`Questão ${q.number}/${window.__KAHOOT_QUESTIONS?.length || 1} preenchida. Correta: ${'ABCD'[q.correct]}`);
}

/**
 * Rola a barra lateral esquerda até o fim para manter o botão + Add acessível.
 */
function scrollSidebarToBottom() {
  for (const e of document.querySelectorAll('*')) {
    const r = e.getBoundingClientRect();
    if (r.left < 260 && r.width > 100 && r.width < 340 && e.scrollHeight > e.clientHeight + 10) {
      try { e.scrollTop = e.scrollHeight; } catch (_) {}
    }
  }
}

/**
 * Clica no botão "+ Add" da barra lateral esquerda.
 */
function clickAddQuestion() {
  scrollSidebarToBottom();

  const btn =
    document.querySelector('button[data-functional-selector="add-question-button"]') ||
    document.querySelector('[data-functional-selector*="add-question"]') ||
    [...document.querySelectorAll('button,[role="button"]')].find(b =>
      visible(b) && /^\+?\s*(Add|Adicionar|Add question|Adicionar questão|Adicionar pergunta)$/i.test(text(b).replace(/\s+/g, ' ').trim())
    );

  if (!btn) throw Error('Não encontrei o botão azul + Add da barra lateral.');
  btn.scrollIntoView({ block: 'center' });
  btn.click();
}

/**
 * Aguarda e clica no card "Quiz" no painel de tipos de questão.
 */
async function selectQuizQuestionType() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const quizBtn =
      document.querySelector('button[data-functional-selector="create-button__quiz"]') ||
      [...document.querySelectorAll('button,[role="button"]')].find(b =>
        visible(b) && /^Quiz$/i.test(text(b))
      );

    if (quizBtn && visible(quizBtn)) {
      quizBtn.scrollIntoView({ block: 'center' });
      quizBtn.click();
      return true;
    }
    await sleep(100);
  }
  throw Error('O painel abriu, mas o card Quiz não foi encontrado.');
}

/**
 * Aguarda a nova questão vazia ser totalmente renderizada na tela antes de digitar.
 */
async function waitForNewQuestionReady() {
  for (let i = 0; i < 40; i++) {
    await sleep(100);
    const quizBtn = document.querySelector('button[data-functional-selector="create-button__quiz"]');
    const qel = getTitleElement();
    // Modal fechou e o campo de pergunta está presente
    if (!quizBtn && qel) {
      await sleep(300); // margem para estabilização de render
      return true;
    }
  }
  return true;
}

/**
 * Executa o fluxo para todas as questões com delays seguros.
 */
async function runAll(start, delay) {
  const qs = window.__KAHOOT_QUESTIONS || [];
  stopped = false;
  const stepDelay = Math.max(800, delay || 3000);

  for (let i = start - 1; i < qs.length; i++) {
    if (stopped) {
      report('Execução parada pelo usuário.');
      return;
    }

    report(`Preenchendo questão ${qs[i].number}/${qs.length}...`);
    await fill(qs[i]);
    report(`Questão ${qs[i].number}/${qs.length} preenchida.`);

    if (i < qs.length - 1) {
      await sleep(stepDelay);
      report('Adicionando novo Quiz...');
      clickAddQuestion();
      await sleep(300);
      await selectQuizQuestionType();
      await waitForNewQuestionReady();
    }
  }

  report(`Concluído: ${qs.length} questões processadas com sucesso! Revise antes de salvar/publicar.`);
}

if (!window.__KAHOOT_DOCX_LISTENER_INSTALLED_V15) {
  window.__KAHOOT_DOCX_LISTENER_INSTALLED_V15 = true;
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (m.action === 'ping') {
      reply({ status: 'Editor do Kahoot conectado (v15).' });
      return;
    }
    if (m.action === 'stop') {
      stopped = true;
      report('Parando...');
      reply({ status: 'Parando...' });
      return;
    }
    if (m.action === 'one' || m.action === 'all') {
      if (!Array.isArray(m.questions) || !m.questions.length) {
        reply({ status: 'ERRO: selecione um DOCX com questões primeiro.' });
        return;
      }
      window.__KAHOOT_QUESTIONS = m.questions;
      const total = m.questions.length;
      const i = Math.max(1, Math.min(total, m.start || 1));

      if (m.action === 'one') {
        fill(m.questions[i - 1])
          .catch(e => report('ERRO: ' + e.message));
        reply({ status: `Inserindo questão ${i}/${total}...` });
        return;
      }

      runAll(i, Math.max(800, m.delay || 3000)).catch(e => report('ERRO: ' + e.message));
      reply({ status: `Iniciando na questão ${i}/${total}...` });
    }
  });
}
