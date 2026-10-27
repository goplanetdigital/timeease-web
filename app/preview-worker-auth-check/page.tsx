import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {previewOrderEnvironment} from '../../lib/preview-order-fixture';
export const dynamic='force-dynamic';
export default async function PreviewWorkerAuthCheck(){
 if(!previewOrderEnvironment(process.env,(await headers()).get('host')||''))notFound();
 return <main style={{maxWidth:640,margin:'64px auto',padding:24,fontFamily:'sans-serif'}}>
  <h1>Preview 认证预检</h1>
  <p>使用现有 Preview 服务端凭证，仅验证原有 Bearer 校验。不会连接数据库、访问 Blob、领取订单或发送邮件。</p>
  <p>此检查验证受保护浏览器操作通道，不代表外部 Worker HTTP 通道或完整交付 E2E 通过。</p>
  <form method="post" action="/api/preview-worker-auth-check">
   <input type="hidden" name="confirm" value="preview-auth-check-only" />
   <input type="hidden" name="nonce" value={randomUUID()} />
   <button type="submit" style={{padding:'12px 20px',cursor:'pointer'}}>仅执行一次认证预检</button>
  </form>
 </main>;
}
