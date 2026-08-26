'use client';

import { useState } from 'react';

export function ReportForm({ listingId, stateCode }: { listingId: string; stateCode: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(form: FormData) {
    setBusy(true); setStatus(null);
    const response = await fetch('/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ listingId, stateCode, reason: form.get('reason'), details: form.get('details') }) });
    const payload = await response.json() as { submitted?: boolean; error?: string };
    setBusy(false);
    if (response.ok) { setStatus('Report submitted for operator review.'); setOpen(false); }
    else setStatus(payload.error ?? 'Could not submit the report.');
  }
  return <div className="report-form"><button className="text-button" type="button" onClick={() => setOpen((value) => !value)}>{open ? 'Cancel report' : 'Report this placement'}</button>
    {open ? <form action={submit}><label>Reason<select name="reason" defaultValue="other"><option value="malware">Malware or phishing</option><option value="impersonation">Impersonation</option><option value="adult">Adult content</option><option value="regulated">Prohibited or regulated offer</option><option value="copyright">Rights infringement</option><option value="other">Other</option></select></label><label>Details<textarea name="details" maxLength={1000} rows={4} placeholder="Describe the issue without including sensitive personal data." /></label><button className="claim-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}</button></form> : null}
    {status ? <p role="status">{status}</p> : null}
  </div>;
}
