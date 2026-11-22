import { cpSync, lstatSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const preview = process.argv.includes('--preview');
const previewRoot = join(root, '.preview');
const output = preview ? join(previewRoot, 'site') : join(root, 'dist');
const publicFiles = [
  'index.html', 'profile.css', 'access.js', 'mail-access.js', 'device-client.js', 'profiles',
  'profile-content.js', 'profile-appearance.js', 'profile-page.js', 'cursor-trail.js', 'editor.html', 'editor.js',
  'inbox.html', 'inbox.css', 'inbox.js', 'private-inbox.js', 'inbox-config.js',
  'mail-core.js', 'privacy.html', 'CNAME'
];

for (const directory of [output, ...(preview ? [previewRoot] : [])]) {
  if (lstatSync(directory, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error('Build output must be a directory inside the project.');
  }
}
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const name of publicFiles) cpSync(join(root, name), join(output, name), { recursive: true });
writeFileSync(join(output, 'preview-mode.js'), preview
  ? "export const isLocalPreview = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);\n"
  : 'export const isLocalPreview = false;\n');
if (preview) cpSync(join(root, 'preview-inbox.js'), join(output, 'preview-inbox.js'));
