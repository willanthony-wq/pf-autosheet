// Discord webhook posting. The webhook URL lives only in this browser's localStorage and is never
// written into exported character files.
(function () {
  'use strict';

  const WEBHOOK_RE = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+(?:\?thread_id=\d+)?$/;
  const COLORS = { normal: 0x8e2f1c, crit: 0x2e7a4c, fumble: 0xb3261e, info: 0x5865f2 };

  function isWebhook(url) { return WEBHOOK_RE.test(String(url || '').trim()); }

  // roll: { who, title, total, lines[], crit, fumble, avatar }
  function payloadFor(roll, opts) {
    const desc = roll.lines.slice();
    const hasTotal = roll.total !== null && roll.total !== undefined;
    const embed = {
      title: (hasTotal ? `${roll.title}: ${roll.total}` : roll.title).slice(0, 250),
      description: desc.join('\n').slice(0, 4000),
      color: roll.crit ? COLORS.crit : roll.fumble ? COLORS.fumble : (roll.kind === 'info' ? COLORS.info : COLORS.normal),
      footer: { text: 'PF Autosheet' },
      timestamp: new Date().toISOString(),
    };
    const p = { embeds: [embed], allowed_mentions: { parse: [] } };
    const name = (opts.username || roll.who || '').trim();
    if (name) p.username = name.slice(0, 80);
    if (opts.avatar && /^https:\/\//.test(opts.avatar)) p.avatar_url = opts.avatar;
    return p;
  }

  async function send(url, roll, opts) {
    url = String(url || '').trim();
    if (!isWebhook(url)) return { ok: false, error: 'Webhook URL does not look like a Discord webhook.' };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFor(roll, opts || {})),
      });
      if (res.ok) return { ok: true };
      let msg = 'Discord returned ' + res.status;
      if (res.status === 401 || res.status === 404) msg += ' (webhook deleted or URL wrong)';
      if (res.status === 429) msg += ' (rate limited, slow down a little)';
      return { ok: false, error: msg };
    } catch (e) {
      return { ok: false, error: 'Could not reach Discord. If you opened the page as a file, try serving it (see README).' };
    }
  }

  window.PF_DISCORD = { send, isWebhook, payloadFor };
})();
