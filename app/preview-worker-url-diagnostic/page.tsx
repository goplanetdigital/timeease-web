import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {previewAuthEnvironment} from '../../lib/preview-order-fixture';
export const dynamic='force-dynamic';
export default async function PreviewWorkerUrlDiagnostic(){
 if(!previewAuthEnvironment(process.env,(await headers()).get('host')||''))notFound();
 return <main style={{maxWidth:640,margin:'64px auto',padding:24,fontFamily:'sans-serif'}}>
  <h1>Preview 数据库地址结构诊断</h1>
  <p>只检查专用 Worker 地址是否存在、能否解析、协议、用户名和密码组件。不会连接数据库，也不会显示地址内容。</p>
  <form method="post" action="/api/preview-worker-url-diagnostic">
   <input type="hidden" name="confirm" value="preview-worker-url-diagnostic-only" />
   <input type="hidden" name="nonce" value={randomUUID()} />
   <button type="submit" style={{padding:'12px 20px',cursor:'pointer'}}>仅执行一次地址结构诊断</button>
  </form>
 </main>;
}
