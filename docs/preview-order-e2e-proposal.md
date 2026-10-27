# PR20 Preview 合成订单 E2E 审批包（未提交、未部署、未执行）

## 基线与证据边界

- 基线 Commit：b1b1da217ad36b8b0da5836aa1b8e60537339456。
- PR20：feature/isolated-worker-diagnostics-20261026，Draft，未合并。
- 已核实部署：dpl_EZUdNBWYP5aUDjeSutZyYVJy8dWW，READY；本草案不在该部署中。
- 项目 timeease-v2-secure，Deployment Protection 保持 ON。
- 数据库目标：odd-base-63790740 / br-rough-butterfly-aox5mukp / neondb。
- Store：store_FI8APVuc1xuRZkAg，仅沿用独立 Preview Store 的 OIDC 路径。
- 数据库身份、TLS、Blob 读写隔离及浏览器 auth_check PASS 沿用历史实际证据，不重复运行。
- 本轮只读读取 GitHub 代码/元数据；代码及 SQL 只写入本地审批文件。无提交、部署、SQL执行、数据库连接、Blob调用、订单、Worker、邮件或付款。

## 完整 Diff 的范围

1. 新增 /preview-order-console 页面与 /api/preview-order-console POST。
   精确 Preview 分支/部署 hostname、隔离模式、付款开关关闭、固定收件人检查，沿用 previewOrderEnvironment。
   必须为同源 Origin + Sec-Fetch-Site，限定表单类型、体积、字段唯一性和固定动作/案例。
   新入口在服务内部使用现有 Preview 测试 Bearer 调用原适配器；无网络代理，无浏览器凭据序列化。
   不修改已 PASS 的 auth_check 入口，不改变原始订单 Bearer 验证器。
   上游成功必须满足逐动作语义；仅输出白名单字段，拒绝生产 Token 结果及通用 HTTP200。
   delivered 仅 delivery 案例，需操作员确认已核实本次邮件回执；这仍不是 Gmail API 独立验证。
2. 适配器新增 recover，仅允许 failure 固定 ID，并使用已验证、已锁定的事务 client。
   新的 Preview 专用恢复函数只在真实 processing_started_at 超过十分钟时置 REVIEW_REQUIRED。
   不接受时间覆盖，不回写旧时间，不调用广域恢复接口，不自动重试/重新领取/发信。
   这是受限恢复实现；不会改变或证明 Production 批量恢复路径。
3. cleanup 另外允许 pristine PAID：attempts=0、processing_started_at/result_path/delivery_message_id 均 NULL。
   用于领取前 prepare 部分失败后的显式清理；PROCESSING 仍拒绝，订单不重置、不删除。
   终态 cleanup 规则保留。每次只删除已存在的三个固定文件路径；不删除其他命名空间文件。
4. SQL 加入单列 intake_id 与 shopify_order_id 的 PRIMARY KEY/UNIQUE 约束存在性断言。
   保留固定 UUID、ON CONFLICT DO NOTHING、完整绑定碰撞检查及事务回滚。
   不创建约束、角色或资源，不 GRANT，不重置订单。
5. 新增本地安全测试及两项适配器回归；现有 CI 命令仅追加新测试文件。
   GitHub Actions permissions 仍 contents: read；没有新增 Secret、job、授权或 Actions 执行。

## 新的授权边界与残余风险（审批重点）

当前 auth_check 对任何已获 Deployment Protection 访问权的操作者只提供无副作用认证预检。
拟议订单控制台将把该类操作者的能力扩大到两条固定合成订单和固定 Blob 路径的状态/文件操作。
这属于应用层授权委托，需要审批，不等于扩大 Neon Worker 角色权限。
Origin、Sec-Fetch-Site 与表单确认并非独立身份验证；身份仍依赖现有 Vercel Protection。
没有新增私密 nonce；公开 UUID 只用于响应关联，不能阻止已授权操作者重放。
重放安全依赖实际数据库锁、状态条件、allowOverwrite=false 及固定唯一 ID；不保证外部邮件 exactly-once。
控制台不发邮件、不启用调度、不创建订单；它明确返回 externalWorkerHttpVerified=false。
不将内部函数调用描述为 n8n 到 Preview 的外部认证 HTTP 通过。

## 固定订单及 SQL 影响

delivery：d7438959-82c2-4d9a-959c-b065ecc12720。
failure：5b6b7ad4-3ff3-409c-a584-d47c6d77ca97。
唯一收件人：jcaiworker@gmail.com；不得接受调用者提供的其他地址。
Shopify 引用分别固定为 preview-e2e:delivery:<UUID>、preview-e2e:failure:<UUID>，域名 preview.invalid。
SQL 最多 INSERT 两行 public.timeease_v2_orders；不 UPDATE/DELETE 现有订单，不修改 Shopify。
PAID 与 amount_usd=1 是状态机夹具，不是付款证明；合成发票 TEST-004 总额 USD9，二者不能混为实际收入。
固定 UUID + 两项唯一约束 + ON CONFLICT DO NOTHING 保证重复执行不新增同一逻辑夹具。
绑定不符或缺少约束时抛错回滚。已有处理进度不会被重置，重复 SQL 不是重新开始测试的方法。
SQL 后需检查两行均为 PAID、attempts=0，且起始时间、结果与回执为空；不满足则停止，不重置。
本轮未查询当前行是否存在，未执行目录/约束 SQL；唯一性为代码前置条件，尚无本轮数据库执行证据。

## 现有 Worker/工作流的真实缺口

现有 n8n Integration Draft Zq06lp0qNiDzCdSy，版本 cd842f74-6f63-4001-ba14-432020e61632，active=false、activeVersionId=null。
完整订单 HTTP 节点指向 timeease-ruby.vercel.app，不能执行或复用其旧凭据作为 Preview 调用。
现有 Manual Preview PDF Excel mail acceptance 生成 TEST-003，再经过规则解析/Excel转换直接发测试邮件。
它既不读取订单 TEST-004 实际源文件，也不保证 Preview result 持久化在发信之前完成。
因此本草案不提供虚构的“可立即执行完整工作流”，也不修改或运行现有 n8n 图。
代码草案解决受限浏览器订单操作与失败恢复；完整工作流串联仍 BLOCKED。

最小后续串联规格（仍需单独提交精确 Diff 审批）：
- 复用同一停用草稿，建立独立手动转换路径，不连接任何 Production URL、调度或旧订单 HTTP 节点。
- 输入必须是本次 source 返回、已验证的 TEST-004 PDF 字节；记录 SHA-256，不能使用 TEST-003 或旧 XLSX。
- 使用已有 PDF 提取与 Excel 转换节点，先止于结果输出，不连接 Gmail。
- 生成 XLSX 后解析字段/核对 SHA，再通过受限 result 操作保存并读回成功。
- 另一个明确手动交付步骤才允许现有 Gmail OAuth 向固定测试邮箱发送本次 XLSX 一次。
- 单次运行绑定固定 intakeId、源文件 SHA、XLSX SHA 和执行 ID；交付前重新检查订单 PROCESSING、有持久结果、无回执。
- 发信成功但状态更新不明确时转 REVIEW_REQUIRED，禁止自动重发。人工再次运行也不得未经核查发信。
- 若不能用已有能力传递实际 PDF/XLSX 或维护发送前绑定，则保持 BLOCKED，不通过截图组件测试替代订单验收。
- 只有先审查并落实这段串联，才允许执行夹具 SQL；无需提前写入待处理订单。

## 分阶段测试计划（本轮均不执行）

阶段 A：审批后提交限定 Diff、运行本地类型/安全检查及 CI；CI PASS 后另按授权部署唯一 Preview。
先核对目标、Protection、PR Draft。不得因本草案部署而重跑已 PASS 的数据库/TLS/Blob 独立组件测试。
检查新增控制台在 Production/其他分支/hostname/cross-origin 下失败，且拒绝输入任意订单/路径/收件人/凭据。
阶段 B：先补齐并验证上述转换/持久化/发信串联；运行权限与邮件授权需另行明确。
阶段 C：用户批准准确 SQL 后，以已有操作员在指定 Preview SQL Editor 执行一次；最多两行。
现有 Neon 连接器事务只读，Worker 无 INSERT。不得切换只读模式或扩大 Worker 权限绕过。

delivery 验收顺序：
1. 初始夹具身份与状态核对；prepare 仅生成两份固定源文件。
2. 两次并发 claim：一成功一409；status 应为 PROCESSING，attempts=1。
3. source 导出当前 Blob 实际字节；工作流处理该字节，生成 TEST-004 XLSX。
4. 核对 invoice TEST-004、USD、数量2、单价4.50、金额9；ZIP签名通过不等于内容通过。
5. result 返回201、readBackVerified=true，status 记录固定 result_path；保存本次 XLSX 与 SHA。
6. 仅向 jcaiworker@gmail.com 发一次测试邮件；独立读取该邮件及附件，匹配 SHA 和执行 ID。
7. 用本次真实 message ID 执行 delivered；status 为 DELIVERED、attempts=1、回执一致。
8. 重复 claim/result/delivered 应409且状态/尝试数/回执不变；失败后绝不调用邮件节点。

failure 验收顺序：
1. prepare、claim，attempts=1。立即 recover 应409，状态不变。
2. 等待真实时间超过十分钟，recover 才200；状态 REVIEW_REQUIRED、超时原因固定、不自动重发。
3. 重复 claim/recover/review 拒绝；零邮件。该行终态后不能再用于新的手动 review 成功测试。
4. 手动 review 路径先由本地安全测试覆盖；若另需运行时成功证明，须另审查夹具安排，不能重置失败行。
5. 最后 cleanup 两个终态案例；三个固定路径均移除、对应命名空间无剩余；保留两条订单审计记录。

异常：prepare 不明结果，先 status，不盲目重试；pristine PAID 可显式 cleanup 再决定是否重试 prepare。
PROCESSING 期间 result 失败可能留下对象，不能覆盖重传；先 status 决定人工 review/清理。
任意 DB/Blob/邮件结果不明确即停止，不自动补发或重置。清理前先保存验收文件与脱敏运行日志。

## 权限与执行影响

- 本轮：只读 GitHub 元数据/代码；本地编辑、TypeScript 和模拟安全测试。无需外部写权限。
- 应用：现有 Preview 测试凭证仅在服务内部使用，不新增/导出/复制 Secret。
- 数据库：运行时沿用 limited 角色既有 SELECT 与指定列 UPDATE；SQL INSERT 需已有操作员明确批准。
- Blob：每案例最多 PDF、manifest、XLSX 三个固定路径；不读旧 Production Token。
- n8n：未来若审批，只更新现有停用草稿的限定手动路径，不激活，不改凭据/权限，不操作 Live 工作流。
- 邮件：未来另需本次单封测试邮件授权，固定邮箱与合成附件；本代码不具备发信能力。
- 查询结果、订单状态、Worker执行ID/日志、Excel/邮件附件 SHA 和 message ID 是未来实际证据。
- 所有接口200/201与本地单元测试都不能单独代表完整订单 E2E PASS。

## 回滚与停止条件

未提交时：用审批包 base 快照恢复仅两个已修改代码/测试文件、CI一行及SQL文件，删除本次新增文件；不得 git reset --hard 或清理其他工作。
已提交后：只在 PR20 分支制作反向 Commit；仅重新部署该分支 Preview，保留 Protection，绝不回滚/修改 Production。
先关闭新增操作入口，保留既有 auth_check 与隔离守卫；不删除 Store、角色、Secret、网络或旧资源。
已执行测试后：只有明确批准的固定对象清理；保留订单审计行，不删订单、不把状态改回 PAID。
如发送结果不明确，先人工核实邮箱；REVIEW_REQUIRED，不自动重发。发现目标/权限不符立即停止。
回滚不承诺撤回已发测试邮件；不能依靠删除回执或审计行隐藏副作用。

## 已知状态与上线结论

本地拟议实现检查可 PASS；未提交、未部署、未做运行时订单测试。
完整 n8n 串联、实际订单 E2E、运行时幂等、超时恢复及邮件交付仍 BLOCKED。
V2 集成草稿已确认 OFF；旧 Live n8n 工作流仍有 active=true，不能声称所有 Production 自动化 OFF。
本草案不修改这些旧工作流，Production OFF 的广义要求须另行只读核对/审批，不能在 Preview 任务中擅自关闭。
PR20 保持 Draft，Shopify #1033 不触碰；当前不具备上线准入条件。
