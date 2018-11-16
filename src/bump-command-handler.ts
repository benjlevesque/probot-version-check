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

type VersionType = ReleaseType | "auto" | null;

const validateVersionType = (type: string) => {
  return (
    [
      "major",
      "premajor",
      "minor",
      "preminor",
      "patch",
      "prepatch",
      "prerelease",
      "auto",
    ].indexOf(type) >= 0
  );
};

export default async function(context: Context, command: Command) {
  log = context.log;
  const { issue } = context.payload;

  if (!issue.pull_request) {
    context.log("Not a PR, skipping");
    return;
  }
  const type = getType(command);
  if (type === null) {
    await sendHelp(context);
    return;
  }
  if (type === "auto") {
    throw new Error("not implemented");
  }
  const fileName = "package.json";

  const pr = await context.github.pullRequests.get(context.issue());
  const branch = pr.data.head;
  const branchName = branch.ref;

  const { content, sha } = await getJsonContent(context, branch, fileName);
  const { json, version } = bump(content, type);
  log({ sha, fileName, version, branchName });
  await context.github.repos.updateFile(
    context.repo({
      branch: branchName,
      content: Buffer.from(json).toString("base64"),
      message: `v${version}`,
      path: fileName,
      sha,
    }),
  );
}

export function bump(
  content: any,
  versionType: ReleaseType,
): { version: string; json: string } {
  const version = semver.inc(content.version, versionType);
  log(`New version : ${version}`);
  if (version === null) {
    throw new Error("impossible to increment version");
  }

  content.version = version;

  const str = JSON.stringify(content);
  log(str);
  const prettyStr = prettier.format(str, { parser: "json" });
  return {
    json: prettyStr,
    version,
  };
}

async function sendHelp(context: Context) {
  const params = context.issue({
    body: `Did you mean to bump the version? Try /bump [major|minor|patch].`,
  });
  await context.github.issues.createComment(params);
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

  return validateVersionType(type) ? (type as VersionType) : null;
}
