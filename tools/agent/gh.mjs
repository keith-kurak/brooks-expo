// Minimal GitHub REST helper for EAS workflow jobs.
// Requires: GH_TOKEN, GH_REPO (owner/repo).
// Usage:
//   node tools/agent/gh.mjs comment <number> "<body>"        (PR or issue)
//   node tools/agent/gh.mjs get-pr <pr_number>
//   node tools/agent/gh.mjs get-pr-diff <pr_number>
//   node tools/agent/gh.mjs get-issue <issue_number>
//   node tools/agent/gh.mjs create-pr "<title>" <head> <base> "<body>"
//   node tools/agent/gh.mjs create-issue "<title>" "<body>" [label,label]
//   node tools/agent/gh.mjs list-issues <label> [limit]      (open issues)

const token = process.env.GH_TOKEN;
const repo = process.env.GH_REPO;

if (!token || !repo) {
  console.error('GH_TOKEN and GH_REPO must be set');
  process.exit(1);
}

async function request(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'brooks-expo-eas-workflows',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

function fail(method, path, { res, json }) {
  console.error(`GitHub API ${method} ${path} failed: ${res.status}`);
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}

async function api(method, path, body) {
  const result = await request(method, path, body);
  if (!result.res.ok) fail(method, path, result);
  return result.json;
}

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'comment': {
    const [number, body] = args;
    const path = `/repos/${repo}/issues/${number}/comments`;
    let result = await request('POST', path, { body });
    // A 403 here was seen once (PR #4, 2026-10-15) while the same token
    // posted other comments in the same minute, so the body is the likely
    // trigger. Log what GitHub and the body show, then retry once.
    // @ref LLP 0009#comment-403
    if (result.res.status === 403) {
      const { res, json } = result;
      console.error(`GitHub API POST ${path} returned 403; retrying once in 10 s.`);
      console.error(`  message: ${json.message ?? '(none)'}`);
      for (const h of [
        'x-github-request-id',
        'x-accepted-github-permissions',
        'x-ratelimit-remaining',
        'retry-after',
      ]) {
        console.error(`  ${h}: ${res.headers.get(h) ?? '(none)'}`);
      }
      console.error(`  body: ${body.length} chars, ${body.split('\n').length} lines; first 40 lines:`);
      console.error(body.split('\n').slice(0, 40).map((l) => `  | ${l}`).join('\n'));
      await new Promise((r) => setTimeout(r, 10_000));
      result = await request('POST', path, { body });
    }
    if (!result.res.ok) fail('POST', path, result);
    console.log(JSON.stringify({ url: result.json.html_url }));
    break;
  }
  case 'get-pr': {
    const [number] = args;
    const pr = await api('GET', `/repos/${repo}/pulls/${number}`);
    console.log(
      JSON.stringify({
        title: pr.title,
        body: pr.body,
        branch: pr.head.ref,
        sha: pr.head.sha,
      })
    );
    break;
  }
  case 'get-pr-diff': {
    // Raw unified diff on stdout (not JSON), via GitHub's diff media type.
    const [number] = args;
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${number}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.diff',
        'User-Agent': 'brooks-expo-eas-workflows',
      },
    });
    if (!res.ok) {
      console.error(`GitHub API diff for PR #${number} failed: ${res.status}`);
      process.exit(1);
    }
    process.stdout.write(await res.text());
    break;
  }
  case 'get-issue': {
    // Title, body, labels, and recent human comments (bot reports are
    // dropped so a re-triage does not read its own output as evidence).
    const [number] = args;
    const issue = await api('GET', `/repos/${repo}/issues/${number}`);
    const comments = await api(
      'GET',
      `/repos/${repo}/issues/${number}/comments?per_page=30`
    );
    console.log(
      JSON.stringify({
        title: issue.title,
        body: issue.body,
        labels: (issue.labels ?? []).map((l) => l.name),
        comments: comments
          .filter((c) => !c.body?.startsWith('## 🤖'))
          .map((c) => ({ author: c.user?.login, body: c.body })),
      })
    );
    break;
  }
  case 'list-issues': {
    // Open issues carrying <label>, newest first, with the first lines of
    // each body (the tester's quote sits near the top of an intake issue).
    // Pull requests share the issues endpoint and are dropped.
    const [label, limit = '30'] = args;
    const items = await api(
      'GET',
      `/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=${Number(limit) || 30}`
    );
    console.log(
      JSON.stringify(
        items
          .filter((i) => !i.pull_request)
          .map((i) => ({
            number: i.number,
            title: i.title,
            url: i.html_url,
            labels: (i.labels ?? []).map((l) => l.name),
            excerpt: String(i.body ?? '').slice(0, 600),
          }))
      )
    );
    break;
  }
  case 'create-issue': {
    // Labels must already exist on the repo; unknown names are dropped.
    const [title, body, labelsCsv] = args;
    const labels = (labelsCsv ?? '')
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    const issue = await api('POST', `/repos/${repo}/issues`, { title, body, labels });
    console.log(JSON.stringify({ url: issue.html_url, number: issue.number }));
    break;
  }
  case 'create-pr': {
    const [title, head, base, body] = args;
    const res = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'brooks-expo-eas-workflows',
      },
      body: JSON.stringify({ title, head, base, body }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(JSON.stringify({ url: json.html_url, number: json.number }));
      break;
    }
    // 422 usually means a PR for this head already exists (a re-run of the
    // same issue); return the open one instead of failing.
    if (res.status === 422) {
      const owner = repo.split('/')[0];
      const existing = await api(
        'GET',
        `/repos/${repo}/pulls?head=${owner}:${head}&state=open`
      );
      if (existing.length) {
        console.log(
          JSON.stringify({ url: existing[0].html_url, number: existing[0].number })
        );
        break;
      }
    }
    console.error(`GitHub API POST /pulls failed: ${res.status}`);
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  default:
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
}
