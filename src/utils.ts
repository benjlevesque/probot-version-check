import atob from "atob";
import dateformat from "dateformat";
import { Context } from "probot";
import { GitHubAPI } from "probot/lib/github";

function date8061(date: Date) {
  return `${dateformat(date, "yyyy-mm-dd")}T${dateformat(date, "HH:MM:ss")}Z`;
}
export async function getJsonContent(
  gh: GitHubAPI,
  commit: any,
  path: string,
): Promise<any> {
  const packageJsonRaw = await gh.repos.getContent({
    owner: commit.repo.owner.login,
    path,
    ref: commit.ref,
    repo: commit.repo.name,
  });
  return JSON.parse(atob(packageJsonRaw.data.content));
}

export async function setCheck(
  context: Context,
  checkId: number,
  ok: boolean,
  summary: string,
) {
  const { pull_request } = context.payload;

  const { owner, repo } = context.repo({
    head_sha: pull_request.head.sha,
  });
  await context.github.checks.update({
    check_run_id: checkId,
    completed_at: date8061(new Date()),
    conclusion: ok ? "success" : "failure",
    name: "Version Bump Check",
    output: {
      summary,
      text:
        "Compares your package.json version to the base, yours should be higher.",
      title: ok ? "Version OK" : "Version not updated",
    },
    owner,
    repo,
    status: "completed",
  });
}
export async function createCheck(context: Context): Promise<number> {
  const { pull_request } = context.payload;
  const { owner, repo } = context.repo({
    head_sha: pull_request.head.sha,
  });
  const check = await context.github.checks.create({
    head_sha: pull_request.head.sha,
    name: "Version Bump Check",
    output: {
      summary: "",
      text:
        "Compares your package.json version to the base, yours should be higher.",
      title: "Checking version...",
    },
    owner,
    repo,
    started_at: date8061(new Date()),
    status: "in_progress",
  });
  return check.data.id;
}
