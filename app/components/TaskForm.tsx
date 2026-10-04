"use client";

export default function TaskForm() {
  return (
    <form
      className="task-form"
      action="https://206-189-36-241.sslip.io/form/e884e33b-cb2b-40cb-84b5-fb917a4b681f"
      method="post"
      encType="multipart/form-data"
    >
      <label className="form-field">
        <span>Email</span>
        <input
          type="email"
          name="Email"
          placeholder="you@company.com"
          required
        />
      </label>

      <label className="upload-box">
        <span className="upload-icon">↑</span>
        <strong>Upload your file</strong>
        <small>PDF, CSV, Excel, image, or document</small>
        <input type="file" name="Upload Document" />
      </label>

      <div className="form-grid">
        <label className="form-field">
          <span>What do you need?</span>
          <select name="Task Type" defaultValue="CSV_EXCEL" required>
            <option value="CSV_EXCEL">Clean / process Excel or CSV</option>
            <option value="Invoice to Excel">Extract invoice to Excel</option>
            <option value="PDF to Excel">Extract PDF to Excel</option>
            <option value="Image to Excel">Extract image to Excel</option>
            <option value="CODING">Create or fix code</option>
            <option value="API_DATA">Build an automation</option>
            <option value="QA_ONLY">Review / analyze something</option>
          </select>
        </label>

        <label className="form-field">
          <span>Output format</span>
          <select name="Output Format" defaultValue="Excel" required>
            <option value="Excel">Excel</option>
            <option value="CSV">CSV</option>
          </select>
        </label>
      </div>

      <label className="form-field">
        <span>Instructions</span>
        <textarea
          name="Notes / Special Requirements"
          rows={5}
          placeholder="Tell us exactly what you want done."
        />
      </label>

      <button className="button primary form-submit" type="submit">
        Continue to secure checkout →
      </button>

      <p className="form-footnote">
        No subscription. You will see the price before payment.
      </p>
    </form>
  );
}
