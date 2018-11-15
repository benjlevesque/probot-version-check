const { Application, Context } = require("probot");

interface Command {
  name: string?;
  arguments: string?;
}

declare module "probot-commands" {
  export default function(
    robot: Application,
    name: string,
    callback: (context: Context, command: Command) => any,
  );
  export const Command;
}
