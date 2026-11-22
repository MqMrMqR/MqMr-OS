const mailboxAddress = 'preview@example.test';

const samples = [
  ['build@pipeline.example.test', 'Preview build passed', 'The latest preview is ready. The reading view and composer passed the mobile check.\n\nOpen preview notes: https://example.test/preview?source=inbox\n\nOn Sat, Nov 21, Alex wrote:\n> Please include the mobile layout in the preview.\n>\n> On Fri, Nov 20, Sam wrote:\n>> The new mail toolbar is ready to review.\n\nI also kept the first sample below.\n\nOn Thu, Nov 19, Sam wrote:\n> The original desktop preview is available.', true],
  ['alex@studio.example.test', 'Notes on the new profile', 'Hey Ethan,\n\nThe dark layout feels good. Try the inbox on a smaller screen and check the escape key in the login dialog.\n\n— Alex', true],
  ['review@source.example.test', 'Review requested · inbox styles', 'The inbox colors and spacing are ready for review. There are three changed files, with separate styles for the list and reader.', false],
  ['sam@workspace.example.test', 'Workspace links', 'I put the references together. Let’s review the notes and keep the first release small.', false],
  ['release@pipeline.example.test', 'Release notes', 'This update adds mobile navigation, improved keyboard focus and a separate profile editor.', false]
];

export function previewMailbox() {
  const addresses = [{ address: mailboxAddress }];
  const messages = samples.map(([sender, subject, text_body, unread], index) => ({
    id: 'preview-' + index, direction: 'inbound', sender, subject, text_body, unread,
    recipients: [mailboxAddress], starred: index === 2, created_at: new Date(Date.now() - index * 90000000).toISOString(),
    html_body: index === 2 ? '<p>The <strong>updated inbox layout</strong> is ready.</p><p><a href="https://example.test/review" role="button">View review notes</a></p><blockquote><p>Earlier review feedback goes here.</p></blockquote>' : null
  }));

  return { functions: { async invoke(_functionName, { body }) {
    const data = run(body);
    return { data, error: null };
  } } };

  function run(input) {
    switch (input.action) {
      case 'addresses': return { addresses };
      case 'add-address': {
        const address = String(input.name || '').trim().toLowerCase() + '@example.test';
        if (addresses.some(row => row.address === address)) return { error: 'Address already exists.' };
        addresses.push({ address });
        return { ok: true };
      }
      case 'list': {
        const term = String(input.search || '').toLowerCase().trim();
        const list = messages.filter(message => {
          if (Boolean(message.trash) !== (input.folder === 'TRASH')) return false;
          if (input.folder === 'INBOX' && (message.direction !== 'inbound' || message.archived)) return false;
          if (input.folder === 'SENT' && message.direction !== 'outbound') return false;
          if (input.folder === 'STARRED' && !message.starred) return false;
          return !term || [message.subject, message.sender, message.text_body].some(value => value.toLowerCase().includes(term));
        });
        return { messages: list.map(message => ({ ...message, from: message.sender, to: message.recipients.join(', '), date: message.created_at, snippet: message.text_body.slice(0, 120) })), next: null };
      }
      case 'read': return messages.find(message => message.id === input.id) || { error: 'Message not found.' };
      case 'modify': {
        const message = messages.find(message => message.id === input.id);
        if (!message) return { error: 'Message not found.' };
        for (const key of ['unread', 'starred', 'trash']) if (typeof input[key] === 'boolean') message[key] = input[key];
        if (input.archive === true) message.archived = true;
        return { ok: true };
      }
      case 'send': {
        messages.unshift({
          id: crypto.randomUUID(), direction: 'outbound', sender: input.from, recipients: [input.to],
          subject: input.subject, text_body: input.text, html_body: input.html || null, created_at: new Date().toISOString(),
          attachments: input.files.map((file, id) => ({ ...file, data: file.content, id: String(id) }))
        });
        return { ok: true };
      }
      default: return { error: 'This action is unavailable in the preview.' };
    }
  }
}
