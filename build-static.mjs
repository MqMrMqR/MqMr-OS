import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
for (const name of ['index.html','script.js','style.css','desktop-ui.css','desktop-settings.js','desktop-options.js','desktop-geometry.js','desktop-icons.js','site-backend.js','site-design.js','editor-preview.js','admin.html','admin.css','admin.js','main-data.json','settings-data.json','sitemap.txt','sitemap.xml','Apps','assets','Phone','Simple']) {
  cpSync(name, 'dist/' + name, {recursive: true});
}

