// Cloud store on Upstash Redis (REST API). Vercel's Upstash integration injects the URL/token;
// both naming styles are accepted.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

export const cloudEnabled = () => !!(URL_ && TOKEN);

async function call(path, body) {
  const r = await fetch(`${URL_}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(`redis: ${d.error || r.status}`);
  return d;
}

export const redis = async (...cmd) => (await call('', cmd.map(String))).result;
export const pipeline = async (cmds) => (await call('/pipeline', cmds.map((c) => c.map(String)))).map((x) => x.result);

export const K = {
  events: 'pip:ev', // hash: event id → JSON
  times: 'pip:t', // hash: key → last-changed timestamp
  value: (k) => `pip:kv:${k}`, // JSON value
  reset: 'pip:reset', // JSON { t, scope }
};
