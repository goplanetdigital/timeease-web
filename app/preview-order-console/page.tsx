import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {previewOrderEnvironment,ORDER_FIXTURES,TEST_RECIPIENT} from '../../lib/preview-order-fixture';
export const dynamic='force-dynamic';
export default async function PreviewOrderConsole(){
 if(!previewOrderEnvironment(process.env,(await headers()).get('host')||''))notFound();
 return <main style={{maxWidth:760,margin:'40px auto',padding:24,fontFamily:'sans-serif'}}>
  <h1>Preview 固定合成订单操作</h1>
  <p>仅供已授权操作员使用。一次提交一个动作；不自动循环、重试或发送邮件。不是外部 Worker HTTP 验收。</p>
  <p>delivery: {ORDER_FIXTURES.delivery}<br/>failure: {ORDER_FIXTURES.failure}<br/>唯一测试邮箱：{TEST_RECIPIENT}</p>
  <p>未获执行批准前不要提交。SQL 夹具须另外审批。邮件结果不明确时停止并转人工审核，不能重发。</p>
  <form method="post" action="/api/preview-order-console">
   <input type="hidden" name="confirm" value="preview-fixed-order-only" />
   <input type="hidden" name="nonce" value={randomUUID()} />
   <label>案例 <select name="case"><option value="delivery">delivery</option><option value="failure">failure</option></select></label>
   <label> 动作 <select name="action">{['status','prepare','claim','source','result','delivered','review','recover','cleanup'].map(a=><option key={a} value={a}>{a}</option>)}</select></label>
   <p>result：仅粘贴本次 XLSX 的 Base64；delivered：仅粘贴已独立核实的本次 Gmail message ID；其他动作留空。</p>
   <textarea name="payload" aria-label="本次结果或邮件回执" rows={8} maxLength={1400000} style={{width:'100%'}} />
   <label>已核实本次测试邮件、收件人及附件：<select name="receiptReviewed"><option value="no">否</option><option value="yes">是，仅用于 delivered</option></select></label>
   <p>recover 仅用于 failure，领取后等待超过真实 10 分钟。失败和重复请求不会自动重置订单。</p>
   <button type="submit">确认执行一次固定测试动作</button>
  </form>
 </main>;
}
