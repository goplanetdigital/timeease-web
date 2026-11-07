import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default function PreviewSafety(){
 if(process.env.VERCEL_ENV!=='preview')notFound();
 return <main style={{maxWidth:640,margin:'64px auto',padding:24,fontFamily:'sans-serif'}}>
  <h1>Preview Blob 隔离检查</h1>
  <p>仅检查独立 Preview Store：写入一份合成小文件，读回比对，然后删除。数据库、TLS 与存储读取检查必须先通过。</p>
  <p>此操作不创建订单、不处理发票、不付款、不发送邮件。业务上传保持关闭。</p>
  <form action="/api/preview-blob-isolation" method="post">
   <input type="hidden" name="confirm" value="synthetic-preview-only" />
   <button type="submit" style={{padding:'12px 20px',cursor:'pointer'}}>执行一次合成 Blob 隔离检查</button>
  </form>
 </main>;
}
