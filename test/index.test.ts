import btoa from "btoa";
import nock from "nock";
import { Probot } from "probot";
import myProbotApp from "../src";
import prEditedPayload from "./fixtures/pull_request.edited.json";
import prSyncedPayload from "./fixtures/pull_request.synchronize.json";

nock.disableNetConnect();

function mockGetContents(version: string) {
  return (res: any) => {
    return {
      content: btoa(`{"version":"${version}"}`),
    };
  };
}

function testGenerator(
  branchVersion: string,
  masterVersion: string,
  expectedConclusion: string,
  payload: any,
) {
  return async () => {
    const probot = new Probot({ id: 123, cert: "test" });
    const app = probot.load(myProbotApp);
    app.app = () => "test";

    const fnGetContentsBranch = jest.fn(mockGetContents(branchVersion));
    const fnGetContentsMaster = jest.fn(mockGetContents(masterVersion));
    const fnPostChecks = jest.fn((body: any) => {
      expect(body).not.toBeNull();
      expect(body.status).toBe("in_progress");
      expect(body.name).toBe("Version Bump Check");
      return true;
    });
    const fnPatchChecks = jest.fn((body: any) => {
      expect(body).not.toBeNull();
      expect(body.status).toBe("completed");
      expect(body.conclusion).toBe(expectedConclusion);
      return true;
    });
    const baseUrl = "https://api.github.com/repos/repousername/pr-tests";
    nock(baseUrl)
      .get("/contents/package.json?ref=branchname")
      .reply(200, fnGetContentsBranch);
    nock(baseUrl)
      .get("/contents/package.json?ref=master")
      .reply(200, fnGetContentsMaster);
    nock(baseUrl)
      .post("/check-runs", fnPostChecks)
      .reply(200, () => {
        return {
          id: 1,
        };
      });
    nock(baseUrl)
      .patch("/check-runs/1", fnPatchChecks)
      .reply(200);

    await probot.receive({ name: "pull_request", payload });
    expect(fnGetContentsMaster).toHaveBeenCalledTimes(1);
    expect(fnGetContentsBranch).toHaveBeenCalledTimes(1);
    expect(fnPostChecks).toHaveBeenCalledTimes(1);
    expect(fnPatchChecks).toHaveBeenCalledTimes(1);
  };
}

describe("My Probot app", () => {
  test(
    "Pull request edited event should send a failure check",
    testGenerator("1.0.0", "1.0.0", "failure", prEditedPayload),
  );
  test(
    "Pull request edited event should send a success check",
    testGenerator("1.1.0", "1.0.0", "success", prEditedPayload),
  );

  test(
    "Pull request synchronize event should send a failure check",
    testGenerator("1.0.0", "1.0.0", "failure", prSyncedPayload),
  );
  test(
    "Pull request synchronize event should send a success check",
    testGenerator("1.1.0", "1.0.0", "success", prSyncedPayload),
  );
});
