const fields = ['from', 'to', 'subject', 'after', 'before'];
const tokenPattern = /(?:^|\s)(?:(from|to|subject|after|before|has|is):)?(?:"([^"]*)"|([^\s]+))/gi;

function valueOf(value, limit = 200) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function normalizeMailSearch(input = {}) {
  if (!input || typeof input !== 'object') return { terms: [] };
  const terms = Array.isArray(input.terms) ? input.terms.slice(0, 12).map(value => valueOf(value)).filter(Boolean) : [];
  const result = { terms: [...new Set(terms)].sort((a, b) => b.length - a.length) };
  for (const key of ['from', 'to', 'subject']) {
    const value = valueOf(input[key]);
    if (value) result[key] = value;
  }
  for (const key of ['after', 'before']) {
    const time = Date.parse(valueOf(input[key], 45));
    if (Number.isFinite(time)) result[key] = new Date(time).toISOString();
  }
  if (input.attachments === true) result.attachments = true;
  if (input.starred === true) result.starred = true;
  if (typeof input.unread === 'boolean') result.unread = input.unread;
  return result;
}

export const hasMailSearch = search => search.terms.length > 0 || Object.keys(search).length > 1;

export function parseMailSearch(query, values = {}) {
  const options = { terms: [] };
  for (const [, prefix, phrase, word] of query.matchAll(tokenPattern)) {
    const key = prefix?.toLowerCase();
    const term = phrase ?? word;
    const flag = term.toLowerCase();
    if (fields.includes(key)) options[key] = term;
    else if (key === 'has' && flag === 'attachment') options.attachments = true;
    else if (key === 'is' && flag === 'starred') options.starred = true;
    else if (key === 'is' && ['read', 'unread'].includes(flag)) options.unread = flag === 'unread';
    else options.terms.push(key ? `${key}:${term}` : term);
  }
  for (const field of fields) if (values[field]) options[field] = values[field];
  for (const flag of ['attachments', 'starred']) if (values[flag]) options[flag] = true;
  if (values.status) options.unread = values.status === 'unread';
  for (const field of ['after', 'before']) {
    if (!options[field]) continue;
    const date = options[field].replaceAll('/', '-');
    const local = new Date(`${date}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(local.getTime()) ||
        local.getDate() !== Number(date.slice(-2))) throw Error('Enter a valid date using YYYY-MM-DD.');
    options[field] = local.toISOString();
  }
  if (options.after && options.before && options.after >= options.before) throw Error('The end date must be after the start date.');
  return normalizeMailSearch(options);
}

function gmailValue(value) {
  return `"${value.replace(/["\\\u0000-\u001f\u007f]/g, ' ').trim()}"`;
}

export function gmailMailQuery(search) {
  const query = search.terms.map(gmailValue);
  for (const key of ['from', 'to', 'subject']) if (search[key]) query.push(`${key}:${gmailValue(search[key])}`);
  for (const key of ['after', 'before']) if (search[key]) query.push(`${key}:${Date.parse(search[key]) / 1000}`);
  if (search.attachments) query.push('has:attachment');
  if (search.starred) query.push('is:starred');
  if (typeof search.unread === 'boolean') query.push(search.unread ? 'is:unread' : 'is:read');
  return query.join(' ');
}

// The local draft list and the preview mailbox use the same filter semantics as domain mail.
export function matchesMailSearch(message, search) {
  const includes = (source, value) => String(source || '').toLowerCase().includes(value.toLowerCase());
  const content = [message.from, message.to, message.subject, message.body].join(' ');
  return search.terms.every(term => includes(content, term)) &&
    ['from', 'to', 'subject'].every(key => !search[key] || includes(message[key], search[key])) &&
    (!search.after || Number(message.date) >= Date.parse(search.after)) &&
    (!search.before || Number(message.date) < Date.parse(search.before)) &&
    (!search.attachments || message.hasAttachments) && (!search.starred || message.starred) &&
    (search.unread === undefined || Boolean(message.unread) === search.unread);
}
