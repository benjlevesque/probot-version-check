import { Context } from "probot";
import { createCheck, getJsonContent, setCheck } from "./utils";

export default async function(context: Context) {
  const checkId = await createCheck(context);
  const { pull_request: pr, repository: repo } = context.payload;
  const branchPackageVersion = (await getJsonContent(
    context.github,
    pr.head,
    "package.json"
  )).version;
  const basePackageVersion = (await getJsonContent(
    context.github,
    pr.base,
    "package.json"
  )).version;
  console.log(`${basePackageVersion} => ${branchPackageVersion}`);
  await setCheck(
    context,
    checkId,
    branchPackageVersion > basePackageVersion,
    `${basePackageVersion} => ${branchPackageVersion}`
  );
}
