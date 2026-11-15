import { execFileSync } from 'child_process';

/**
 * Thin wrapper over the GitHub CLI, using your `gh auth login` (or GH_TOKEN).
 * Request bodies go through stdin, so large files never hit argv limits.
 */
function ghApi(endpoint, { method = 'GET', body } = {}) {
  const args = [
    'api',
    endpoint,
    '--method',
    method,
    '-H',
    'Accept: application/vnd.github+json',
  ];
  if (body !== undefined) args.push('--input', '-');
  try {
    const out = execFileSync('gh', args, {
      input: body !== undefined ? JSON.stringify(body) : undefined,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return out.trim() ? JSON.parse(out) : null;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        'GitHub CLI (gh) is not installed: https://cli.github.com',
      );
    }
    const stderr = String(err.stderr || '').trim();
    const error = new Error(
      `gh api ${method} ${endpoint} failed: ${stderr || err.message}`,
    );
    error.status = Number(stderr.match(/HTTP (\d{3})/)?.[1]) || undefined;
    throw error;
  }
}

const encodePath = (filePath) =>
  filePath.split('/').map(encodeURIComponent).join('/');

/** "owner/repo": --repo, then GITHUB_REPOSITORY (Actions), then the checkout's default gh repo. */
export function resolveRepo(explicit) {
  if (explicit) return explicit;
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    return execFileSync(
      'gh',
      ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ).trim();
  } catch (err) {
    throw new Error(
      `Could not determine the GitHub repository; pass --repo owner/name. (${String(err.stderr || err.message).trim()})`,
    );
  }
}

export function fetchIssue(repo, number) {
  const issue = ghApi(`repos/${repo}/issues/${number}`);
  if (issue.pull_request)
    throw new Error(`#${number} is a pull request, not an issue.`);
  return {
    number: issue.number,
    title: issue.title || '',
    body: issue.body || '',
    url: issue.html_url,
    labels: (issue.labels || []).map((l) =>
      typeof l === 'string' ? l : l.name,
    ),
  };
}

/**
 * Commit one file to `branch` (created from the default branch if missing)
 * and make sure a draft PR exists for it. Safe to re-run: it updates the file
 * and reuses an open PR.
 */
export function upsertDraftPR({
  repo,
  branch,
  filePath,
  content,
  commitMessage,
  title,
  body,
  log = console.error,
}) {
  const { default_branch: base } = ghApi(`repos/${repo}`);
  const baseSha = ghApi(`repos/${repo}/git/ref/heads/${encodePath(base)}`)
    .object.sha;

  try {
    ghApi(`repos/${repo}/git/refs`, {
      method: 'POST',
      body: { ref: `refs/heads/${branch}`, sha: baseSha },
    });
    log(`Created branch ${branch} from ${base}.`);
  } catch (err) {
    if (err.status !== 422) throw err;
    log(`Branch ${branch} already exists; updating it.`);
  }

  let existingSha;
  try {
    existingSha = ghApi(
      `repos/${repo}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`,
    ).sha;
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  ghApi(`repos/${repo}/contents/${encodePath(filePath)}`, {
    method: 'PUT',
    body: {
      message: commitMessage,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    },
  });
  log(`Committed ${filePath} to ${branch}.`);

  const owner = repo.split('/')[0];
  const open = ghApi(
    `repos/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`,
  );
  if (open.length) return { url: open[0].html_url, created: false };

  const pr = ghApi(`repos/${repo}/pulls`, {
    method: 'POST',
    body: { title, body, head: branch, base, draft: true },
  });
  return { url: pr.html_url, created: true };
}
