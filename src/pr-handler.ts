import { Application, Context } from "probot"; // eslint-disable-line no-unused-vars
import { createCheck, getJsonContent, setCheck } from "./utils";

export async function maybeSendMessage(context: Context, appName: string) {
  const response = await context.github.issues.getComments(
    context.issue({
      creator: appName,
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
  const branchContent = await getJsonContent(context, pr.head, "package.json");
  if (branchContent === null) {
    await setCheck(
      context,
      checkId,
      "neutral",
      "Unknown project type",
      "This branch does not contain a package.json",
    );
    return;
  }
  const branchPackageVersion = branchContent.content.version;
  const baseContent = await getJsonContent(context, pr.base, "package.json");
  if (baseContent === null) {
    await setCheck(
      context,
      checkId,
      "neutral",
      "Check irrelevant",
      `${pr.base.ref} does not contain a package.json to compare to`,
    );
    return;
  }
  const basePackageVersion = baseContent.content.version;
  const ok = branchPackageVersion > basePackageVersion;
  if (!ok) {
    await maybeSendMessage(context, app.app.name);
  }
  await setCheck(
    context,
    checkId,
    ok ? "success" : "action_required",
    ok ? "Version OK" : "Version not updated",
    `${basePackageVersion} => ${branchPackageVersion}`,
  );
}
