/* Pure mail helpers, shared with regression tests. */
(() => {
 const b64bytes=data=>Uint8Array.from(atob(data.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const decode=data=>new TextDecoder().decode(b64bytes(data||''));
 const encode=text=>btoa(Array.from(new TextEncoder().encode(text),b=>String.fromCharCode(b)).join(''));
 const url64=text=>encode(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const wrap=value=>(value.match(/.{1,76}/g)||[]).join('\r\n');
 const clean=value=>String(value||'').replace(/[\r\n]/g,' ').trim();
 const subjectWords=value=>Array.from(clean(value)).reduce((chunks,char,i)=>{if(i%10===0)chunks.push('');chunks[chunks.length-1]+=char;return chunks;},[]).map(chunk=>`=?UTF-8?B?${encode(chunk)}?=`).join('\r\n ');
 const header=(message,name)=>(message.payload?.headers||[]).find(h=>h.name.toLowerCase()===name.toLowerCase())?.value||'';
 function collectParts(payload) {
  const out = { text: [], html: [], files: [] };
  function visit(part) {
   const body = part.body;
   if (part.filename) {
    out.files.push({ name: part.filename, id: body?.attachmentId, data: body?.data, type: part.mimeType, size: body?.size });
    return;
   }
   if (body && (body.data || body.attachmentId)) {
    if (part.mimeType === 'text/plain') out.text.push(body);
    if (part.mimeType === 'text/html') out.html.push(body);
   }
   (part.parts || []).forEach(visit);
  }
  visit(payload || {});
  return out;
 }
 function parts(payload) {
  const { text, html, files } = collectParts(payload);
  const inline = bodies => bodies.map(body => decode(body.data)).join('');
  return { text: inline(text), html: inline(html), files };
 }
 async function resolveParts(payload, fetchPart, { includeHtml = false } = {}) {
  const { text, html, files } = collectParts(payload);
  const resolve = async bodies => {
   const decoded = [];
   for (const body of bodies) decoded.push(decode(body.data || (await fetchPart(body.attachmentId)).data));
   return decoded.join('');
  };
  if (includeHtml) {
   const [plain, rich] = await Promise.allSettled([resolve(text), resolve(html)]);
   if (plain.status === 'rejected' && (rich.status === 'rejected' || !rich.value)) throw plain.reason;
   if (rich.status === 'rejected' && !plain.value) throw rich.reason;
   return { text: plain.value || '', html: rich.value || '', files };
  }
  const plain = await resolve(text);
  return { text: plain, html: plain ? '' : await resolve(html), files };
 }
 function mime({from,to,subject,text,html,replyId,files=[]}){
 const boundary='mqmr_'+crypto.randomUUID();
 const alternative='mqmr_alt_'+crypto.randomUUID();
 const lines=[`From: ${clean(from)}`,`To: ${clean(to)}`,`Subject: ${subjectWords(subject)}`, 'MIME-Version: 1.0'];
 if(replyId){lines.push(`In-Reply-To: ${clean(replyId)}`,`References: ${clean(replyId)}`);}
 lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`);
 if(html)lines.push(`Content-Type: multipart/alternative; boundary="${alternative}"`,'',`--${alternative}`);
 lines.push('Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',wrap(encode(text)));
 if(html)lines.push(`--${alternative}`,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',wrap(encode(html)),`--${alternative}--`);
 files.forEach(file=>{
  const filename=clean(file.name);
  const fallback=filename.replace(/[^a-zA-Z0-9_. -]/g, '_').slice(0,128)||'attachment';
  const extended=encodeURIComponent(filename).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16));
  lines.push(`--${boundary}`,`Content-Type: ${/^[\w.+-]+\/[\w.+-]+$/.test(file.type)?file.type:'application/octet-stream'}`,`Content-Disposition: attachment; filename*=UTF-8''${extended}; filename="${fallback}"`,'Content-Transfer-Encoding: base64','',wrap(file.content));
 });
 lines.push(`--${boundary}--`,'');return url64(lines.join('\r\n'));
 }
 const api={decode,encode,url64,b64bytes,clean,header,parts,resolveParts,mime}; if(typeof module!=='undefined')module.exports=api;else window.MailCore=api;
})();
