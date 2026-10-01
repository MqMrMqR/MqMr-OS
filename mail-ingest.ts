import PostalMime from 'npm:postal-mime@3.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
// Cloudflare signs the exact payload. Timestamp bounds and unique message IDs prevent replay duplicates.
Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const secret=Deno.env.get('MAIL_INGEST_SECRET');if(!secret)return new Response('Receiver not configured',{status:503});
 const timestamp=req.headers.get('x-mail-timestamp')||'',signature=req.headers.get('x-mail-signature')||'';
 if(!/^\d+$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>300000||!/^[a-f0-9]{64}$/.test(signature))return new Response('Unauthorized',{status:401});
 if(Number(req.headers.get('content-length')||0)>15000000)return new Response('Too large',{status:413});
 const body=await req.text();if(body.length>15000000)return new Response('Too large',{status:413});
 const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const bytes=Uint8Array.from(signature.match(/../g)!,value=>parseInt(value,16));
 if(!await crypto.subtle.verify('HMAC',hmac,bytes,new TextEncoder().encode(timestamp+'.'+body)))return new Response('Unauthorized',{status:401});
 try{const envelope=JSON.parse(body);
 if(typeof envelope.id!=='string'||envelope.id.length>300||typeof envelope.to!=='string'||!envelope.to.toLowerCase().endsWith('@mqmr.bio')||typeof envelope.from!=='string'||envelope.from.length>1000||typeof envelope.raw!=='string'||envelope.raw.length>14000000)return new Response('Invalid mail',{status:400});
 const bytes=Uint8Array.from(atob(envelope.raw),c=>c.charCodeAt(0));if(bytes.length>10*1024*1024)return new Response('Too large',{status:413});
 const parsed=await PostalMime.parse(bytes);
 const base64=(buffer:ArrayBuffer|Uint8Array)=>{const bytes=new Uint8Array(buffer);let value='';for(let i=0;i<bytes.length;i+=32768)value+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(value);};
 const data={id:envelope.id,from:parsed.from?.address||envelope.from,to:[envelope.to.toLowerCase()],replyTo:parsed.replyTo?.[0]?.address||null,subject:parsed.subject||'',text:parsed.text||'',html:parsed.html||'',attachments:(parsed.attachments||[]).map((file,index)=>({id:String(index),name:file.filename||'attachment',type:file.mimeType,data:base64(file.content)}))};
 const {error}=await db.from('mail_messages').upsert({provider_id:'cloudflare:'+data.id,direction:'inbound',sender:data.from,recipients:data.to,reply_to:data.replyTo||null,subject:String(data.subject||'').slice(0,998),text_body:String(data.text||''),html_body:String(data.html||''),attachments:data.attachments||[]},{onConflict:'provider_id',ignoreDuplicates:true});if(error)return new Response('Storage unavailable',{status:503});return Response.json({ok:true});
 }catch{return new Response('Invalid mail',{status:400});}
});
