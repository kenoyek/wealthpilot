#!/usr/bin/env python3
"""Initialize/reuse the protected app capability key and encrypted Vercel binding. Never prints it."""
import json,os,secrets,urllib.request,urllib.parse,urllib.error
project='steep-star-32189891'
query=urllib.parse.urlencode({'branch_id':'br-flat-sky-b5iwhifi','database_name':'neondb','role_name':'neondb_owner'})
req=urllib.request.Request('https://console.neon.tech/api/v2/projects/'+project+'/connection_uri?'+query,headers={'Authorization':'Bearer '+os.environ['NEON_API_KEY']})
with urllib.request.urlopen(req,timeout=25) as response: uri=json.load(response)['uri']
def sql(query,params):
 request=urllib.request.Request('https://ep-wandering-brook-b52s00yv.c-7.us-east-2.aws.neon.tech/sql',data=json.dumps({'query':query,'params':params}).encode(),headers={'Content-Type':'application/json','Neon-Connection-String':uri})
 with urllib.request.urlopen(request,timeout=30) as response:return json.load(response)
# Reuse an existing key so a failed deployment/setup can be retried without key rotation.
rows=sql("select encode(secret,'hex') as value from security_private.config where singleton",[])['rows']
secret=rows[0]['value'] if rows else secrets.token_hex(32)
if not rows:sql("insert into security_private.config values(true,decode($1,'hex'))",[secret])
payload=[{'key':'WEALTHPILOT_SECURITY_SECRET','value':secret,'type':'encrypted','target':['production','preview']}]
req=urllib.request.Request('https://api.vercel.com/v10/projects/prj_S96Tc0y5Ann9xvxuNnyQvGnoYgdw/env?upsert=true',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+os.environ['VERCEL_TOKEN'],'Content-Type':'application/json'},method='POST')
with urllib.request.urlopen(req,timeout=30) as response: result=json.load(response)
if result.get('failed'):raise SystemExit('Encrypted capability binding failed; stop before deployment.')
print(json.dumps({'security_key_configured':True,'existing_key_reused':bool(rows),'key_value_printed':False}))
