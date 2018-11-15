import { PullRequestsGetResponseHead } from "@octokit/rest";
import fs from "fs";
import prettier from "prettier";
import { Context } from "probot"; // eslint-disable-line no-unused-vars
import { GitHubAPI } from "probot/lib/github";
import { LoggerWithTarget } from "probot/lib/wrap-logger";
import semver, { ReleaseType } from "semver";
import { promisify } from "util";
import { getJsonContent } from "./utils";
const readFile = promisify(fs.readFile);

let log: LoggerWithTarget;

type VersionType = ReleaseType;

export default async function(context: Context, command: Command) {
  log = context.log;
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
  const fileName = "package.json";

  const branch = await getBranchHead(
    context.github,
    repository.owner.login,
    repository.name,
    issue.number,
  );
  const branchName = branch.ref;

  const { json, version } = await bump(context.github, branch, type, fileName);
  await commit(
    context.github,
    repository.owner.login,
    repository.name,
    branchName,
    fileName,
    json,
    version,
  );
}

export async function getBranchHead(
  github: GitHubAPI,
  owner: string,
  repo: string,
  // tslint:disable-next-line:variable-name
  number: number,
): Promise<PullRequestsGetResponseHead> {
  const pr = await github.pullRequests.get({
    number,
    owner,
    repo,
  });
  return pr.data.head;
}

export async function bump(
  gh: GitHubAPI,
  head: any,
  versionType: VersionType,
  fileName: string,
): Promise<{ version: string; json: string }> {
  const content = await getJsonContent(gh, head, "package.json");
  content.version = semver.inc(content.version, versionType);
  const str = JSON.stringify(content);
  const prettyStr = prettier.format(str, { parser: "json" });
  return {
    json: prettyStr,
    version: content.version,
  };
}

// http://www.levibotelho.com/development/commit-a-file-with-the-github-api/
export async function commit(
  gh: GitHubAPI,
  owner: string,
  repo: string,
  branch: string,
  fileName: string,
  fileContent: string,
  version: string,
) {
  // #1
  const { sha } = (await gh.gitdata.getReference({
    owner,
    ref: `heads/${branch}`,
    repo,
  })).data.object;
  log({ step: 1, sha });

  // #2
  const { sha: commitSha, tree } = (await gh.gitdata.getCommit({
    commit_sha: sha,
    owner,
    repo,
  })).data;
  log({ step: 2, commitSha, tree });

  // #3
  const { sha: blobSha } = (await gh.gitdata.createBlob({
    content: fileContent,
    encoding: "utf8",
    owner,
    repo,
  })).data;
  log({ step: 3, blobSha });

  // #4
  const { tree: fileTrees } = (await gh.gitdata.getTree({
    owner,
    repo,
    tree_sha: tree.sha,
  })).data;
  const filtered = fileTrees.filter((ft: any) => ft.path === fileName);
  if (filtered.length === 0) {
    log({ step: 4, error: "no result", fileTrees });
    return;
  }
  const fileTreeSha = filtered[0].sha as string;
  log({ step: 4, fileTreeSha });

  // #5

  const { sha: newTreeSha } = (await gh.gitdata.createTree({
    base_tree: tree.sha,
    owner,
    repo,
    tree: [
      {
        mode: "100644",
        path: fileName,
        sha: blobSha,
        type: "blob",
      },
    ],
  })).data;
  log({ step: 5, newTreeSha });

  // #6
  const { sha: newCommitSha } = (await gh.gitdata.createCommit({
    message: `v${version}`,
    owner,
    parents: [commitSha],
    repo,
    tree: newTreeSha,
  })).data;
  log({ step: 6, newCommitSha });

  // #7
  await gh.gitdata.updateReference({
    owner,
    ref: `heads/${branch}`,
    repo,
    sha: newCommitSha,
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
