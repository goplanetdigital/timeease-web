import Link from "next/link";
import {Suspense} from "react";
import PlanSelector from "./PlanSelector";

export default function UploadPage(){
 return <main className="page-shell">
  <Link className="back-link" href="/">← Back to TimeEase</Link>
  <section className="page-header">
   <div className="eyebrow">Invoice & Receipt to Excel</div>
   <h1>Upload first. See your price. Pay securely.</h1>
   <p className="hero-copy">Upload your PDF invoice, confirm the calculated quote, then proceed to payment once verified automatic delivery is available.</p>
  </section>
  <Suspense fallback={<p>Loading upload form...</p>}><PlanSelector/></Suspense>
  <section className="grid" style={{marginTop:"24px"}}>
   <article className="card"><span className="card-kicker">1 · Upload</span><h2>Choose your PDF</h2><p>Files are stored privately and checked before pricing.</p></article>
   <article className="card"><span className="card-kicker">2 · Quote</span><h2>Confirm the price</h2><p>The server calculates your quote from the uploaded job.</p></article>
   <article className="card"><span className="card-kicker">3 · Delivery</span><h2>Get your Excel by email</h2><p>Paid processing opens only after end-to-end delivery verification.</p></article>
  </section>
 </main>;
}
