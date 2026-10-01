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
 function parts(payload){const out={text:'',html:'',files:[]};function visit(p){if(p.filename){out.files.push({name:p.filename,id:p.body?.attachmentId,data:p.body?.data,type:p.mimeType,size:p.body?.size});}else if(p.body?.data){if(p.mimeType==='text/plain')out.text+=decode(p.body.data);if(p.mimeType==='text/html')out.html+=decode(p.body.data);} (p.parts||[]).forEach(visit);}visit(payload||{});return out;}
 function mime({from,to,subject,text,replyId,files=[]}){
 const boundary='mqmr_'+crypto.randomUUID();
 const lines=[`From: ${clean(from)}`,`To: ${clean(to)}`,`Subject: ${subjectWords(subject)}`, 'MIME-Version: 1.0'];
 if(replyId){lines.push(`In-Reply-To: ${clean(replyId)}`,`References: ${clean(replyId)}`);}
 lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',wrap(encode(text)));
 files.forEach(file=>lines.push(`--${boundary}`,`Content-Type: ${/^[\w.+-]+\/[\w.+-]+$/.test(file.type)?file.type:'application/octet-stream'}`,`Content-Disposition: attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(clean(file.name))}`,'Content-Transfer-Encoding: base64','',wrap(file.content)));
 lines.push(`--${boundary}--`,'');return url64(lines.join('\r\n'));
 }
 const api={decode,encode,url64,b64bytes,clean,header,parts,mime}; if(typeof module!=='undefined')module.exports=api;else window.MailCore=api;
})();
