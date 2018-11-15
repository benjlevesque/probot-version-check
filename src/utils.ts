import { Context } from "probot";
import atob from "atob";
import { GitHubAPI } from "probot/lib/github";
import dateformat = require("dateformat");

function date8061(date: Date) {
  return `${dateformat(date, "yyyy-mm-dd")}T${dateformat(date, "HH:MM:ss")}Z`;
}
export async function getJsonContent(
  gh: GitHubAPI,
  commit: any,
  path: string
): Promise<any> {
  const packageJsonRaw = await gh.repos.getContent({
    path,
    ref: commit.ref,
    owner: commit.repo.owner.login,
    repo: commit.repo.name
  });
  return JSON.parse(atob(packageJsonRaw.data.content));
}

export async function setCheck(
  context: Context,
  checkId: number,
  ok: boolean,
  summary: string
) {
  const pullRequest = context.payload.pull_request;

  const { owner, repo } = context.repo({
    head_sha: pullRequest.head.sha
  });
  await context.github.checks.update({
    name: "Version Bump Check",
    output: {
      title: ok ? "Version OK" : "Version not updated",
      summary: summary,
      text:
        "Compares your package.json version to the base, yours should be higher."
    },
    check_run_id: checkId,
    owner,
    repo,
    conclusion: ok ? "success" : "failure",
    status: "completed",
    completed_at: date8061(new Date())
  });
}
export async function createCheck(context: Context): Promise<number> {
  const pullRequest = context.payload.pull_request;
  const { owner, repo } = context.repo({
    head_sha: pullRequest.head.sha
  });
  const check = await context.github.checks.create({
    name: "Version Bump Check",
    output: {
      title: "Checking version...",
      summary: "",
      text:
        "Compares your package.json version to the base, yours should be higher."
    },
    head_sha: pullRequest.head.sha,
    owner,
    repo,
    status: "in_progress",
    started_at: date8061(new Date())
  });
  return check.data.id;
}
