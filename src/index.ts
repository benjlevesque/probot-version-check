import { Application, Context } from "probot"; // eslint-disable-line no-unused-vars
import commands from "probot-commands";
import bumpCommandHandler from "./bump-command-handler";
import prHandler from "./pr-handler";

export = (app: Application) => {
  app.on("pull_request", prHandler);
  commands(app, "bump", bumpCommandHandler);
  app.on("*", async (context: Context) => {
    app.log(`Received: ${context.event}`);
  });
};
