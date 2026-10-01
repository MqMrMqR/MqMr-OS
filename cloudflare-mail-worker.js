export default {
 async email(message,env){
  if(!message.to.toLowerCase().endsWith('@mqmr.bio')){message.setReject('Unknown domain');return;}
  if(message.rawSize>10*1024*1024){message.setReject('Maximum message size is 10 MB');return;}
  if(!env.MAIL_INGEST_SECRET)throw new Error('Inbox receiver is not configured');
  const raw=await new Response(message.raw).arrayBuffer();
  const base64=buffer=>{const bytes=new Uint8Array(buffer);let value='';for(let i=0;i<bytes.length;i+=32768)value+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(value);};
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
  const payload={id:hash+':'+message.to.toLowerCase(),from:message.from,to:message.to.toLowerCase(),raw:base64(raw)};
  const body=JSON.stringify(payload),timestamp=String(Date.now());
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.MAIL_INGEST_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+body))),b=>b.toString(16).padStart(2,'0')).join('');
  const response=await fetch('https://ebufvcuxcypoxwbvcbjg.supabase.co/functions/v1/mail-ingest',{method:'POST',headers:{'Content-Type':'application/json','x-mail-timestamp':timestamp,'x-mail-signature':signature},body});
  if(!response.ok)throw new Error('Inbox delivery failed: '+response.status);
 }
};
