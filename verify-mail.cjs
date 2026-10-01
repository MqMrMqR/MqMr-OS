const assert=require('node:assert/strict');
const {decode,url64,mime,parts}=require('./mail-core.js');
const value='\u0645\u0631\u062d\u0628\u0627 \ud83d\udc4b — Inbox';assert.equal(decode(url64(value)),value);
const raw=decode(mime({from:'mqmr@mqmr.bio',to:'person@example.com',subject:'Hello\r\nBcc: attacker@example.com',text:value,files:[{name:'test.txt',type:'text/plain',content:'aGk='}]}));
assert(!raw.includes('\r\nBcc:'));assert(raw.includes('Content-Disposition: attachment'));assert(raw.includes('multipart/mixed'));assert(raw.includes(Buffer.from(value).toString('base64')));
const parsed=parts({mimeType:'multipart/mixed',parts:[{mimeType:'text/plain',body:{data:url64(value)}},{mimeType:'application/pdf',filename:'invoice.pdf',body:{attachmentId:'123',size:10}}]});assert.equal(parsed.text,value);assert.equal(parsed.files[0].id,'123');
const long=decode(mime({from:'a@example.com',to:'b@example.com',subject:'Long',text:value.repeat(1000)}));
const encoded=long.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];assert(encoded.split('\r\n').every(line=>line.length<=76));assert.equal(Buffer.from(encoded.replace(/\r\n/g,''),'base64').toString(),value.repeat(1000));
console.log('Unicode mail, MIME/header injection defense, 76-column wrapping and nested attachment parsing passed.');
