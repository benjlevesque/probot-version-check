import { exec } from "child_process";
import { Context } from "probot"; // eslint-disable-line no-unused-vars
import { GitHubAPI } from "probot/lib/github";

type VersionType = "major" | "minor" | "patch" | "auto";
export default async function(context: Context, command: Command) {
  const { issue, repository } = context.payload;
  if (!issue.pull_request) {
    context.log("Not a PR, skipping");
    return;
  }
  const type = getType(command);
  if (!isCorrectType(type)) {
    await sendHelp(context);
    return;
  }
  const branchName = await getBranchName(
    context.github,
    repository.owner.login,
    repository.name,
    issue.number,
  );
  await bump(repository.clone_url, branchName, type);
}

export async function getBranchName(
  github: GitHubAPI,
  owner: string,
  repo: string,
  // tslint:disable-next-line:variable-name
  number: number,
): Promise<string> {
  const pr = await github.pullRequests.get({
    number,
    owner,
    repo,
  });
  return pr.data.head.ref;
}

export async function bump(
  url: string,
  branchName: string,
  versionType: VersionType,
) {
  await new Promise((resolve, reject) => {
    exec(`cd tmp && yarn version --${versionType}`, (error, stdout, stderr) => {
      if (error !== null) {
        reject(error);
      }
      resolve();
    });
  });
}

async function sendHelp(context: Context) {
  const params = context.issue({
    body: `Did you mean to bump the version? Try /bump [major|minor|patch].`,
  });
  await context.github.issues.createComment(params);
}

export function isCorrectType(type: string) {
  const possibleTypes = ["major", "minor", "patch", "auto"];
  return possibleTypes.indexOf(type) >= 0;
}

export function getType(command: Command): VersionType {
  let type;
  if (command.arguments === null || command.arguments.trim() === "") {
    type = "auto";
  } else {
    const args = command.arguments
      .split(/[\s,]+/)
      .filter((x: string) => x !== "");
    if (args.length > 0) {
      type = args[0];
    } else {
      type = "auto";
    }
  }
  return type as VersionType;
}
