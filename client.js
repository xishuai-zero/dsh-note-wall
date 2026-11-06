/**
 * dsh-note-wall — browser half.
 *
 * Registers the sidebar entry (icon row) and the matching main panel. All
 * durable state lives in the host half; this file only renders and calls the
 * same-origin `/api/note-wall` routes.
 */

window.__ModuleLoader__.load({
  id: 'dsh-note-wall',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { Fragment, useCallback, useEffect, useMemo, useRef, useState } = React;

    const NS = 'noteWall';
    const PANEL_ID = 'note-wall';
    const API = '/api/note-wall';
    const COLORS = ['amber', 'rose', 'sky', 'mint', 'violet', 'cream', 'lime'];
    // The browser half cannot import src/store.mjs, so MAX_TEXT mirrors it.
    const MAX_TEXT = 5000;
    const HTML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

    const DICT = {
      zh: {
        nav: '便签墙',
        title: '便签墙',
        subtitle: '每个灵感，都值得记下。便签自动保存。',
        search: '搜索便签',
        countNotes: '{n} 张便签',
        export: '导出 Markdown',
        exportTitle: '便签墙导出',
        exportTime: '导出时间',
        exportCount: '便签数量',
        pinnedLabel: '置顶',
        placeholder: '写下你的下一个灵感…',
        composerHint: '⌘/Ctrl + Enter',
        add: '添加到墙上',
        adding: '添加中…',
        added: '已添加',
        justNow: '刚刚',
        minutesAgo: ' 分钟前',
        hoursAgo: ' 小时前',
        yesterday: '昨天',
        monthDay: '{m}月{d}日',
        untagged: '灵感',
        empty: '还没有便签，写下第一条灵感吧。',
        emptyFiltered: '没有匹配的便签。',
        loading: '正在加载便签…',
        failed: '便签墙操作失败',
        retry: '重试',
        delete: '删除',
        confirmDelete: '再点一次删除',
        edit: '编辑便签',
        editHint: '⌘/Ctrl + Enter 保存 · Esc 取消',
        pin: '置顶',
        unpin: '取消置顶',
        filterTag: '标签筛选',
        clearFilter: '清除筛选',
        save: '保存',
        cancel: '取消',
        wish: '心想事成',
        wishHint: '把这个灵感整理成可执行的 prompt 并填入会话输入框',
        wishNoSession: '没有可用的会话输入框，请先打开或新建一个会话',
        wishFailed: '填入会话输入框失败，请重试',
        wishOptimizing: '正在通过 PromptOptimizer 优化…',
        wishOptimized: '已由 PromptOptimizer 优化',
        wishFallback: 'PromptOptimizer 不可用，已改用本地模板',
        wishSaved: '已填入会话输入框',
        tooLong: '便签最多 5000 字，请删减后再保存',
        storageHint: '保存在本机：{file}',
        dropTip: '也可以从 QQ、浏览器等软件把文字拖进来',
        dropHint: '松开即可保存到便签墙',
        dropSaving: '正在保存…',
        dropSaved: '已保存到便签墙',
        dropTruncated: '文字超过 {n} 字，已截断保存',
        dropOpen: '查看',
        dropUnsupported: '没有识别到文字；暂只支持拖入文字',
        dropFailed: '拖入的文字保存失败',
        color_amber: '琥珀色',
        color_rose: '玫瑰色',
        color_sky: '天蓝色',
        color_mint: '薄荷色',
        color_violet: '紫罗兰色',
        color_cream: '米白色',
        color_lime: '青柠绿',
      },
      en: {
        nav: 'Note Wall',
        title: 'Note Wall',
        subtitle: 'Every spark is worth keeping. Notes save automatically.',
        search: 'Search notes',
        countNotes: '{n} notes',
        export: 'Export Markdown',
        exportTitle: 'Note Wall Export',
        exportTime: 'Exported at',
        exportCount: 'Notes',
        pinnedLabel: 'Pinned',
        placeholder: 'Write down your next idea…',
        composerHint: '⌘/Ctrl + Enter',
        add: 'Add to wall',
        adding: 'Adding…',
        added: 'Added',
        justNow: 'Just now',
        minutesAgo: ' min ago',
        hoursAgo: ' h ago',
        yesterday: 'Yesterday',
        monthDay: '{m}/{d}',
        untagged: 'Idea',
        empty: 'No notes yet. Write down your first idea.',
        emptyFiltered: 'No notes match this filter.',
        loading: 'Loading notes…',
        failed: 'Note wall request failed',
        retry: 'Retry',
        delete: 'Delete',
        confirmDelete: 'Click again to delete',
        edit: 'Edit note',
        editHint: '⌘/Ctrl + Enter to save · Esc to cancel',
        pin: 'Pin to top',
        unpin: 'Unpin',
        filterTag: 'Tag filter',
        clearFilter: 'Clear filter',
        save: 'Save',
        cancel: 'Cancel',
        wish: 'Make it happen',
        wishHint: 'Turn this idea into an actionable prompt in the conversation composer',
        wishNoSession: 'No conversation composer is available — open or start a conversation first',
        wishFailed: 'Could not fill the conversation composer',
        wishOptimizing: 'Optimizing with PromptOptimizer…',
        wishOptimized: 'Optimized by PromptOptimizer',
        wishFallback: 'PromptOptimizer is unavailable — used the local template',
        wishSaved: 'Filled into the conversation composer',
        tooLong: 'Notes are capped at 5000 characters — shorten it before saving',
        storageHint: 'Stored locally: {file}',
        dropTip: 'You can also drag text here from QQ, browsers and other apps',
        dropHint: 'Release to save to the note wall',
        dropSaving: 'Saving…',
        dropSaved: 'Saved to the note wall',
        dropTruncated: 'Text over {n} characters — saved after truncation',
        dropOpen: 'View',
        dropUnsupported: 'No text found — only dropped text is supported',
        dropFailed: 'Could not save the dropped text',
        color_amber: 'Amber',
        color_rose: 'Rose',
        color_sky: 'Sky',
        color_mint: 'Mint',
        color_violet: 'Violet',
        color_cream: 'Cream',
        color_lime: 'Lime',
      },
    };

    // ── helpers ─────────────────────────────────────────────────────────────

    function pad2(value) {
      return String(value).padStart(2, '0');
    }

    function formatStamp(value) {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }

    function relativeTime(t, value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const diff = Date.now() - date.getTime();
      if (diff < 60_000) return t('justNow');
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}${t('minutesAgo')}`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}${t('hoursAgo')}`;
      if (diff < 172_800_000) return t('yesterday');
      return t('monthDay').replace('{m}', String(date.getMonth() + 1)).replace('{d}', String(date.getDate()));
    }

    function orderNotes(notes) {
      return [...notes].sort((left, right) => {
        const pin = (right.pinned === true ? 1 : 0) - (left.pinned === true ? 1 : 0);
        if (pin !== 0) return pin;
        return String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? ''));
      });
    }

    function tagsOf(text) {
      const found = [];
      const pattern = /(?:^|[\s(（\[【>])#([\p{L}\p{N}_-]{1,24})/gu;
      let match = pattern.exec(text);
      while (match !== null) {
        found.push(match[1]);
        match = pattern.exec(text);
      }
      return found;
    }

    async function apiRequest(path, init) {
      const response = await fetch(`${API}${path}`, {
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        ...init,
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        // a non-JSON body is reported below
      }
      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error ?? `http-${response.status}`);
      }
      return payload;
    }

    function buildMarkdown(t, notes) {
      const lines = [`# ${t('exportTitle')}`, ''];
      lines.push(`- ${t('exportTime')}: ${formatStamp(new Date())}`);
      lines.push(`- ${t('exportCount')}: ${notes.length}`, '');
      for (const note of orderNotes(notes)) {
        const badge = note.pinned ? ` · ${t('pinnedLabel')}` : '';
        lines.push(`## ${formatStamp(note.updatedAt)}${badge}`, '');
        lines.push(note.text.split('\n').map((line) => (line === '' ? '>' : `> ${line}`)).join('\n'), '');
      }
      return lines.join('\n');
    }

    function downloadMarkdown(t, notes) {
      const stamp = formatStamp(new Date());
      const name = `note-wall-${stamp.slice(0, 10)}-${stamp.slice(11).replace(':', '')}.md`;
      const blob = new Blob([buildMarkdown(t, notes)], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    // ── drag & drop helpers ────────────────────────────────────────────────

    function dataTransferTypes(value) {
      if (value === null || value === undefined) return [];
      let length = 0;
      try {
        length = Number(value.length ?? 0);
      } catch {
        return [];
      }
      const types = [];
      for (let index = 0; index < length; index += 1) {
        try {
          types.push(String(value[index] ?? ''));
        } catch {
          break;
        }
      }
      return types;
    }

    function hasTextDrag(types) {
      return dataTransferTypes(types).some((type) => type.toLowerCase().startsWith('text/'));
    }

    /** Classify one in-flight drag as text, files, or something we cannot read. */
    function dragKind(dataTransfer) {
      const types = dataTransferTypes(dataTransfer?.types);
      if (types.some((type) => type.toLowerCase() === 'files')) return 'files';
      if (types.some((type) => type.toLowerCase().startsWith('text/'))) return 'text';
      return types.length === 0 ? 'none' : 'other';
    }

    /** True when the drop target is a text field, so the browser keeps native insertion. */
    function isEditableTarget(target) {
      if (target === null || typeof target !== 'object') return false;
      const editable = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [data-lexical-editor]';
      if (typeof target.closest === 'function') {
        try {
          if (target.closest(editable) !== null) return true;
        } catch {
          // fall through to the node-level check
        }
      }
      return target.isContentEditable === true;
    }

    function readDataTransferType(dataTransfer, type) {
      if (dataTransfer === null || dataTransfer === undefined || typeof dataTransfer.getData !== 'function') return '';
      try {
        return String(dataTransfer.getData(type) ?? '');
      } catch {
        return '';
      }
    }

    function fromCodePoint(code) {
      if (!Number.isFinite(code)) return '';
      try {
        return String.fromCodePoint(code);
      } catch {
        return '';
      }
    }

    function decodeHtmlEntities(value) {
      return String(value ?? '')
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => fromCodePoint(Number.parseInt(code, 16)))
        .replace(/&#(\d+);/g, (_, code) => fromCodePoint(Number.parseInt(code, 10)))
        .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, name) => HTML_ENTITIES[String(name).toLowerCase()] ?? '');
    }

    /** Best-effort HTML → text for drags that only carry `text/html` (e.g. rich snippets). */
    function htmlToText(html) {
      const flattened = String(html ?? '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|li|h[1-6]|blockquote|pre|tr|section|article|table|ul|ol)>/gi, '\n')
        .replace(/<(?:p|div|li|h[1-6]|blockquote|pre|tr|section|article|table|ul|ol)(?:\s[^>]*)?>/gi, '\n')
        .replace(/<[^>]*>/g, '');
      return decodeHtmlEntities(flattened);
    }

    /** Collapse CRLF, edge spaces and runs of blank lines so dropped chat text stays tidy. */
    function normalizeDroppedText(value) {
      return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => line.replace(/[ \t\u00a0]+$/g, '').replace(/^[ \t]+/g, ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    function prepareDropText(raw) {
      const text = normalizeDroppedText(raw);
      if (text === '') return { text: '', truncated: false };
      if (text.length <= MAX_TEXT) return { text, truncated: false };
      return { text: text.slice(0, MAX_TEXT), truncated: true };
    }

    function extractDropText(dataTransfer) {
      if (dataTransfer === null || dataTransfer === undefined) return '';
      const plain = readDataTransferType(dataTransfer, 'text/plain');
      if (normalizeDroppedText(plain) !== '') return plain;
      const rich = readDataTransferType(dataTransfer, 'text/html');
      if (rich !== '') {
        const converted = htmlToText(rich);
        if (normalizeDroppedText(converted) !== '') return converted;
      }
      const uriList = readDataTransferType(dataTransfer, 'text/uri-list');
      if (uriList !== '') {
        const first = uriList
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line !== '' && !line.startsWith('#'));
        if (first !== undefined && first !== '') return first;
      }
      return '';
    }

    /** Stable colour pick so repeated drops vary without looking random per render. */
    function pickDropColor(text) {
      let hash = 0;
      for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) | 0;
      }
      const bucket = Math.abs(hash) % COLORS.length;
      return COLORS[bucket] ?? 'amber';
    }

    // ── drop overlay state shared with the shell.overlay component ──────────

    let dropState = { mode: 'idle', detail: '' };
    const dropListeners = new Set();

    function getDropState() {
      return dropState;
    }

    function setDropState(next) {
      dropState = { ...dropState, ...next };
      for (const listener of [...dropListeners]) {
        try {
          listener();
        } catch {
          // one broken listener must not block the rest
        }
      }
    }

    function subscribeDropState(listener) {
      dropListeners.add(listener);
      return () => {
        dropListeners.delete(listener);
      };
    }

    // ── note fan-out so an open panel sees notes saved by a drop ─────────────

    const noteListeners = new Set();

    function publishNotes(notes) {
      const list = Array.isArray(notes) ? notes : [];
      for (const listener of [...noteListeners]) {
        try {
          listener(list);
        } catch {
          // one broken subscriber must not block the rest
        }
      }
    }

    function subscribeNotes(listener) {
      noteListeners.add(listener);
      return () => {
        noteListeners.delete(listener);
      };
    }

    // ── icons ───────────────────────────────────────────────────────────────

    function NoteIcon({ size = 18, active = false }) {
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        'aria-hidden': true,
        style: {
          display: 'block',
          flex: '0 0 auto',
          color: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)',
        },
      },
        h('path', {
          d: 'M6 3.5h12A2.5 2.5 0 0 1 20.5 6v6.8L13.3 20H6A2.5 2.5 0 0 1 3.5 17.5v-11A2.5 2.5 0 0 1 6 3.5Z',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M20.2 12.5h-4.7A2.5 2.5 0 0 0 13 15v5',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M7.5 8h9M7.5 11.5h6',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
        }));
    }

    function SearchIcon() {
      return h('svg', {
        viewBox: '0 0 20 20',
        width: 15,
        height: 15,
        'aria-hidden': true,
        style: { display: 'block', flex: '0 0 auto' },
      },
        h('circle', { cx: 8.6, cy: 8.6, r: 5.4, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', { d: 'M12.7 12.7 16.6 16.6', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }));
    }

    function DownloadIcon() {
      return h('svg', {
        viewBox: '0 0 20 20',
        width: 16,
        height: 16,
        'aria-hidden': true,
        style: { display: 'block' },
      },
        h('path', {
          d: 'M10 3.6v8.2M6.9 8.9 10 12l3.1-3.1M4.4 14.6v1.2c0 .5.4.9.9.9h9.4c.5 0 .9-.4.9-.9v-1.2',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }));
    }

    function PencilIcon() {
      return h('svg', {
        viewBox: '0 0 20 20',
        width: 15,
        height: 15,
        'aria-hidden': true,
        style: { display: 'block' },
      },
        h('path', {
          d: 'm12.9 4.3 2.8 2.8M4 16l3.4-.7L15.6 7a1.7 1.7 0 0 0 0-2.4l-.9-.9a1.7 1.7 0 0 0-2.4 0L4.1 12.3 4 16Z',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }));
    }

    function PinIcon({ active = false }) {
      return h('svg', {
        viewBox: '0 0 20 20',
        width: 15,
        height: 15,
        'aria-hidden': true,
        style: { display: 'block' },
      },
        h('path', {
          d: 'M7 3.5h6l-.8 4.3 2.3 2.3H5.5l2.3-2.3L7 3.5Z',
          fill: active ? 'currentColor' : 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinejoin: 'round',
        }),
        h('path', { d: 'M10 10.4v6.1', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }));
    }

    function TrashIcon() {
      return h('svg', {
        viewBox: '0 0 20 20',
        width: 15,
        height: 15,
        'aria-hidden': true,
        style: { display: 'block' },
      },
        h('path', {
          d: 'M4.4 6h11.2M8 6V4.6c0-.4.3-.7.7-.7h2.6c.4 0 .7.3.7.7V6M6 6l.6 9.2c0 .5.4.8.8.8h5.2c.4 0 .8-.3.8-.8L14 6',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }));
    }

    // ── drag & drop capture ────────────────────────────────────────────────

    async function saveDroppedText(prepared, t) {
      setDropState({ mode: 'saving', detail: '' });
      try {
        const data = await apiRequest('/notes', {
          method: 'POST',
          body: JSON.stringify({ text: prepared.text, color: pickDropColor(prepared.text) }),
        });
        publishNotes(Array.isArray(data.notes) ? data.notes : []);
        setDropState({
          mode: prepared.truncated ? 'truncated' : 'saved',
          detail: prepared.truncated ? t('dropTruncated').replace('{n}', String(MAX_TEXT)) : '',
        });
      } catch (cause) {
        setDropState({ mode: 'error', detail: String(cause?.message ?? cause) });
      }
    }

    /**
     * Listen on the document so text dragged in from another app (QQ, the
     * browser, ...) becomes a note. Editable targets are left alone so the
     * chat composer and the wall's own textarea keep native insertion, and
     * drags started inside the app are ignored to avoid duplicate notes.
     */
    function installDropCapture(doc, t) {
      if (doc === null || doc === undefined || typeof doc.addEventListener !== 'function') {
        return () => {};
      }
      let selfDrag = false;
      let hintTimer = null;
      let fileHintShown = false;

      const clearDragHint = () => {
        if (hintTimer !== null) {
          clearTimeout(hintTimer);
          hintTimer = null;
        }
        if (getDropState().mode === 'drag') setDropState({ mode: 'idle', detail: '' });
      };

      const onDragStart = () => {
        selfDrag = true;
      };

      const onDragEnd = () => {
        selfDrag = false;
        fileHintShown = false;
        clearDragHint();
      };

      const onDragOver = (event) => {
        if (selfDrag || event.defaultPrevented) return;
        if (isEditableTarget(event.target)) {
          clearDragHint();
          return;
        }
        const kind = dragKind(event.dataTransfer);
        if (kind === 'text') {
          event.preventDefault();
          try {
            if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'copy';
          } catch {
            // dropEffect is best-effort only
          }
          if (getDropState().mode !== 'drag') setDropState({ mode: 'drag', detail: '' });
          if (hintTimer !== null) clearTimeout(hintTimer);
          hintTimer = setTimeout(() => {
            hintTimer = null;
            if (getDropState().mode === 'drag') setDropState({ mode: 'idle', detail: '' });
          }, 900);
          return;
        }
        if (kind === 'files' && !fileHintShown) {
          fileHintShown = true;
          setDropState({ mode: 'skipped', detail: '' });
        }
      };

      const onDragLeave = (event) => {
        if (event.relatedTarget === null || event.relatedTarget === undefined) {
          fileHintShown = false;
          clearDragHint();
        }
      };

      const onDrop = (event) => {
        const wasSelfDrag = selfDrag;
        selfDrag = false;
        fileHintShown = false;
        if (wasSelfDrag || event.defaultPrevented) {
          clearDragHint();
          return;
        }
        if (isEditableTarget(event.target)) {
          clearDragHint();
          return;
        }
        const kind = dragKind(event.dataTransfer);
        if (kind !== 'text') {
          event.preventDefault();
          clearDragHint();
          if (kind !== 'none') setDropState({ mode: 'skipped', detail: '' });
          return;
        }
        event.preventDefault();
        const prepared = prepareDropText(extractDropText(event.dataTransfer));
        clearDragHint();
        if (prepared.text === '') {
          setDropState({ mode: 'skipped', detail: '' });
          return;
        }
        void saveDroppedText(prepared, t);
      };

      doc.addEventListener('dragstart', onDragStart, true);
      doc.addEventListener('dragend', onDragEnd, true);
      doc.addEventListener('dragover', onDragOver);
      doc.addEventListener('dragleave', onDragLeave);
      doc.addEventListener('drop', onDrop);

      return () => {
        if (hintTimer !== null) clearTimeout(hintTimer);
        doc.removeEventListener('dragstart', onDragStart, true);
        doc.removeEventListener('dragend', onDragEnd, true);
        doc.removeEventListener('dragover', onDragOver);
        doc.removeEventListener('dragleave', onDragLeave);
        doc.removeEventListener('drop', onDrop);
        setDropState({ mode: 'idle', detail: '' });
      };
    }

    function DropOverlay({ t, onOpen }) {
      const [state, setState] = useState(getDropState);
      const mode = state.mode;

      useEffect(() => subscribeDropState(() => setState(getDropState())), []);

      useEffect(() => {
        if (mode === 'idle' || mode === 'drag') return undefined;
        const timer = window.setTimeout(() => {
          if (getDropState().mode === mode) setDropState({ mode: 'idle', detail: '' });
        }, mode === 'wishOptimizing'
          ? 180000
          : mode === 'wishFallback'
            ? 4600
            : mode === 'wishSaved'
              ? 3400
              : mode === 'error' || mode === 'wishFailed'
                ? 4200
                : 2600);
        return () => {
          if (typeof window.clearTimeout === 'function') window.clearTimeout(timer);
        };
      }, [mode]);

      if (mode === 'idle') return null;

      const titles = {
        drag: t('dropHint'),
        saving: t('dropSaving'),
        saved: t('dropSaved'),
        truncated: t('dropSaved'),
        skipped: t('dropUnsupported'),
        error: t('dropFailed'),
        wishMissing: t('wishNoSession'),
        wishFailed: t('wishFailed'),
        wishOptimizing: t('wishOptimizing'),
        wishSaved: t('wishSaved'),
        wishFallback: t('wishFallback'),
      };
      const icon = mode === 'drag' ? '↓' : mode === 'error' || mode === 'wishFailed' || mode === 'wishFallback' ? '!' : mode === 'skipped' || mode === 'wishMissing' || mode === 'wishOptimizing' ? '·' : '✓';
      const canOpen = (mode === 'saved' || mode === 'truncated') && typeof onOpen === 'function';

      return h('div', {
        className: 'nw-drop',
        'data-mode': mode,
        role: 'status',
        'aria-live': 'polite',
      },
        h('span', { className: 'nw-drop-icon', 'aria-hidden': true }, icon),
        h('div', { className: 'nw-drop-copy' },
          h('strong', { className: 'nw-drop-title' }, titles[mode] ?? ''),
          state.detail !== '' ? h('span', { className: 'nw-drop-detail' }, state.detail) : null),
        canOpen ? h('button', { type: 'button', className: 'nw-drop-open', onClick: onOpen }, t('dropOpen')) : null);
    }

    // ── wish bridge: hand a note prompt to the conversation composer ─────────

    let wishPending = null;
    let wishTimer = null;
    let wishBusy = false;
    let wishDetail = '';
    let wishRevision = 0;
    const wishListeners = new Set();

    /** Tell the mounted bridge that a new prompt is waiting for it. */
    function publishWish() {
      wishRevision += 1;
      for (const listener of wishListeners) {
        try {
          listener(wishRevision);
        } catch {
          // one broken listener must not break the wall
        }
      }
    }

    function subscribeWish(listener) {
      wishListeners.add(listener);
      return () => { wishListeners.delete(listener); };
    }

    function clearWishTimer() {
      if (wishTimer === null) return;
      if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
        window.clearTimeout(wishTimer);
      }
      wishTimer = null;
    }

    function buildWishPrompt(note) {
      const text = typeof note?.text === 'string' ? note.text.trim() : '';
      const tag = tagsOf(text)[0] ?? null;
      const lines = [
        '你是一位经验丰富的产品与技术顾问。请把我下面这条灵感整理成可以直接推进的可执行方案。',
        '',
        '【灵感原文】',
        text,
        '',
      ];
      if (tag !== null) lines.push(`【标签】#${tag}`, '');
      lines.push(
        '【请你完成】',
        '1. 用一句话提炼这条灵感真正要解决的核心问题；',
        '2. 给出 3 个可行方向，分别说明价值、成本与主要风险；',
        '3. 推荐一个最小可行的下一步，包含具体动作、所需资源与预计时间；',
        '4. 指出最可能失败的原因，以及最低成本的验证方式。',
        '',
        '【约束】',
        '- 用中文回答，具体、可执行，避免空话和套话；',
        '- 先不要展开代码实现，先对齐方向与范围；',
        '- 如果信息不足，先列出需要我补充的关键信息，再给出初步判断。',
      );
      return lines.join('\n');
    }

    function armWishTimer(t) {
      clearWishTimer();
      if (typeof window === 'undefined' || typeof window.setTimeout !== 'function') return;
      wishTimer = window.setTimeout(() => {
        wishTimer = null;
        if (wishPending === null) return;
        wishPending = null;
        setDropState({ mode: 'wishMissing', detail: t('wishNoSession') });
      }, 1600);
    }

    function WishBridge({ inputActions, t }) {
      const [revision, setRevision] = useState(wishRevision);
      useEffect(() => subscribeWish(setRevision), []);
      useEffect(() => {
        if (wishPending === null) return;
        if (inputActions === null || inputActions === undefined) return;
        if (typeof inputActions.setDraft !== 'function') return;
        const prompt = wishPending;
        const detail = wishDetail;
        wishPending = null;
        wishDetail = '';
        clearWishTimer();
        try {
          inputActions.setDraft(prompt);
          if (typeof inputActions.persistDraft === 'function') inputActions.persistDraft();
          setDropState({ mode: 'wishSaved', detail: detail !== '' ? detail : t('wishSaved') });
        } catch {
          setDropState({ mode: 'wishFailed', detail: t('wishFailed') });
        }
      }, [inputActions, t, revision]);
      return null;
    }

    // ── note card ───────────────────────────────────────────────────────────

    function EmptyDoodle() {
      return h('svg', {
        className: 'nw-doodle',
        viewBox: '0 0 88 72',
        width: 88,
        height: 72,
        'aria-hidden': true,
      },
        h('rect', { x: 16, y: 22, width: 38, height: 34, rx: 9, fill: '#fbe2e9', transform: 'rotate(-7 35 39)' }),
        h('rect', { x: 34, y: 16, width: 38, height: 36, rx: 9, fill: '#dfeefa', transform: 'rotate(6 53 34)' }),
        h('circle', { cx: 47, cy: 32, r: 1.7, fill: '#7a6a36' }),
        h('circle', { cx: 57, cy: 32, r: 1.7, fill: '#7a6a36' }),
        h('path', { d: 'M48 38c2.4 2.6 6.6 2.6 9 0', fill: 'none', stroke: '#7a6a36', strokeWidth: 1.7, strokeLinecap: 'round' }),
        h('path', { d: 'M22 12v6M19 15h6', stroke: '#e8c46a', strokeWidth: 1.8, strokeLinecap: 'round' }),
        h('path', { d: 'M74 12v6M71 15h6', stroke: '#b6d7f2', strokeWidth: 1.8, strokeLinecap: 'round' }));
    }

    function NoteCard({ note, t, onOpen, onWish, onUpdate, onRequestDelete, confirming, removing }) {
      const tag = tagsOf(note.text)[0] ?? null;

      const open = (event) => {
        const element = event?.currentTarget;
        let cardElement = element;
        if (cardElement && typeof cardElement.closest === 'function') {
          cardElement = cardElement.closest('.nw-card') ?? element;
        }
        const rect = cardElement && typeof cardElement.getBoundingClientRect === 'function'
          ? cardElement.getBoundingClientRect()
          : null;
        onOpen(note, rect);
      };
      const keep = (handler) => (event) => {
        event.stopPropagation();
        handler(event);
      };

      return h('article', {
        className: removing ? 'nw-card nw-leaving' : 'nw-card',
        'data-color': note.color,
        title: t('editHint'),
        onClick: open,
      },
        note.pinned ? h('span', { className: 'nw-pinned', title: t('pinnedLabel') }, h(PinIcon, { active: true })) : null,
        tag !== null
          ? h('button', {
            type: 'button',
            className: 'nw-tag',
            title: `${t('filterTag')} #${tag}`,
            onClick: keep(() => onUpdate(note.id, { filterTag: tag })),
          }, tag)
          : h('span', { className: 'nw-tag nw-tag-default' }, t('untagged')),
        h('p', { className: 'nw-text' }, note.text),
        h('footer', { className: 'nw-card-foot' },
          h('span', { className: 'nw-stamp' }, relativeTime(t, note.updatedAt)),
          h('div', { className: 'nw-card-actions' },
            h('button', {
              type: 'button',
              className: 'nw-wish',
              title: t('wishHint'),
              'aria-label': t('wishHint'),
              onClick: keep(() => onWish(note)),
            }, h('span', { className: 'nw-wish-glyph', 'aria-hidden': true }, '✦'), t('wish')),
            h('button', {
              type: 'button',
              className: 'nw-icon nw-hover',
              title: note.pinned ? t('unpin') : t('pin'),
              'aria-label': note.pinned ? t('unpin') : t('pin'),
              'data-active': note.pinned ? 'true' : 'false',
              onClick: keep(() => { void onUpdate(note.id, { pinned: !note.pinned }); }),
            }, h(PinIcon, { active: note.pinned })),
            h('button', {
              type: 'button',
              className: 'nw-icon nw-hover nw-danger',
              title: confirming ? t('confirmDelete') : t('delete'),
              'aria-label': t('delete'),
              'data-confirm': confirming ? 'true' : 'false',
              onClick: keep(() => onRequestDelete(note.id)),
            }, h(TrashIcon)),
            h('button', {
              type: 'button',
              className: 'nw-icon',
              title: t('edit'),
              'aria-label': t('edit'),
              onClick: keep(open),
            }, h(PencilIcon)))));
    }

    function FocusNote({ note, t, rect, origin, onSave, onWish, onClose }) {
      const [value, setValue] = useState(note.text);
      const inputRef = useRef(null);
      const layerRef = useRef(null);
      const previousFocus = useRef(null);
      const tag = tagsOf(note.text)[0] ?? null;

      useEffect(() => {
        previousFocus.current = typeof document === 'undefined' ? null : document.activeElement;
        return () => {
          const element = previousFocus.current;
          if (element !== null && element !== undefined && typeof element.focus === 'function') {
            try {
              element.focus();
            } catch {
              // the original trigger may already be gone
            }
          }
        };
      }, []);

      useEffect(() => {
        const element = inputRef.current;
        if (element === null || element === undefined) return;
        if (!element.style) return;
        element.style.height = 'auto';
        element.style.height = `${element.scrollHeight}px`;
      }, [value]);

      const save = () => {
        const text = value.trim();
        if (text === '') return;
        onSave(text);
      };

      const onKeyDown = (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          save();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      };

      // Esc and Tab are handled at the layer so they keep working when focus is
      // on a button rather than the textarea; Tab is trapped inside the dialog.
      const onLayerKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key !== 'Tab') return;
        const root = event.currentTarget;
        if (root === null || root === undefined || typeof root.querySelectorAll !== 'function') return;
        const focusable = Array.from(root.querySelectorAll('textarea, button:not([disabled])'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && event.target === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && event.target === last) {
          event.preventDefault();
          first.focus();
        }
      };

      const layerStyle = rect === null || rect === undefined
        ? undefined
        : {
          position: 'fixed',
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          right: 'auto',
          bottom: 'auto',
        };

      const cardStyle = origin === null || origin === undefined
        ? undefined
        : {
          '--nw-from-x': `${origin.dx}px`,
          '--nw-from-y': `${origin.dy}px`,
          '--nw-from-scale': `${origin.scale}`,
        };

      return h('div', {
        className: 'nw-focus-layer',
        style: layerStyle,
        ref: layerRef,
        onKeyDown: onLayerKeyDown,
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) onClose();
        },
      },
        h('div', {
          className: 'nw-focus-card',
          'data-color': note.color,
          style: cardStyle,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('edit'),
        },
          h('div', { className: 'nw-focus-head' },
            tag !== null
              ? h('span', { className: 'nw-focus-tag' }, `#${tag}`)
              : h('span', { className: 'nw-focus-tag nw-focus-tag-default' }, t('untagged')),
            h('span', { className: 'nw-focus-stamp' }, relativeTime(t, note.updatedAt))),
          h('textarea', {
            className: 'nw-focus-input',
            value,
            autoFocus: true,
            ref: inputRef,
            maxLength: MAX_TEXT,
            'aria-label': t('edit'),
            onChange: (event) => setValue(event.target.value),
            onKeyDown,
          }),
          h('div', { className: 'nw-focus-actions' },
            h('span', { className: 'nw-focus-hint' }, t('editHint')),
            h('button', {
              type: 'button',
              className: 'nw-focus-wish',
              title: t('wishHint'),
              onClick: () => onWish(note, value),
            }, t('wish')),
            h('button', {
              type: 'button',
              className: 'nw-focus-cancel',
              onClick: onClose,
            }, t('cancel')),
            h('button', {
              type: 'button',
              className: 'nw-focus-save',
              disabled: value.trim() === '',
              onClick: save,
            }, t('save')))));
    }

    // ── wall panel ──────────────────────────────────────────────────────────

    function NoteWallPanel({ t, layout }) {
      const [notes, setNotes] = useState([]);
      const [noteFile, setNoteFile] = useState('');
      const [phase, setPhase] = useState('loading');
      const [error, setError] = useState(null);
      const [draft, setDraft] = useState('');
      const [draftColor, setDraftColor] = useState('amber');
      const [adding, setAdding] = useState(false);
      const [query, setQuery] = useState('');
      const [tag, setTag] = useState(null);
      const [confirmId, setConfirmId] = useState(null);
      const [removingId, setRemovingId] = useState(null);
      const [justAdded, setJustAdded] = useState(false);
      const [, setClock] = useState(0);
      const confirmTimer = useRef(null);
      const addedTimer = useRef(null);
      const inputRef = useRef(null);
      const pageRef = useRef(null);
      const [focusId, setFocusId] = useState(null);
      const [focusRect, setFocusRect] = useState(null);
      const [focusOrigin, setFocusOrigin] = useState(null);

      useEffect(() => {
        const timer = setInterval(() => setClock((value) => value + 1), 30_000);
        return () => clearInterval(timer);
      }, []);

      useEffect(() => () => {
        if (confirmTimer.current !== null) clearTimeout(confirmTimer.current);
        if (addedTimer.current !== null) clearTimeout(addedTimer.current);
      }, []);

      const load = useCallback(async () => {
        setPhase('loading');
        try {
          const data = await apiRequest('/state');
          setNotes(Array.isArray(data.notes) ? data.notes : []);
          setNoteFile(typeof data.file === 'string' ? data.file : '');
          setError(null);
          setPhase('ready');
        } catch (cause) {
          setError(String(cause?.message ?? cause));
          setPhase('error');
        }
      }, []);

      useEffect(() => {
        void load();
      }, [load]);

      useEffect(() => subscribeNotes((next) => {
        setNotes(next);
        setError(null);
        setPhase('ready');
      }), []);

      const addNote = useCallback(async () => {
        const text = draft.trim();
        if (text === '' || adding) return;
        if (text.length > MAX_TEXT) {
          setError(t('tooLong'));
          return;
        }
        setAdding(true);
        try {
          const data = await apiRequest('/notes', {
            method: 'POST',
            body: JSON.stringify({ text, color: draftColor }),
          });
          setNotes(Array.isArray(data.notes) ? data.notes : []);
          setDraft('');
          setError(null);
          setJustAdded(true);
          if (addedTimer.current !== null) clearTimeout(addedTimer.current);
          addedTimer.current = window.setTimeout(() => {
            setJustAdded(false);
            addedTimer.current = null;
          }, 1400);
          if (typeof inputRef.current?.focus === 'function') inputRef.current.focus();
        } catch (cause) {
          setError(String(cause?.message ?? cause));
        } finally {
          setAdding(false);
        }
      }, [draft, draftColor, adding, t]);

      const updateNote = useCallback(async (id, patch) => {
        const { filterTag, ...changes } = patch;
        if (filterTag !== undefined) {
          setTag(filterTag);
          return;
        }
        try {
          const data = await apiRequest(`/notes/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(changes),
          });
          setNotes(Array.isArray(data.notes) ? data.notes : []);
          setError(null);
        } catch (cause) {
          setError(String(cause?.message ?? cause));
        }
      }, []);

      const openNote = useCallback((note, cardRect) => {
        let rect = null;
        const element = pageRef.current;
        if (element !== null && element !== undefined && typeof element.getBoundingClientRect === 'function') {
          const box = element.getBoundingClientRect();
          if (box.width > 0 && box.height > 0) {
            const top = Math.max(0, box.top);
            const bottom = Math.min(window.innerHeight, box.bottom);
            rect = {
              left: box.left,
              top,
              width: box.width,
              height: Math.max(0, bottom - top),
            };
          }
        }
        setFocusId(note.id);
        setFocusRect(rect);
        if (rect === null || cardRect === null || cardRect === undefined || cardRect.width <= 0) {
          setFocusOrigin(null);
          return;
        }
        const targetWidth = Math.max(1, Math.min(620, rect.width - 48));
        setFocusOrigin({
          dx: cardRect.left + cardRect.width / 2 - (rect.left + rect.width / 2),
          dy: cardRect.top + cardRect.height / 2 - (rect.top + rect.height / 2),
          scale: Math.min(1, Math.max(0.2, cardRect.width / targetWidth)),
        });
      }, []);

      const closeFocus = useCallback(() => {
        setFocusId(null);
        setFocusRect(null);
        setFocusOrigin(null);
      }, []);

      const saveFocus = useCallback(async (text) => {
        const target = focusId === null ? null : notes.find((note) => note.id === focusId) ?? null;
        const close = () => {
          setFocusId(null);
          setFocusRect(null);
          setFocusOrigin(null);
        };
        if (target === null) {
          close();
          return;
        }
        const trimmed = text.trim();
        if (trimmed === '' || trimmed === target.text) {
          close();
          return;
        }
        // Close only after the PATCH settles so an edit cannot be silently lost.
        await updateNote(target.id, { text: trimmed });
        close();
      }, [focusId, notes, updateNote]);

      const wish = useCallback((note, overrideText) => {
        if (note === null || note === undefined || wishBusy) return;
        const override = typeof overrideText === 'string' ? overrideText.trim() : '';
        const text = override !== '' ? override : note.text;
        const fallbackPrompt = buildWishPrompt({ ...note, text });
        if (layout === null || layout === undefined || typeof layout.selectPanel !== 'function') {
          setDropState({ mode: 'wishMissing', detail: t('wishNoSession') });
          return;
        }
        wishBusy = true;
        clearWishTimer();
        wishPending = null;
        wishDetail = '';
        setDropState({ mode: 'wishOptimizing', detail: '' });
        void (async () => {
          // Persist unsaved edits from the focus dialog before jumping away, so
          // the prompt and the wall never disagree.
          if (override !== '' && override !== note.text) {
            await updateNote(note.id, { text: override });
          }
          let prompt = fallbackPrompt;
          let detail = t('wishFallback');
          try {
            const data = await apiRequest('/wish/optimize', {
              method: 'POST',
              body: JSON.stringify({ text: fallbackPrompt }),
            });
            if (typeof data?.prompt === 'string' && data.prompt.trim() !== '') {
              prompt = data.prompt.trim();
              detail = t('wishOptimized');
            }
          } catch {
            // PromptOptimizer is optional: keep the local template and say so.
          } finally {
            wishBusy = false;
          }
          wishPending = prompt;
          wishDetail = detail;
          if (detail === t('wishFallback')) setDropState({ mode: 'wishFallback', detail });
          publishWish();
          armWishTimer(t);
          try {
            layout.selectPanel(null);
          } catch {
            wishPending = null;
            clearWishTimer();
            wishDetail = '';
            setDropState({ mode: 'wishMissing', detail: t('wishNoSession') });
          }
        })();
      }, [layout, t, updateNote]);

      const deleteNote = useCallback(async (id) => {
        try {
          const data = await apiRequest(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
          setNotes(Array.isArray(data.notes) ? data.notes : []);
          setError(null);
        } catch (cause) {
          setError(String(cause?.message ?? cause));
        }
      }, []);

      const requestDelete = useCallback((id) => {
        if (confirmId === id) {
          setConfirmId(null);
          if (confirmTimer.current !== null) clearTimeout(confirmTimer.current);
          confirmTimer.current = null;
          setRemovingId(id);
          window.setTimeout(() => {
            setRemovingId(null);
            void deleteNote(id);
          }, 170);
          return;
        }
        setConfirmId(id);
        if (confirmTimer.current !== null) clearTimeout(confirmTimer.current);
        confirmTimer.current = setTimeout(() => {
          setConfirmId(null);
          confirmTimer.current = null;
        }, 3200);
      }, [confirmId, deleteNote]);

      const onComposerKeyDown = (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void addNote();
        }
      };

      const ordered = useMemo(() => orderNotes(notes), [notes]);

      const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return ordered.filter((note) => {
          if (tag !== null && !tagsOf(note.text).includes(tag)) return false;
          return needle === '' || note.text.toLowerCase().includes(needle);
        });
      }, [ordered, query, tag]);

      const focusNote = focusId === null ? null : notes.find((note) => note.id === focusId) ?? null;

      const composerEmpty = draft.trim() === '';
      const filtering = query.trim() !== '' || tag !== null;

      return h('div', { className: 'nw-page', ref: pageRef },
        h('div', { className: 'nw-inner' },
          h('header', { className: 'nw-head' },
            h('div', { className: 'nw-titles' },
              h('h1', { className: 'nw-title' }, t('title')),
              h('p', { className: 'nw-sub' }, t('subtitle'))),
            h('div', { className: 'nw-tools' },
              h('label', { className: 'nw-searchpill' },
                h('span', { className: 'nw-searchicon' }, h(SearchIcon)),
                h('input', {
                  className: 'nw-search',
                  type: 'search',
                  value: query,
                  placeholder: t('search'),
                  'aria-label': t('search'),
                  onChange: (event) => setQuery(event.target.value),
                })),
              tag !== null
                ? h('button', {
                  type: 'button',
                  className: 'nw-filterpill',
                  title: t('clearFilter'),
                  onClick: () => setTag(null),
                }, `#${tag}`, h('span', { className: 'nw-filter-x', 'aria-hidden': true }, '×'))
                : null,
              h('span', { className: 'nw-countpill', key: notes.length }, t('countNotes').replace('{n}', String(filtering ? visible.length : notes.length))))),
          h('div', { className: 'nw-composer', 'data-color': draftColor },
            h('textarea', {
              className: 'nw-input',
              value: draft,
              rows: 4,
              ref: inputRef,
              maxLength: MAX_TEXT,
              placeholder: t('placeholder'),
              'aria-label': t('placeholder'),
              onChange: (event) => setDraft(event.target.value),
              onKeyDown: onComposerKeyDown,
            }),
            h('div', { className: 'nw-composer-bar' },
              h('div', { className: 'nw-swatches' },
                COLORS.map((color) => h('button', {
                  key: color,
                  type: 'button',
                  className: 'nw-swatch',
                  'data-color': color,
                  'data-active': draftColor === color ? 'true' : 'false',
                  title: t(`color_${color}`),
                  'aria-label': t(`color_${color}`),
                  onClick: () => setDraftColor(color),
                }))),
              h('div', { className: 'nw-composer-actions' },
                h('span', { className: 'nw-composer-hint' }, t('composerHint')),
                h('button', {
                  type: 'button',
                  className: justAdded ? 'nw-add nw-added' : 'nw-add',
                  disabled: adding || composerEmpty,
                  onClick: () => { void addNote(); },
                }, adding ? h('span', { className: 'nw-spinner' }) : h('span', { className: 'nw-plus' }, justAdded ? '✓' : '＋'), adding ? t('adding') : justAdded ? t('added') : t('add'))))),
          error !== null
            ? h('div', { className: 'nw-error' },
              h('span', null, `${t('failed')} · ${error}`),
              h('button', {
                type: 'button',
                className: 'nw-retry',
                onClick: () => { void load(); },
              }, t('retry')))
            : null,
          phase === 'loading'
            ? h('div', { className: 'nw-placeholder' }, t('loading'))
            : notes.length === 0
              ? (phase === 'error' ? null : h('div', { className: 'nw-placeholder' }, h(EmptyDoodle), h('span', null, t('empty'))))
              : visible.length === 0
                ? h('div', { className: 'nw-placeholder' }, h(EmptyDoodle), h('span', null, t('emptyFiltered')))
                : h('div', { className: 'nw-grid' },
                  visible.map((note) => h(NoteCard, {
                    key: note.id,
                    note,
                    t,
                    onOpen: openNote,
                    onWish: wish,
                    onUpdate: updateNote,
                    onRequestDelete: requestDelete,
                    confirming: confirmId === note.id,
                    removing: removingId === note.id,
                  }))),
          h('div', { className: 'nw-foot' },
            noteFile !== ''
              ? h('span', { className: 'nw-storage' }, t('storageHint').replace('{file}', noteFile))
              : h('span', null),
            h('span', { className: 'nw-drop-tip' }, t('dropTip')),
            h('button', {
              type: 'button',
              className: 'nw-exportlink',
              title: t('export'),
              disabled: notes.length === 0,
              onClick: () => downloadMarkdown(t, notes),
            }, h(DownloadIcon), t('export')))),
        focusNote === null ? null : h(FocusNote, {
          note: focusNote,
          t,
          rect: focusRect,
          origin: focusOrigin,
          onSave: saveFocus,
          onWish: wish,
          onClose: closeFocus,
        }));
    }

    // ── styles ──────────────────────────────────────────────────────────────

    const CSS = `
.nw-page {
  box-sizing: border-box;
  position: relative;
  min-height: 100%;
  padding: 34px 42px 52px;
  color: #34322b;
  background: #fdfdfc;
  font-family: ui-sans-serif, system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.nw-inner { display: flex; flex-direction: column; gap: 22px; width: 100%; max-width: 1080px; margin: 0 auto; }
.nw-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding-top: 2px;
  animation: nw-rise .5s cubic-bezier(.2, .7, .2, 1) both;
}
.nw-titles { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.nw-title { margin: 0; font-size: 24px; line-height: 32px; font-weight: 700; letter-spacing: -0.01em; color: #16161a; }
.nw-sub { margin: 0; font-size: 13px; line-height: 19px; color: #8f8d88; }
.nw-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.nw-searchpill {
  display: flex; align-items: center; gap: 9px;
  height: 38px; padding: 0 16px 0 14px;
  border-radius: 999px; background: #fff;
  border: 1px solid #e6e3da; box-sizing: border-box;
  transition: border-color .2s, box-shadow .2s, transform .2s;
  animation: nw-fade .45s .05s both;
}
.nw-searchpill:hover { border-color: #dfdbd0; }
.nw-searchpill:focus-within { border-color: #d8d2c2; box-shadow: 0 0 0 4px rgba(96, 88, 52, .07); }
.nw-searchicon { display: inline-flex; color: #a5a199; transition: color .2s; }
.nw-searchpill:focus-within .nw-searchicon { color: #7c766a; }
.nw-search {
  width: 128px; border: 0; background: transparent; outline: none;
  color: #34322b; font: inherit; font-size: 13px; padding: 0;
}
.nw-search::placeholder { color: #a5a199; }
.nw-search::-webkit-search-cancel-button { opacity: .45; }
.nw-countpill {
  display: inline-flex; align-items: center; height: 38px; padding: 0 16px;
  border-radius: 999px; background: #fff; border: 1px solid #e6e3da;
  color: #8a867d; font-size: 13px; white-space: nowrap;
  font-variant-numeric: tabular-nums;
  animation: nw-countpop .4s cubic-bezier(.2, .7, .2, 1) both;
}
.nw-filterpill {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
  border-radius: 999px; border: 1px solid rgba(122, 106, 54, .32);
  background: rgba(253, 229, 161, .28);
  color: #7a6a36; font: inherit; font-size: 12px; cursor: pointer;
  animation: nw-pop .25s cubic-bezier(.2, .7, .2, 1) both;
  transition: background .18s, border-color .18s;
}
.nw-filterpill:hover { background: rgba(253, 229, 161, .5); border-color: rgba(122, 106, 54, .5); }
.nw-filter-x { font-size: 14px; line-height: 1; opacity: .7; }
.nw-composer {
  position: relative;
  box-sizing: border-box; padding: 22px 24px 16px;
  border-radius: 22px; background: #fde5a1;
  box-shadow: 0 1px 0 rgba(255, 255, 255, .35) inset;
  transition: background-color .35s ease, box-shadow .3s ease;
  animation: nw-rise .55s .07s cubic-bezier(.2, .7, .2, 1) both;
}
.nw-composer[data-color="amber"] { background-color: #fee6a3; }
.nw-composer[data-color="rose"] { background-color: #fbd9e4; }
.nw-composer[data-color="sky"] { background-color: #d8ecfb; }
.nw-composer[data-color="mint"] { background-color: #d8f1e7; }
.nw-composer[data-color="violet"] { background-color: #d8caf6; }
.nw-composer[data-color="cream"] { background-color: #f8efcf; }
.nw-composer[data-color="lime"] { background-color: #d9f4d2; }
.nw-composer:focus-within { box-shadow: 0 0 0 3px rgba(74, 58, 16, .12); }
.nw-input {
  display: block; width: 100%; box-sizing: border-box; min-height: 86px;
  padding: 0; border: 0; background: transparent; resize: none; outline: none;
  color: #3d3417; font: inherit; font-size: 16px; line-height: 28px;
}
.nw-input::placeholder { color: #7f6a2c; }
.nw-composer-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
.nw-swatches { display: flex; align-items: center; gap: 9px; }
.nw-swatch {
  width: 26px; height: 26px; padding: 0; border-radius: 9px;
  border: 2px solid transparent; cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(74, 58, 16, .08);
  transition: transform .16s cubic-bezier(.2, .7, .2, 1), outline-color .16s;
  outline: 2px solid transparent; outline-offset: 1px;
}
.nw-swatch:hover { transform: scale(1.12) translateY(-1px); }
.nw-swatch:active { transform: scale(.94); }
.nw-swatch[data-active="true"] { outline-color: rgba(74, 58, 16, .6); transform: scale(1.05); animation: nw-swatchpop .34s cubic-bezier(.34, 1.56, .64, 1); }
.nw-swatch[data-color="amber"] { background: #f2d38c; }
.nw-swatch[data-color="rose"] { background: #f7bacc; }
.nw-swatch[data-color="sky"] { background: #bcdff9; }
.nw-swatch[data-color="mint"] { background: #bdeadd; }
.nw-swatch[data-color="violet"] { background: #d8cbf4; }
.nw-swatch[data-color="cream"] { background: #f4ebcd; }
.nw-swatch[data-color="lime"] { background: #5ecf83; }
.nw-composer-actions { display: flex; align-items: center; gap: 14px; margin-left: auto; }
.nw-composer-hint { font-size: 11.5px; line-height: 16px; color: rgba(88, 71, 24, .55); }
.nw-add {
  display: inline-flex; align-items: center; gap: 7px;
  height: 40px; padding: 0 20px; border: 0; border-radius: 999px;
  background: #605026; color: #faf3dd; font: inherit; font-size: 13px; font-weight: 550;
  cursor: pointer; white-space: nowrap;
  transition: background .18s, transform .16s cubic-bezier(.2, .7, .2, 1), box-shadow .18s, opacity .18s;
}
.nw-add:hover:not(:disabled) { background: #4f4220; transform: translateY(-1px) rotate(-1deg); }
.nw-add:active:not(:disabled) { transform: translateY(0) scale(.94) rotate(0deg); }
.nw-add.nw-added { animation: nw-bounce .5s cubic-bezier(.34, 1.56, .64, 1); }
.nw-add:disabled { opacity: .8; cursor: default; }
.nw-spinner {
  display: inline-block; width: 13px; height: 13px; border-radius: 50%;
  border: 2px solid rgba(250, 243, 221, .35); border-top-color: #faf3dd;
  animation: nw-spin .7s linear infinite;
}
.nw-plus { font-size: 15px; line-height: 1; margin-top: -1px; }
.nw-grid { column-width: 290px; column-gap: 18px; }
.nw-card {
  position: relative; display: flex; flex-direction: column;
  cursor: pointer;
  box-sizing: border-box; break-inside: avoid; width: 100%;
  min-height: 142px; margin: 0 0 18px; padding: 17px 20px 12px;
  border-radius: 18px;
  background: var(--nw-tint, #fbf9f5);
  box-shadow: none;
  transform: rotate(var(--nw-tilt, 0deg));
  transition: transform .3s cubic-bezier(.34, 1.56, .64, 1), box-shadow .3s ease, opacity .18s ease;
  animation: nw-pop .42s cubic-bezier(.2, .7, .2, 1) backwards;
}
.nw-card:nth-child(odd) { --nw-tilt: -0.4deg; }
.nw-card:nth-child(even) { --nw-tilt: 0.3deg; }
.nw-card:nth-child(1) { animation-delay: 0s; }
.nw-card:nth-child(2) { animation-delay: .04s; }
.nw-card:nth-child(3) { animation-delay: .08s; }
.nw-card:nth-child(4) { animation-delay: .12s; }
.nw-card:nth-child(5) { animation-delay: .16s; }
.nw-card:nth-child(6) { animation-delay: .2s; }
.nw-card:nth-child(7) { animation-delay: .24s; }
.nw-card:nth-child(8) { animation-delay: .28s; }
.nw-card:hover { transform: rotate(0deg) translateY(-3px) scale(1.012); box-shadow: 0 10px 18px -16px rgba(52, 44, 20, .28); z-index: 1; }
.nw-card.nw-leaving { animation: none; opacity: 0; transform: rotate(-2deg) translateY(10px) scale(.92); transition: opacity .18s ease, transform .18s ease; }
.nw-card[data-color="amber"], .nw-focus-card[data-color="amber"] { --nw-tint: #fee6a3; --nw-accent: #b0965a; --nw-ink: #554518; --nw-soft: #c2ac6e; }
.nw-card[data-color="rose"], .nw-focus-card[data-color="rose"] { --nw-tint: #fbd9e4; --nw-accent: #c88fa6; --nw-ink: #6a3b4b; --nw-soft: #d0a8b6; }
.nw-card[data-color="sky"], .nw-focus-card[data-color="sky"] { --nw-tint: #d8ecfb; --nw-accent: #8fa9c0; --nw-ink: #3d5567; --nw-soft: #a9bfcf; }
.nw-card[data-color="mint"], .nw-focus-card[data-color="mint"] { --nw-tint: #d8f1e7; --nw-accent: #8fb2a3; --nw-ink: #3d5a4d; --nw-soft: #aac5b8; }
.nw-card[data-color="violet"], .nw-focus-card[data-color="violet"] { --nw-tint: #d8caf6; --nw-accent: #a08fc4; --nw-ink: #473d55; --nw-soft: #b4a6d0; }
.nw-card[data-color="cream"], .nw-focus-card[data-color="cream"] { --nw-tint: #f8efcf; --nw-accent: #b6a67f; --nw-ink: #5c5236; --nw-soft: #c9bc99; }
.nw-card[data-color="lime"], .nw-focus-card[data-color="lime"] { --nw-tint: #d9f4d2; --nw-accent: #4f9e6b; --nw-ink: #255a41; --nw-soft: #92bda1; }
.nw-pinned {
  position: absolute; top: 12px; right: 13px;
  display: inline-flex; color: var(--nw-accent); opacity: .5;
  animation: nw-wiggle .55s cubic-bezier(.34, 1.56, .64, 1) both;
}
.nw-tag {
  align-self: flex-start; margin: 0 0 10px; padding: 0;
  border: 0; background: transparent; cursor: pointer;
  color: var(--nw-ink, #34322b); font: inherit; font-size: 12px; line-height: 18px; font-weight: 500;
  opacity: .92; letter-spacing: .015em;
  transition: opacity .18s;
}
.nw-tag:hover { opacity: 1; text-decoration: underline; text-underline-offset: 3px; }
.nw-tag-default { cursor: default; opacity: .92; font-weight: 600; }
.nw-tag-default:hover { text-decoration: none; opacity: .92; }
.nw-text {
  flex: 1; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere;
  color: var(--nw-ink, #34322b); font-size: 16.5px; line-height: 30px; font-weight: 500; cursor: pointer;
}
.nw-textarea {
  flex: 1; display: block; width: 100%; min-height: 76px; box-sizing: border-box;
  margin: 0; padding: 0; border: 0; background: transparent; resize: none; outline: none;
  overflow: hidden;
  color: var(--nw-ink, #34322b); font: inherit; font-size: 16.5px; line-height: 30px; font-weight: 500;
}
.nw-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 16px; min-height: 22px; }
.nw-stamp { font-size: 11.5px; line-height: 16px; color: var(--nw-soft, rgba(60, 55, 38, .45)); }
.nw-card-actions { display: flex; align-items: center; gap: 2px; }
.nw-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0; border: 0; border-radius: 8px;
  background: transparent; color: var(--nw-soft, rgba(60, 55, 38, .45)); cursor: pointer;
  transition: background .16s, color .16s, opacity .16s, transform .16s;
}
.nw-icon:hover { background: rgba(60, 52, 28, .08); color: var(--nw-ink, rgba(35, 30, 16, .85)); transform: translateY(-1px) scale(1.12); }
.nw-icon:active { transform: translateY(0) scale(.86) rotate(-4deg); }
.nw-icon[data-active="true"] { color: var(--nw-accent); }
.nw-hover { opacity: 0; pointer-events: none; transform: translateY(2px); }
.nw-card:hover .nw-hover, .nw-card:focus-within .nw-hover { opacity: 1; pointer-events: auto; transform: translateY(0); }
.nw-wish {
  display: inline-flex; align-items: center; gap: 5px;
  height: 26px; padding: 0 10px; margin-right: 2px;
  border: 1px solid rgba(96, 80, 38, .22); border-radius: 999px;
  background: rgba(255, 252, 240, .55); color: var(--nw-ink, #5b4a23);
  font: inherit; font-size: 11.5px; line-height: 1; cursor: pointer;
  transition: background .16s, border-color .16s, transform .16s;
}
.nw-wish:hover { background: rgba(255, 250, 232, .95); border-color: rgba(96, 80, 38, .38); transform: translateY(-1px); }
.nw-wish:active { transform: scale(.96); }
.nw-wish-glyph { font-size: 11px; line-height: 1; opacity: .85; }
.nw-danger:hover { background: rgba(178, 62, 42, .12); color: #b23e2a; }
.nw-danger[data-confirm="true"] { opacity: 1; background: rgba(178, 62, 42, .14); color: #a33220; pointer-events: auto; transform: none; }
@media (hover: none) { .nw-hover { opacity: 1; pointer-events: auto; transform: none; } }
.nw-placeholder { padding: 46px 16px; text-align: center; color: #a09b91; font-size: 13px; line-height: 20px; animation: nw-fade .4s both; }
.nw-doodle { display: block; margin: 0 auto 8px; color: #cfc8b6; animation: nw-float 3.4s ease-in-out infinite; }
.nw-error {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 14px; border-radius: 10px;
  border: 1px solid rgba(178, 62, 42, .28);
  background: #fdf1ef;
  color: #a33220; font-size: 12px;
  animation: nw-pop .28s cubic-bezier(.2, .7, .2, 1) both;
}
.nw-retry {
  height: 26px; padding: 0 10px; border-radius: 7px; cursor: pointer;
  border: 1px solid rgba(178, 62, 42, .32);
  background: transparent; color: inherit; font: inherit; font-size: 12px;
  transition: background .16s;
}
.nw-retry:hover { background: rgba(178, 62, 42, .08); }
.nw-foot { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 2px; flex-wrap: wrap; animation: nw-fade .5s .15s both; }
.nw-storage { margin: 0; font-size: 11px; line-height: 16px; color: #b4afa4; overflow-wrap: anywhere; }
.nw-exportlink {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 2px;
  border: 0; background: transparent; color: #9d988e;
  font: inherit; font-size: 11.5px; cursor: pointer;
  transition: color .16s, transform .16s;
}
.nw-exportlink:hover:not(:disabled) { color: #6f6a60; transform: translateX(1px); text-decoration: underline; text-underline-offset: 3px; }
.nw-exportlink:disabled { opacity: .4; cursor: default; }
.nw-drop-tip { margin: 0; font-size: 11px; line-height: 16px; color: #b4afa4; }
.nw-drop {
  position: fixed; left: 50%; bottom: 26px; z-index: 2147483000;
  display: flex; align-items: center; gap: 11px;
  box-sizing: border-box; max-width: min(520px, calc(100vw - 40px));
  padding: 11px 13px 11px 14px;
  border-radius: 16px; border: 1px solid #ece4d0;
  background: #fffdf7; color: #4b4227;
  box-shadow: 0 18px 40px -22px rgba(60, 48, 20, .45), 0 2px 6px rgba(60, 48, 20, .08);
  font-family: ui-sans-serif, system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  transform: translate(-50%, 0);
  animation: nw-dropin .28s cubic-bezier(.2, .7, .2, 1) both;
}
.nw-drop[data-mode="drag"] { border-style: dashed; border-color: #d9c88f; background: #fffaec; }
.nw-drop[data-mode="saving"] { opacity: .92; }
.nw-drop[data-mode="skipped"] { color: #6f6a5c; }
.nw-drop[data-mode="error"] { border-color: #efc9c0; background: #fdf1ef; color: #a33220; }
.nw-drop[data-mode="wishMissing"] { border-style: dashed; border-color: #d9c88f; background: #fffaec; color: #6f6a5c; }
.nw-drop[data-mode="wishFailed"] { border-color: #efc9c0; background: #fdf1ef; color: #a33220; }
.nw-drop[data-mode="wishOptimizing"] { border-style: dashed; border-color: #d9c88f; background: #fffaec; color: #6f6a5c; }
.nw-drop[data-mode="wishFallback"] { border-color: #e8cca0; background: #fdf6e8; color: #7a5a1e; }
.nw-drop[data-mode="wishSaved"] { border-color: #cfe0bf; background: #f4faf0; color: #3f5a37; }
.nw-drop-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 27px; height: 27px; flex: 0 0 auto; border-radius: 9px;
  background: rgba(242, 211, 140, .55); font-size: 14px; line-height: 1;
}
.nw-drop[data-mode="error"] .nw-drop-icon { background: rgba(178, 62, 42, .12); }
.nw-drop[data-mode="skipped"] .nw-drop-icon { background: rgba(96, 80, 38, .1); }
.nw-drop[data-mode="wishMissing"] .nw-drop-icon { background: rgba(96, 80, 38, .1); }
.nw-drop[data-mode="wishFailed"] .nw-drop-icon { background: rgba(178, 62, 42, .12); }
.nw-drop[data-mode="wishOptimizing"] .nw-drop-icon { background: rgba(96, 80, 38, .1); }
.nw-drop[data-mode="wishFallback"] .nw-drop-icon { background: rgba(122, 90, 30, .14); }
.nw-drop[data-mode="wishSaved"] .nw-drop-icon { background: rgba(63, 90, 55, .14); }
.nw-drop-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.nw-drop-title { font-size: 13px; font-weight: 600; line-height: 18px; }
.nw-drop-detail { font-size: 11.5px; line-height: 16px; opacity: .72; overflow-wrap: anywhere; }
.nw-drop-open {
  margin-left: 4px; height: 30px; padding: 0 14px; border: 0; border-radius: 999px;
  background: #605026; color: #faf3dd; font: inherit; font-size: 12px; font-weight: 550;
  cursor: pointer; white-space: nowrap; transition: background .16s, transform .16s;
}
.nw-drop-open:hover { background: #4f4220; transform: translateY(-1px); }
.nw-drop-open:active { transform: scale(.96); }
.nw-focus-layer {
  position: fixed; inset: 0; z-index: 2147483000;
  display: flex; align-items: center; justify-content: center;
  box-sizing: border-box; padding: 24px;
  background: rgba(40, 36, 24, .26);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  animation: nw-focusfade .2s ease both;
}
.nw-focus-card {
  box-sizing: border-box; width: min(620px, 100%); max-height: 100%; overflow: auto;
  padding: 26px 28px 20px; border-radius: 22px;
  background: var(--nw-tint, #fbf9f5); color: var(--nw-ink, #34322b);
  box-shadow: 0 30px 70px -30px rgba(50, 40, 15, .55);
  will-change: transform, opacity;
  animation: nw-focusgrow .2s cubic-bezier(.2, .9, .2, 1) both;
}
.nw-focus-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.nw-focus-tag { font-size: 12px; line-height: 18px; font-weight: 600; opacity: .92; letter-spacing: .015em; }
.nw-focus-stamp { font-size: 11.5px; line-height: 16px; color: var(--nw-soft, #c2ac6e); }
.nw-focus-input {
  display: block; width: 100%; box-sizing: border-box;
  min-height: 120px; max-height: min(56vh, 520px); overflow: auto;
  padding: 0; border: 0; background: transparent; resize: none; outline: none;
  color: var(--nw-ink, #34322b); font: inherit;
  font-size: 16.5px; line-height: 30px; font-weight: 500;
}
.nw-focus-actions { display: flex; align-items: center; gap: 12px; margin-top: 18px; flex-wrap: wrap; }
.nw-focus-hint { margin-right: auto; font-size: 11.5px; line-height: 16px; color: var(--nw-soft, #c2ac6e); }
.nw-focus-cancel, .nw-focus-save {
  height: 34px; padding: 0 16px; border-radius: 999px;
  font: inherit; font-size: 12.5px; cursor: pointer;
  transition: background .18s, border-color .18s, opacity .18s, transform .16s;
}
.nw-focus-cancel { border: 1px solid var(--nw-soft, #c2ac6e); background: transparent; color: var(--nw-ink, #34322b); }
.nw-focus-cancel:hover { background: rgba(255, 255, 255, .28); }
.nw-focus-save { border: 0; background: #605026; color: #faf3dd; font-weight: 550; }
.nw-focus-save:hover:not(:disabled) { background: #4f4220; transform: translateY(-1px); }
.nw-focus-save:disabled { opacity: .55; cursor: default; }
.nw-focus-wish {
  height: 34px; padding: 0 16px; border-radius: 999px;
  border: 1px solid rgba(96, 80, 38, .3); background: rgba(255, 252, 240, .6);
  color: var(--nw-ink, #34322b); font: inherit; font-size: 12.5px; cursor: pointer;
  transition: background .18s, border-color .18s, transform .16s;
}
.nw-focus-wish:hover { background: rgba(255, 250, 232, .95); border-color: rgba(96, 80, 38, .44); transform: translateY(-1px); }
.nw-focus-wish:active { transform: scale(.96); }
@keyframes nw-focusfade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes nw-focusgrow {
  from { opacity: 0; transform: translate(var(--nw-from-x, 0px), var(--nw-from-y, 12px)) scale(var(--nw-from-scale, .84)); }
  to { opacity: 1; transform: translate(0, 0) scale(1); }
}
@keyframes nw-dropin {
  from { opacity: 0; transform: translate(-50%, 10px) scale(.98); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}
@media (max-width: 900px) {
  .nw-page { padding: 22px 18px 40px; }
  .nw-tools { width: 100%; }
  .nw-searchpill { flex: 1; }
  .nw-search { width: 100%; }
  .nw-grid { column-width: 100%; }
}
@keyframes nw-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes nw-pop {
  from { opacity: 0; transform: translateY(10px) scale(.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes nw-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes nw-countpop {
  0% { opacity: 0; transform: scale(.94); }
  60% { opacity: 1; transform: scale(1.03); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes nw-spin {
  to { transform: rotate(360deg); }
}
@keyframes nw-wiggle {
  0% { transform: rotate(0deg) scale(1); }
  30% { transform: rotate(-14deg) scale(1.12); }
  60% { transform: rotate(10deg) scale(1.04); }
  100% { transform: rotate(0deg) scale(1); }
}
@keyframes nw-float {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-6px) rotate(2deg); }
}
@keyframes nw-swatchpop {
  0% { transform: scale(1); }
  45% { transform: scale(1.22); }
  100% { transform: scale(1.05); }
}
@keyframes nw-bounce {
  0% { transform: scale(1); }
  35% { transform: scale(.93); }
  70% { transform: scale(1.06); }
  100% { transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .nw-head, .nw-composer, .nw-foot, .nw-placeholder, .nw-error, .nw-countpill, .nw-filterpill,
  .nw-card, .nw-pinned, .nw-searchpill, .nw-doodle, .nw-add, .nw-drop,
  .nw-focus-layer, .nw-focus-card { animation: none; }
  .nw-card, .nw-icon, .nw-add, .nw-swatch, .nw-composer, .nw-hover, .nw-searchpill, .nw-drop, .nw-drop-open,
  .nw-focus-cancel, .nw-focus-save { transition: none; }
  .nw-wish, .nw-focus-wish { transition: none; }
}
@media (prefers-color-scheme: dark) {
  .nw-page { background: #1b1a17; color: #eae7dd; }
  .nw-title { color: #f2efe6; }
  .nw-sub { color: #8f8a80; }
  .nw-searchpill, .nw-countpill { background: #24231f; border-color: #3a372f; }
  .nw-searchpill:focus-within { border-color: #4a463a; box-shadow: 0 0 0 4px rgba(253, 229, 161, .06); }
  .nw-search { color: #eae7dd; }
  .nw-searchicon, .nw-search::placeholder, .nw-countpill { color: #9a9488; }
  .nw-composer { background: #f6dd9b; }
  .nw-composer[data-color="amber"] { background-color: #f6dd9b; }
  .nw-input { color: #3d3417; }
  .nw-composer-hint { color: rgba(88, 71, 24, .6); }
  .nw-card[data-color="amber"], .nw-focus-card[data-color="amber"] { --nw-tint: #332e1b; --nw-accent: #e0c070; }
  .nw-card[data-color="rose"], .nw-focus-card[data-color="rose"] { --nw-tint: #33262b; --nw-accent: #d99cac; }
  .nw-card[data-color="sky"], .nw-focus-card[data-color="sky"] { --nw-tint: #232c33; --nw-accent: #8fbadb; }
  .nw-card[data-color="mint"], .nw-focus-card[data-color="mint"] { --nw-tint: #22302a; --nw-accent: #8acbb2; }
  .nw-card[data-color="violet"], .nw-focus-card[data-color="violet"] { --nw-tint: #2b2639; --nw-accent: #b1a0e0; }
  .nw-card[data-color="cream"], .nw-focus-card[data-color="cream"] { --nw-tint: #2d291c; --nw-accent: #c8bc96; }
  .nw-card[data-color="lime"], .nw-focus-card[data-color="lime"] { --nw-tint: #20301f; --nw-accent: #7fd9a8; }
  .nw-card { box-shadow: none; }
  .nw-text, .nw-textarea { color: #e6e2d7; }
  .nw-tag { color: rgba(232, 228, 218, .82); }
  .nw-stamp, .nw-icon { color: rgba(228, 223, 208, .45); }
  .nw-icon:hover { background: rgba(255, 250, 235, .08); color: rgba(255, 251, 240, .9); }
  .nw-storage { color: #6f6a60; }
  .nw-drop-tip { color: #6f6a60; }
  .nw-exportlink { color: #9d988e; }
  .nw-drop { background: #24231f; border-color: #3a372f; color: #eae7dd; box-shadow: 0 18px 40px -22px rgba(0, 0, 0, .7); }
  .nw-drop[data-mode="drag"] { background: #2a2718; border-color: #574c2c; }
  .nw-drop[data-mode="error"] { background: #2e211e; border-color: #5a352c; color: #e7b1a4; }
  .nw-drop-icon { background: rgba(242, 211, 140, .16); }
  .nw-drop[data-mode="error"] .nw-drop-icon { background: rgba(178, 62, 42, .22); }
  .nw-drop[data-mode="skipped"] .nw-drop-icon { background: rgba(255, 250, 235, .08); }
  .nw-focus-layer { background: rgba(0, 0, 0, .45); }
  .nw-focus-card { box-shadow: 0 30px 70px -30px rgba(0, 0, 0, .8); }
  .nw-focus-tag { color: rgba(232, 228, 218, .82); }
  .nw-focus-input { color: #e6e2d7; }
  .nw-focus-stamp, .nw-focus-hint { color: rgba(228, 223, 208, .5); }
  .nw-focus-cancel { color: #e6e2d7; border-color: rgba(255, 250, 235, .24); }
  .nw-focus-cancel:hover { background: rgba(255, 250, 235, .08); }
  .nw-wish { color: #e6e2d7; background: rgba(255, 255, 255, .06); border-color: rgba(255, 250, 235, .18); }
  .nw-wish:hover { background: rgba(255, 255, 255, .12); border-color: rgba(255, 250, 235, .3); }
  .nw-focus-wish { color: #e6e2d7; background: rgba(255, 255, 255, .06); border-color: rgba(255, 250, 235, .24); }
  .nw-focus-wish:hover { background: rgba(255, 255, 255, .12); border-color: rgba(255, 250, 235, .36); }
  .nw-drop[data-mode="wishMissing"] { background: #2a2718; border-color: #574c2c; color: #cfc8b6; }
  .nw-drop[data-mode="wishFailed"] { background: #2e211e; border-color: #5a352c; color: #e7b1a4; }
  .nw-drop[data-mode="wishOptimizing"] { background: #2a2718; border-color: #574c2c; color: #cfc8b6; }
  .nw-drop[data-mode="wishFallback"] { background: #2c271a; border-color: #5c4c2c; color: #d9c59a; }
  .nw-drop[data-mode="wishSaved"] { background: #1f2a1e; border-color: #3f543c; color: #bcd7b2; }
  .nw-drop[data-mode="wishFailed"] .nw-drop-icon { background: rgba(178, 62, 42, .22); }
  .nw-drop[data-mode="wishMissing"] .nw-drop-icon { background: rgba(255, 250, 235, .08); }
  .nw-drop[data-mode="wishOptimizing"] .nw-drop-icon { background: rgba(255, 250, 235, .08); }
  .nw-drop[data-mode="wishFallback"] .nw-drop-icon { background: rgba(255, 250, 235, .1); }
  .nw-drop[data-mode="wishSaved"] .nw-drop-icon { background: rgba(188, 215, 178, .14); }
}
`;

    // ── plugin entry ────────────────────────────────────────────────────────

    function layoutService(ctx) {
      try {
        if (ctx.layout !== null && ctx.layout !== undefined) return ctx.layout;
      } catch {
        // the service is resolved below instead
      }
      try {
        return typeof ctx.get === 'function' ? ctx.get('layout') ?? null : null;
      } catch {
        return null;
      }
    }

    function apply(ctx) {
      const t = ctx.locale.bind(NS);
      const layout = layoutService(ctx);

      const openWall = () => {
        setDropState({ mode: 'idle', detail: '' });
        try {
          layout?.selectPanel?.(PANEL_ID);
        } catch {
          // the drop already succeeded; opening the panel is only a shortcut
        }
      };

      ctx.effect(() => ctx.locale.register(NS, DICT), 'note-wall: dictionaries');

      ctx.effect(() => {
        const style = document.createElement('style');
        style.setAttribute('data-plugin', 'dsh-note-wall');
        style.textContent = CSS;
        document.head.appendChild(style);
        return () => style.remove();
      }, 'note-wall: styles');

      ctx.effect(() => installDropCapture(typeof document === 'undefined' ? null : document, t), 'note-wall: drop capture');

      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 2,
        label: () => t('nav'),
        locale: NS,
      }, (owner = {}) => h(NoteIcon, { size: owner.size ?? 18, active: owner.active === true })));

      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: PANEL_ID,
        locale: NS,
      }, () => h(NoteWallPanel, { t, layout })));

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'note-wall-drop',
        order: 60,
        locale: NS,
      }, () => h(DropOverlay, { t, onOpen: openWall })));

      ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
        name: 'conversation.composer.dock',
        id: 'note-wall-wish-bridge',
        order: 90,
        locale: NS,
      }, (owner = {}) => h(WishBridge, { ...owner, t })));
    }

    return {
      name: 'note-wall',
      inject: ['slots', 'locale', 'layout'],
      apply,
      __internals: {
        MAX_TEXT,
        COLORS,
        dataTransferTypes,
        hasTextDrag,
        dragKind,
        isEditableTarget,
        htmlToText,
        normalizeDroppedText,
        prepareDropText,
        extractDropText,
        pickDropColor,
        getDropState,
        setDropState,
        buildWishPrompt,
      },
    };
  },
});
