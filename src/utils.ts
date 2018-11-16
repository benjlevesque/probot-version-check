import atob from "atob";
import dateformat from "dateformat";
import { Context } from "probot";

function date8061(date: Date) {
  return `${dateformat(date, "yyyy-mm-dd")}T${dateformat(date, "HH:MM:ss")}Z`;
}
export async function getJsonContent(
  context: Context,
  commit: any,
  path: string,
): Promise<any> {
  let contentResponse;
  try {
    contentResponse = await context.github.repos.getContent(
      context.repo({
        path,
        ref: commit.ref,
      }),
    );
  } catch (er) {
    if (er.message === "Not Found") {
      return null;
    }
    throw er;
  }
  return {
    content: JSON.parse(
      Buffer.from(contentResponse.data.content, "base64").toString(),
    ),
    sha: contentResponse.data.sha,
  };
}

export async function setCheck(
  context: Context,
  checkId: number,
  conclusion: "success" | "failure" | "neutral" | "action_required",
  title: string,
  summary: string,
) {
  const { pull_request } = context.payload;

  const { owner, repo } = context.repo({
    head_sha: pull_request.head.sha,
  });
  await context.github.checks.update({
    check_run_id: checkId,
    completed_at: date8061(new Date()),
    conclusion,
    name: "Version Bump Check",
    output: {
      summary,
      title,
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
