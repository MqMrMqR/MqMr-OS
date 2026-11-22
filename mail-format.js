const basicTags = new Set(['p','div','br','strong','b','em','i','u','s','ul','ol','li','a','blockquote','h1','h2','h3','h4','pre','code','hr']);
const skippedTags = new Set(['script','style','head','img','svg','math','iframe','object','embed','form','input','button','link','meta','video','audio','template','noscript']);
const voidTags = new Set(['br', 'hr']);

export function safeMailUrl(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value.trim());
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return url.href;
    if (url.protocol === 'mailto:' && url.pathname.includes('@') && !/%0[ad]/i.test(url.href)) return url.href;
  } catch {}
  return null;
}

// The sender accepts only the small HTML subset emitted by the composer.
export function validOutgoingHtml(html) {
  if (typeof html !== 'string' || html.length > 1000000) return false;
  const stack = [];
  const tags = /<[^<]*?>/g;
  let end = 0;
  for (const token of html.matchAll(tags)) {
    if (html.slice(end, token.index).includes('<')) return false;
    const parsed = /^<(\/?)([a-z0-9]+)(?: href="([^"<>]*)")?>$/.exec(token[0]);
    if (!parsed) return false;
    const [, close, tag, href] = parsed;
    if (!basicTags.has(tag)) return false;
    if (close) {
      if (href !== undefined || stack.pop() !== tag) return false;
    } else {
      if (tag === 'a' ? !safeMailUrl(href?.replaceAll('&amp;', '&')) : href !== undefined) return false;
      if (!voidTags.has(tag)) stack.push(tag);
      if (stack.length > 60) return false;
    }
    end = token.index + token[0].length;
  }
  return !stack.length && !html.slice(end).includes('<');
}

export function quoteParts(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').map(line => {
    const prefix = line.match(/^\s*(?:>[ \t]*)+/)?.[0] || '';
    return { depth: Math.min(prefix.split('>').length - 1, 20), text: line.slice(prefix.length) };
  });
  const root = { parts: [] };
  const trail = [root];
  function at(depth, title) {
    trail.length = Math.min(trail.length, depth + 1);
    while (trail.length <= depth) {
      const quote = { parts: [], title: trail.length === depth ? title : '' };
      trail.at(-1).parts.push(quote);
      trail.push(quote);
    }
    return trail[depth];
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.text.trim() && lines[i + 1]?.depth > line.depth) continue;
    const current = at(line.depth);
    if (/^(?:On\s|في\s)/i.test(line.text.trim())) {
      let label = line.text.trim();
      let last = i;
      while (!/(?:wrote|كتب)\s*:\s*$/i.test(label) && last < i + 2 &&
             lines[last + 1]?.depth === line.depth && lines[last + 1].text.trim()) {
        label += ' ' + lines[++last].text.trim();
      }
      let next = last + 1;
      while (lines[next] && !lines[next].text.trim() && lines[next].depth <= line.depth) next++;
      if (/(?:wrote|كتب)\s*:\s*$/i.test(label) && lines[next]?.depth > line.depth) {
        at(line.depth + 1, label);
        i = next - 1;
        continue;
      }
    }
    const previous = current.parts.at(-1);
    if (typeof previous === 'string') current.parts[current.parts.length - 1] = previous + '\n' + line.text;
    else current.parts.push(line.text);
  }
  return root.parts;
}

function htmlNodes(html) {
  const template = document.createElement('template');
  template.innerHTML = html.slice(0, 1500000);
  return template.content.childNodes;
}

function link(href, label, button = false) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.textContent = label;
  anchor.title = new URL(href).hostname || href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.referrerPolicy = 'no-referrer';
  anchor.className = button ? 'mail-link mail-cta' : 'mail-link';
  return anchor;
}

function inlineText(parent, value) {
  const pattern = /\*\*([^*\n]+)\*\*|https?:\/\/[^\s<>"\u0000-\u001f]+/giu;
  let index = 0;
  for (const match of value.matchAll(pattern)) {
    parent.append(value.slice(index, match.index));
    if (match[1]) {
      const bold = document.createElement('strong');
      bold.textContent = match[1];
      parent.append(bold);
    } else {
      let address = match[0].replace(/[.,;!?]+$/u, '');
      while (address.endsWith(')') && address.split(')').length > address.split('(').length) address = address.slice(0, -1);
      const href = safeMailUrl(address);
      if (href) parent.append(link(href, address.length > 72 ? new URL(href).hostname : address), match[0].slice(address.length));
      else parent.append(match[0]);
    }
    index = match.index + match[0].length;
  }
  parent.append(value.slice(index));
}

function quoteCard(parent, title = '') {
  const details = document.createElement('details');
  details.className = 'mail-quote';
  const summary = document.createElement('summary');
  const label = document.createElement('strong');
  label.textContent = 'Quoted message';
  summary.append(label);
  if (title.trim()) {
    const info = document.createElement('span');
    info.textContent = title.trim().slice(0, 300);
    summary.append(info);
  }
  const content = document.createElement('blockquote');
  details.append(summary, content);
  parent.append(details);
  return content;
}

function renderPlain(parent, parts) {
  for (const part of parts) {
    if (typeof part !== 'string') {
      renderPlain(quoteCard(parent, part.title), part.parts);
      continue;
    }
    if (!part.trim()) continue;
    const paragraph = document.createElement('div');
    paragraph.className = 'mail-plain';
    for (const [i, line] of part.trim().split('\n').entries()) {
      if (i) paragraph.append('\n');
      const named = /^(?:\*\*)?([^:]{2,95}?):(?:\*\*)?\s+(https?:\/\/\S+)\s*$/iu.exec(line.trim());
      const href = named && safeMailUrl(named[2]);
      if (href) paragraph.append(link(href, named[1].replaceAll('**', ''), true));
      else inlineText(paragraph, line);
    }
    parent.append(paragraph);
  }
}

function rebuild(nodes, target, mode, depth = 0, inAnchor = false) {
  if (depth > 60) return;
  for (const node of nodes) {
    if (node.nodeType === 3) {
      if (mode === 'reader' && !inAnchor) inlineText(target, node.data);
      else target.append(node.data);
      continue;
    }
    if (node.nodeType !== 1 || node.namespaceURI !== 'http://www.w3.org/1999/xhtml' || skippedTags.has(node.localName)) continue;
    const tag = node.localName;
    if (mode === 'reader' && (tag === 'blockquote' || (node.classList.contains('gmail_quote') && !node.querySelector('blockquote')))) {
      rebuild(node.childNodes, quoteCard(target), mode, depth + 1);
      continue;
    }
    if (tag === 'a') {
      const href = safeMailUrl(node.getAttribute('href'));
      if (href) {
        const label = node.textContent.trim();
        const button = node.getAttribute('role') === 'button' || (label.length < 55 && label && node.parentElement?.textContent.trim() === label);
        const anchor = mode === 'reader' ? link(href, label || new URL(href).hostname || href, button) : document.createElement('a');
        if (mode !== 'reader') {
          anchor.href = href;
          rebuild(node.childNodes, anchor, mode, depth + 1, true);
        }
        target.append(anchor);
      } else rebuild(node.childNodes, target, mode, depth + 1, inAnchor);
      continue;
    }
    const wrapped = basicTags.has(tag) ? tag : mode === 'reader' && ['table','tr','td','section','center','article'].includes(tag) ? 'div' : '';
    let parent = target;
    if (wrapped) {
      parent = document.createElement(wrapped);
      target.append(parent);
    }
    rebuild(node.childNodes, parent, mode, depth + 1, inAnchor || tag === 'pre' || tag === 'code');
  }
}

export function renderMessageBody(target, { text, html }) {
  if (html) {
    const content = document.createDocumentFragment();
    rebuild(htmlNodes(html), content, 'reader');
    if (content.textContent.trim()) {
      const hasTextQuotes = /^\s*>/m.test(text || '');
      if (!hasTextQuotes || content.querySelector('.mail-quote')) {
        target.append(content);
        return;
      }
    }
  }
  renderPlain(target, quoteParts(text || ''));
  if (!target.textContent.trim()) target.textContent = '(No message body)';
}

export function composerHtml(editor) {
  const content = document.createElement('div');
  rebuild(editor.childNodes, content, 'composer');
  return content.innerHTML;
}
