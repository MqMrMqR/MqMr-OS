import { composerHtml, safeMailUrl, validOutgoingHtml } from './mail-format.js?v=inbox-workspace-1';

export function richComposer(editor, toolbar, linkPanel) {
  const urlField = linkPanel.querySelector('input');
  const error = linkPanel.querySelector('p');
  let selection;

  function edit(command, value) {
    editor.focus();
    document.execCommand(command, false, value);
  }

  function prepareLink() {
    const current = document.getSelection();
    selection = current.rangeCount && editor.contains(current.anchorNode) && editor.contains(current.focusNode)
      ? current.getRangeAt(0).cloneRange() : null;
    linkPanel.hidden = false;
    urlField.value = '';
    error.textContent = '';
    urlField.focus();
  }

  function cancelLink() {
    linkPanel.hidden = true;
    editor.focus();
  }

  function insertLink() {
    const href = safeMailUrl(urlField.value);
    if (!href) {
      error.textContent = 'Enter a valid URL starting with https://, http:// or mailto:.';
      urlField.focus();
      return;
    }
    cancelLink();
    if (selection && editor.contains(selection.startContainer)) {
      const current = document.getSelection();
      current.removeAllRanges();
      current.addRange(selection);
    }
    if (document.getSelection().isCollapsed) {
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.textContent = href;
      edit('insertHTML', anchor.outerHTML);
    } else edit('createLink', href);
  }

  toolbar.addEventListener('mousedown', event => { if (event.target.closest('button')) event.preventDefault(); });
  toolbar.addEventListener('click', event => {
    const command = event.target.closest('button')?.dataset.command;
    if (!command) return;
    if (command === 'link') prepareLink();
    else edit(command);
    sync();
  });
  function sync() {
    const current = document.getSelection();
    if (!current?.anchorNode || !editor.contains(current.anchorNode)) return;
    for (const button of toolbar.querySelectorAll('[aria-pressed]')) {
      button.setAttribute('aria-pressed', String(document.queryCommandState(button.dataset.command)));
    }
  }
  document.addEventListener('selectionchange', sync);
  editor.addEventListener('paste', event => {
    event.preventDefault();
    edit('insertText', event.clipboardData?.getData('text/plain') || '');
  });
  editor.addEventListener('drop', event => event.preventDefault());
  editor.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      prepareLink();
    }
  });
  linkPanel.querySelector('[data-insert-link]').onclick = insertLink;
  linkPanel.querySelector('[data-cancel-link]').onclick = cancelLink;
  urlField.onkeydown = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      insertLink();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelLink();
    }
  };
  return {
    fields() {
      const text = editor.innerText.trim();
      return { text, html: text ? composerHtml(editor) : '' };
    },
    reset() {
      editor.replaceChildren();
      linkPanel.hidden = true;
      for (const button of toolbar.querySelectorAll('[aria-pressed]')) button.setAttribute('aria-pressed', 'false');
    },
    restore({ html, text }) {
      if (html && validOutgoingHtml(html)) editor.innerHTML = html;
      else editor.innerText = text || '';
    },
    focus: () => editor.focus()
  };
}
