import btoa from "btoa";
import fs from "fs";
import nock from "nock";
import { Probot } from "probot";
import { promisify } from "util";
import myProbotApp from "../src";
import { getType } from "../src/bump-command-handler";
import commentPayload from "./fixtures/comment.created.json";
import prEditedPayload from "./fixtures/pull_request.edited.json";
import prSyncedPayload from "./fixtures/pull_request.synchronize.json";
const baseUrl = "https://api.github.com/repos/repousername/pr-tests";

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
describe("Comment - bump version", () => {
  let probot: Probot;
  beforeEach(() => {
    probot = new Probot({ id: 123, cert: "test" });
    const app = probot.load(myProbotApp);
    app.app = () => "test";
  });
  test("should do nothing if not PR", () => {
    // TODO
  });
  // test("should do nothing if does not contain bump", async () => {
  //   // TODO, not actually tested!
  //   await probot.receive({
  //     name: "issue_comment",
  //     payload: {
  //       action: "created",
  //       issue: {},
  //     },
  //   });
  // });
  test("should have auto type", () => {
    const command = (arg: string | null) => {
      return { arguments: arg, name: null };
    };
    expect(getType(command(null))).toBe("auto");
    expect(getType(command(""))).toBe("auto");
    expect(getType(command(" "))).toBe("auto");
    expect(getType(command(","))).toBe("auto");
  });
  test("should have correct type", () => {
    const command = (arg: string) => {
      return { arguments: arg, name: null };
    };
    expect(getType(command("patch"))).toBe("patch");
    expect(getType(command("minor"))).toBe("minor");
    expect(getType(command("major"))).toBe("major");
    expect(getType(command("foo"))).toBe("foo");
    expect(getType(command("foo bar"))).toBe("foo");
    expect(getType(command("foo,bar"))).toBe("foo");
  });
});

describe("commit", () => {
  let probot: Probot;
  beforeEach(() => {
    probot = new Probot({ id: 123, cert: "test" });
    const app = probot.load(myProbotApp);
    app.app = () => "test";
  });
  test("should work!", async () => {
    await probot.receive({ name: "issue_comment", payload: commentPayload });
  });
});
