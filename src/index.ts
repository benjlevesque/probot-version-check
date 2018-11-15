import { Application } from "probot"; // eslint-disable-line no-unused-vars
import prHandler from "./pr-handler";

export = (app: Application) => {
  app.on("pull_request", prHandler);
};
