import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = await readFile(join(here, '..', 'client.js'), 'utf8');

function fakeReact() {
  const element = (type, props, ...children) => {
    const merged = props == null ? {} : { ...props };
    if (children.length === 1) merged.children = children[0];
    else if (children.length > 1) merged.children = children;
    return { type, props: merged };
  };
  return {
    createElement: element,
    Fragment: 'Fragment',
    useCallback: (fn) => fn,
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
  };
}

function bootClient() {
  const loaded = [];
  const created = [];
  const fetched = [];
  let respond = async () => ({ ok: true, json: async () => ({ ok: true, notes: [], file: '' }) });

  const document = {
    listeners: new Map(),
    addEventListener(type, listener, options) {
      const list = document.listeners.get(type) ?? [];
      list.push({ listener, options });
      document.listeners.set(type, list);
    },
    removeEventListener(type, listener) {
      const list = document.listeners.get(type) ?? [];
      document.listeners.set(type, list.filter((entry) => entry.listener !== listener));
    },
    createElement(tag) {
      const element = {
        tag,
        attributes: {},
        textContent: '',
        setAttribute(name, value) { element.attributes[name] = value; },
        remove() { element.removed = true; },
      };
      created.push(element);
      return element;
    },
    head: { appendChild(element) { element.appended = true; } },
  };
  const window = {
    __ModuleLoader__: { load(registration) { loaded.push(registration); } },
    setTimeout,
    clearTimeout,
  };
  const sandbox = {
    window,
    document,
    console,
    setTimeout,
    clearTimeout,
    fetch: (...args) => {
      fetched.push(args);
      return respond(...args);
    },
  };
  vm.runInContext(source, vm.createContext(sandbox), { filename: 'client.js' });

  assert.equal(loaded.length, 1, 'client bundle must register exactly one module');
  assert.equal(loaded[0].id, 'dsh-note-wall');

  const react = fakeReact();
  const module = loaded[0].factory((specifier) => {
    assert.equal(specifier, 'react');
    return react;
  });
  return {
    module,
    react,
    document,
    created,
    fetched,
    setRespond(impl) { respond = impl; },
  };
}

function bootApply() {
  const { module, created, document, fetched, setRespond } = bootClient();
  const effects = [];
  const injected = [];
  const registrations = [];
  const selected = [];
  let dictionary = null;
  const t = (key) => `t:${key}`;

  const ctx = {
    layout: {
      selectPanel(panelId) { selected.push(panelId); },
    },
    effect(callback, label) {
      const cleanup = callback();
      effects.push({ label, cleanup });
      return cleanup;
    },
    locale: {
      bind: () => t,
      register: (namespace, dict) => {
        dictionary = { namespace, dict };
        return () => {};
      },
    },
    slots: {
      inject(key, callback) {
        injected.push(key);
        return callback();
      },
      register(options, component) {
        registrations.push({ options, component });
        return () => {};
      },
    },
  };

  module.apply(ctx);
  return { module, created, document, fetched, setRespond, effects, injected, registrations, dictionary, selected };
}

function findByClass(node, className) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByClass(child, className);
      if (found !== null) return found;
    }
    return null;
  }
  if (node === null || node === undefined || typeof node !== 'object') return null;
  const props = node.props ?? {};
  if (props.className === className) return node;
  return findByClass(props.children, className);
}

function dispatch(document, type, event) {
  const entries = document.listeners.get(type) ?? [];
  assert.ok(entries.length > 0, `expected a ${type} listener on document`);
  for (const { listener } of entries) listener(event);
}

function fakeDragTarget(editable = false) {
  return {
    closest(selector) {
      return editable && selector.includes('textarea') ? { tagName: 'TEXTAREA' } : null;
    },
    isContentEditable: false,
  };
}

function fakeDataTransfer(data, types = ['text/plain']) {
  return {
    types,
    dropEffect: 'none',
    getData(type) {
      return data[type] ?? '';
    },
  };
}

function dragEvent(document, target, dataTransfer) {
  return {
    defaultPrevented: false,
    target,
    dataTransfer,
    preventDefault() { this.defaultPrevented = true; },
    relatedTarget: target,
  };
}

test('client bundle registers the note-wall module with a usable face', () => {
  const { module } = bootClient();
  assert.equal(module.name, 'note-wall');
  assert.deepEqual([...module.inject], ['slots', 'locale', 'layout']);
  assert.equal(typeof module.apply, 'function');
  assert.equal(typeof module.__internals.prepareDropText, 'function');
  assert.equal(typeof module.__internals.buildWishPrompt, 'function');
  assert.deepEqual([...module.__internals.COLORS], ['amber', 'rose', 'sky', 'mint', 'violet', 'cream', 'lime']);
});

test('apply registers dictionaries, styles, the sidebar entry, the main panel and the drop overlay', () => {
  const { created, injected, registrations, dictionary, effects } = bootApply();

  assert.equal(dictionary.namespace, 'noteWall');
  assert.deepEqual(
    Object.keys(dictionary.dict.zh).sort(),
    Object.keys(dictionary.dict.en).sort(),
    'zh and en dictionaries must expose the same keys',
  );
  for (const key of ['confirmDeleteAsk', 'dropHint', 'dropSaved', 'dropOpen', 'dropUnsupported', 'dropFailed', 'dropTip', 'wish', 'wishHint', 'wishNoSession', 'wishFailed']) {
    assert.equal(typeof dictionary.dict.zh[key], 'string');
    assert.equal(typeof dictionary.dict.en[key], 'string');
  }

  const style = created.find((element) => element.tag === 'style');
  assert.ok(style, 'a style element is injected');
  assert.equal(style.attributes['data-plugin'], 'dsh-note-wall');
  assert.equal(style.appended, true);
  assert.ok(style.textContent.includes('.nw-page'));
  assert.ok(style.textContent.includes('.nw-drop'), 'drop overlay styles are part of the injected CSS');
  assert.ok(style.textContent.includes('.nw-wish'), 'wish button styles are part of the injected CSS');
  assert.ok(style.textContent.includes('.nw-confirm'), 'inline delete confirmation styles are part of the injected CSS');

  assert.deepEqual(injected, ['sidebar.panellist', 'main', 'shell.overlay', 'conversation.composer.dock']);
  assert.equal(registrations.length, 4);
  assert.ok(
    effects.some((effect) => effect.label === 'note-wall: drop capture'),
    'the drop capture listener effect is registered',
  );

  const [entry, panel, overlay, composerDock] = registrations;
  assert.equal(entry.options.name, 'sidebar.panellist');
  assert.equal(entry.options.id, 'note-wall');
  assert.equal(entry.options.order, 2);
  assert.equal(entry.options.locale, 'noteWall');
  assert.equal(typeof entry.options.label, 'function');
  assert.equal(typeof entry.component, 'function');

  assert.equal(panel.options.name, 'main');
  assert.equal(panel.options.key, 'note-wall');
  assert.equal(panel.options.locale, 'noteWall');
  assert.equal(typeof panel.component, 'function');

  assert.equal(overlay.options.name, 'shell.overlay');
  assert.equal(overlay.options.id, 'note-wall-drop');
  assert.equal(overlay.options.locale, 'noteWall');
  assert.equal(typeof overlay.component, 'function');

  assert.equal(composerDock.options.name, 'conversation.composer.dock');
  assert.equal(composerDock.options.id, 'note-wall-wish-bridge');
  assert.equal(composerDock.options.locale, 'noteWall');
  assert.equal(typeof composerDock.component, 'function');
});

test('drop capture listens on the document and cleans up', () => {
  const { document, effects } = bootApply();

  assert.equal(document.listeners.get('dragover').length, 1);
  assert.equal(document.listeners.get('dragleave').length, 1);
  assert.equal(document.listeners.get('drop').length, 1);
  assert.equal(document.listeners.get('dragstart').length, 1);
  assert.equal(document.listeners.get('dragstart')[0].options, true, 'dragstart is captured to detect in-app drags');
  assert.equal(document.listeners.get('dragend')[0].options, true);

  const capture = effects.find((effect) => effect.label === 'note-wall: drop capture');
  assert.equal(typeof capture.cleanup, 'function');
  capture.cleanup();
  assert.equal(document.listeners.get('drop').length, 0);
  assert.equal(document.listeners.get('dragover').length, 0);
});

test('dragging external text over the app shows the hint and accepts the drop', () => {
  const { module, document, effects } = bootApply();
  const { getDropState, setDropState } = module.__internals;
  setDropState({ mode: 'idle', detail: '' });

  const event = dragEvent(document, fakeDragTarget(false), fakeDataTransfer({ 'text/plain': 'hello' }));
  dispatch(document, 'dragover', event);

  assert.equal(event.defaultPrevented, true, 'text drags must be accepted');
  assert.equal(event.dataTransfer.dropEffect, 'copy');
  assert.equal(getDropState().mode, 'drag');
  assert.equal(getDropState().detail, '');

  const capture = effects.find((effect) => effect.label === 'note-wall: drop capture');
  capture.cleanup();
  assert.equal(getDropState().mode, 'idle');
});

test('dragging over a text field keeps native insertion', () => {
  const { module, document, effects } = bootApply();
  const { getDropState, setDropState } = module.__internals;
  setDropState({ mode: 'idle', detail: '' });

  const event = dragEvent(document, fakeDragTarget(true), fakeDataTransfer({ 'text/plain': 'hello' }));
  dispatch(document, 'dragover', event);

  assert.equal(event.defaultPrevented, false);
  assert.equal(getDropState().mode, 'idle');

  const capture = effects.find((effect) => effect.label === 'note-wall: drop capture');
  capture.cleanup();
});

test('dropping text saves a note through the host API', async () => {
  const { module, document, effects, fetched, setRespond } = bootApply();
  const { getDropState, setDropState, COLORS } = module.__internals;
  setDropState({ mode: 'idle', detail: '' });
  setRespond(async () => ({
    ok: true,
    json: async () => ({ ok: true, notes: [{ id: 'n1', text: 'hello world', color: 'amber' }], file: 'notes.json' }),
  }));

  const event = dragEvent(document, fakeDragTarget(false), fakeDataTransfer({ 'text/plain': 'hello world\r\n' }));
  dispatch(document, 'drop', event);

  assert.equal(event.defaultPrevented, true);
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(fetched.length, 1);
  assert.equal(fetched[0][0], '/api/note-wall/notes');
  assert.equal(fetched[0][1].method, 'POST');
  const body = JSON.parse(fetched[0][1].body);
  assert.equal(body.text, 'hello world');
  assert.ok(COLORS.includes(body.color));
  assert.equal(getDropState().mode, 'saved');

  const capture = effects.find((effect) => effect.label === 'note-wall: drop capture');
  capture.cleanup();
});

test('overlay renders saved feedback and its view button opens the panel', () => {
  const { module, registrations, selected } = bootApply();
  const { getDropState, setDropState } = module.__internals;
  const overlay = registrations.find((entry) => entry.options.name === 'shell.overlay');
  const element = overlay.component();
  const { t } = element.props;

  setDropState({ mode: 'idle', detail: '' });
  assert.equal(element.type(element.props), null, 'overlay renders nothing while idle');

  setDropState({ mode: 'saved', detail: '' });
  const tree = element.type(element.props);
  assert.notEqual(tree, null);
  assert.equal(tree.props['data-mode'], 'saved');
  assert.ok(findByClass(tree, 'nw-drop-title').props.children.includes('t:dropSaved'));

  const button = findByClass(tree, 'nw-drop-open');
  assert.ok(button, 'the saved state exposes a view button');
  assert.equal(button.props.children, 't:dropOpen');
  button.props.onClick();
  assert.deepEqual(selected, ['note-wall']);
  assert.equal(getDropState().mode, 'idle');
  assert.equal(t('dropSaved'), 't:dropSaved');
});

test('buildWishPrompt turns a note into a structured, actionable prompt', () => {
  const { module } = bootClient();
  const prompt = module.__internals.buildWishPrompt({ text: '做一个便签墙 #idea', color: 'amber' });

  assert.ok(prompt.includes('做一个便签墙 #idea'), 'the note text is embedded verbatim');
  assert.ok(prompt.includes('【灵感原文】'));
  assert.ok(prompt.includes('【标签】#idea'));
  assert.ok(prompt.includes('【请你完成】'));
  assert.ok(prompt.includes('【约束】'));
  assert.ok(prompt.includes('中文'));

  const plain = module.__internals.buildWishPrompt({ text: '普通的灵感' });
  assert.ok(!plain.includes('【标签】'), 'a note without a tag has no tag section');
  assert.ok(plain.includes('普通的灵感'));
});

test('drag helpers normalise text, classify drags and detect editable targets', () => {
  const { module } = bootClient();
  const {
    MAX_TEXT,
    COLORS,
    htmlToText,
    normalizeDroppedText,
    prepareDropText,
    extractDropText,
    dragKind,
    isEditableTarget,
    pickDropColor,
  } = module.__internals;

  assert.equal(MAX_TEXT, 5000);

  assert.equal(
    normalizeDroppedText('  one  \r\n\r\ntwo\r\n\r\n\r\nthree\t '),
    'one\n\ntwo\n\nthree',
  );
  assert.equal(htmlToText('<p>Hello <b>world</b></p><p>line2 &amp; more</p>').trim(), 'Hello world\n\nline2 & more');
  assert.equal(htmlToText('<script>bad()</script><style>.x{}</style>ok'), '  ok');

  const short = prepareDropText(' hello ');
  assert.equal(short.text, 'hello');
  assert.equal(short.truncated, false);
  const long = prepareDropText('x'.repeat(MAX_TEXT + 20));
  assert.equal(long.text.length, MAX_TEXT);
  assert.equal(long.truncated, true);
  assert.equal(prepareDropText('   \n  ').text, '');

  assert.equal(dragKind({ types: ['text/plain'] }), 'text');
  assert.equal(dragKind({ types: ['text/html', 'text/plain'] }), 'text');
  assert.equal(dragKind({ types: ['Files'] }), 'files');
  assert.equal(dragKind({ types: ['application/x-custom'] }), 'other');
  assert.equal(dragKind({}), 'none');

  assert.equal(extractDropText(fakeDataTransfer({ 'text/plain': 'plain' })), 'plain');
  assert.equal(extractDropText(fakeDataTransfer({ 'text/html': '<p>rich</p>' }, ['text/html'])).trim(), 'rich');
  assert.equal(
    extractDropText(fakeDataTransfer({ 'text/uri-list': '# comment\r\nhttps://example.com/a\r\nhttps://example.com/b' }, ['text/uri-list'])),
    'https://example.com/a',
  );
  assert.equal(
    extractDropText({ getData() { throw new Error('blocked'); } }),
    '',
    'an unreadable dataTransfer must not throw',
  );

  assert.equal(isEditableTarget(null), false);
  assert.equal(isEditableTarget(fakeDragTarget(true)), true);
  assert.equal(isEditableTarget(fakeDragTarget(false)), false);
  assert.equal(isEditableTarget({ isContentEditable: true }), true);

  const color = pickDropColor('some dropped text');
  assert.ok(COLORS.includes(color));
  assert.equal(pickDropColor('some dropped text'), color, 'colour picking is deterministic');
});
