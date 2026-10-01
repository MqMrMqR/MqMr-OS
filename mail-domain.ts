import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
const url=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const origins=new Set(['https://mqmr.bio','https://www.mqmr.bio','http://127.0.0.1:8765','http://localhost:8765']);
const email=/^[^\s<>@\r\n]+@[^\s<>@\r\n]+\.[^\s<>@\r\n]+$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(error:any)=>{if(error)throw new Error('Mail storage request failed.');};
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://mqmr.bio','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const result=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return result({error:'Method not allowed'},405);
 if(origin&&!origins.has(origin))return result({error:'Origin not allowed'},403);
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)return result({error:'Sign in required'},401);
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||!user)return result({error:'Sign in required'},401);
 if(user.email!=='mqmrpc@gmail.com'||user.app_metadata?.role!=='admin')return result({error:'Domain mail is restricted to its owner'},403);
 try{
  if(Number(req.headers.get('content-length')||0)>15000000)return result({error:'Message is too large'},413);
  const raw=await req.text();if(raw.length>15000000)return result({error:'Message is too large'},413);const input=JSON.parse(raw);
  if(input.action==='addresses'){const {data,error}=await db.from('mail_addresses').select('*').order('created_at');fail(error);return result({addresses:data});}
  if(input.action==='add-address'){const name=String(input.name||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(name))return result({error:'Use letters, numbers, dots, dashes, plus or underscore'},400);const {error}=await db.from('mail_addresses').insert({address:name+'@mqmr.bio'});if(error?.code==='23505')return result({error:'Address already exists'},409);fail(error);return result({ok:true});}
  if(input.action==='list'){
   let query=db.from('mail_messages').select('id,direction,sender,recipients,subject,text_body,unread,starred,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(26);
   if(input.folder==='TRASH')query=query.eq('trash',true);else query=query.eq('trash',false);
   if(input.folder==='SENT')query=query.eq('direction','outbound');else if(input.folder==='STARRED')query=query.eq('starred',true);else if(input.folder==='INBOX')query=query.eq('direction','inbound').eq('archived',false);
   if(input.search){const term=String(input.search).slice(0,200).replace(/[\\%_]/g,'\\$&');query=query.ilike('subject','%'+term+'%');}
   if(input.cursor){const cursor=input.cursor;if(!uuid.test(cursor.id)||!Number.isFinite(Date.parse(cursor.date)))return result({error:'Invalid cursor'},400);const date=new Date(cursor.date).toISOString();query=query.or(`created_at.lt.${date},and(created_at.eq.${date},id.lt.${cursor.id})`);}
   const {data,error}=await query;fail(error);const rows=data||[];const visible=rows.slice(0,25);const last=visible.at(-1);return result({messages:visible.map(m=>({id:m.id,from:m.sender,to:m.recipients.join(', '),subject:m.subject,snippet:m.text_body.slice(0,150),unread:m.unread,starred:m.starred,date:m.created_at})),next:rows.length>25?{date:last!.created_at,id:last!.id}:null});
  }
  if(['read','modify','attachment'].includes(input.action)){
   if(!uuid.test(String(input.id)))return result({error:'Invalid message'},400);
   if(input.action==='read'){const {data,error}=await db.from('mail_messages').select('*').eq('id',input.id).single();fail(error);return result(data);}
   if(input.action==='modify'){const change:Record<string,boolean>={};for(const field of ['unread','starred','trash'])if(typeof input[field]==='boolean')change[field]=input[field];if(input.archive===true)change.archived=true;const {error}=await db.from('mail_messages').update(change).eq('id',input.id);fail(error);return result({ok:true});}
   const {data,error}=await db.from('mail_messages').select('attachments').eq('id',input.id).single();fail(error);const attachment=data?.attachments.find((a:any)=>a.id===input.attachment);if(!attachment)return result({error:'Attachment not found'},404);return result({data:attachment.data});
  }
  if(input.action==='send'){
   const apiKey=Deno.env.get('RESEND_API_KEY');if(!apiKey)return result({error:'Resend sending connection has not been configured'},503);
   if(!email.test(String(input.to))||!uuid.test(String(input.idempotencyKey))||typeof input.text!=='string'||input.text.length>1000000||typeof input.subject!=='string'||input.subject.length>998||/[\r\n]/.test(input.subject))return result({error:'Invalid message fields'},400);
   const {data:address}=await db.from('mail_addresses').select('address').eq('address',input.from).maybeSingle();if(!address)return result({error:'Create this sender address first'},400);
   const files=Array.isArray(input.files)?input.files:[];if(files.length>20||files.reduce((n:number,f:any)=>n+String(f.content||'').length,0)>14000000||files.some((f:any)=>typeof f.name!=='string'||f.name.length>255||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.content)))return result({error:'Invalid or oversized attachments'},400);
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({from:input.from,to:input.to,subject:input.subject,text:input.text,files})))),b=>b.toString(16).padStart(2,'0')).join('');
   const {data:existing}=await db.from('mail_outbox').select('*').eq('id',input.idempotencyKey).maybeSingle();if(existing&&existing.request_hash!==digest)return result({error:'Draft changed; close and create a new message'},409);if(existing?.state==='sent')return result({ok:true,id:existing.provider_id});
   if(!existing){const {count,error}=await db.from('mail_outbox').select('*',{count:'exact',head:true}).gte('created_at',new Date(Date.now()-3600000).toISOString());fail(error);if((count||0)>=30)return result({error:'Hourly sending limit reached. Try later.'},429);const {error:insertError}=await db.from('mail_outbox').insert({id:input.idempotencyKey,sender:input.from,recipient:input.to,request_hash:digest});if(insertError&&insertError.code!=='23505')fail(insertError);}
   const {data:claim,error:claimError}=await db.from('mail_outbox').select('*').eq('id',input.idempotencyKey).single();fail(claimError);if(claim.request_hash!==digest)return result({error:'Draft changed; create a new message'},409);if(claim.state==='sent')return result({ok:true,id:claim.provider_id});if(Date.now()-Date.parse(claim.created_at)>23*3600000)return result({error:'This send request expired. Check Sent before creating a new message.'},409);
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'mqmr-'+input.idempotencyKey},body:JSON.stringify({from:input.from,to:[input.to],subject:input.subject,text:input.text,attachments:files.map((f:any)=>({filename:f.name,content:f.content}))})});const sent=await response.json();if(!response.ok){await db.from('mail_outbox').update({state:'failed'}).eq('id',input.idempotencyKey);const knownErrors=new Set(['validation_error','missing_api_key','invalid_api_key','restricted_api_key','suspended_api_key','invalid_permission','daily_quota_exceeded','monthly_quota_exceeded','rate_limit_exceeded','invalid_attachment','invalid_idempotent_request','application_error','service_unavailable']);const code=knownErrors.has(sent?.name)?sent.name:'provider_error';return result({error:`Resend rejected this message (HTTP ${response.status}; ${code}). Check the sending key, verified sender and limits.`},502);}
   const {error:saveError}=await db.from('mail_messages').upsert({provider_id:'resend:'+sent.id,direction:'outbound',sender:input.from,recipients:[input.to],subject:input.subject,text_body:input.text,unread:false,attachments:files.map((f:any,i:number)=>({id:String(i),name:f.name,data:f.content,type:f.type}))},{onConflict:'provider_id'});fail(saveError);await db.from('mail_outbox').update({state:'sent',provider_id:sent.id}).eq('id',input.idempotencyKey);return result({ok:true,id:sent.id});
  }
  return result({error:'Unknown mail action'},400);
 }catch{return result({error:'Mail request failed. Please retry.'},500);}
});
