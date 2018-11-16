import { Application, Context } from "probot"; // eslint-disable-line no-unused-vars
import { createCheck, getJsonContent, setCheck } from "./utils";

export async function maybeSendMessage(context: Context, appName: string) {
  const response = await context.github.issues.getComments(
    context.issue({
      creator: appName,
      state: "all",
    }),
  );

  if (response.data.length > 0) {
    return;
  }
  const params = context.issue({
    body:
      "You can bump the package version using `/bump [major|minor|patch]`. :+1: ",
  });
  await context.github.issues.createComment(params);
}

export default async function(context: Context, app: Application) {
  const checkId = await createCheck(context);
  const { pull_request: pr } = context.payload;
  const branchPackageVersion = (await getJsonContent(
    context.github,
    pr.head,
    "package.json",
  )).version;
  const basePackageVersion = (await getJsonContent(
    context.github,
    pr.base,
    "package.json",
  )).version;
  const ok = branchPackageVersion > basePackageVersion;
  if (!ok) {
    await maybeSendMessage(context, app.app.name);
  }
  await setCheck(
    context,
    checkId,
    ok,
    `${basePackageVersion} => ${branchPackageVersion}`,
  );
}
