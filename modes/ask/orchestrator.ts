import { confirm, isCancel, text } from "@clack/prompts";
import { stepCountIs, tool, ToolLoopAgent } from "ai";
import chalk from "chalk";
import z from "zod";
import { getAgentModel } from "../../ai";
import { ActionTracker } from "../agent/action-tracker";
import { ToolExecutor } from "../agent/tool-executor";
import { defaultAgentConfig } from "../agent/types";
import { renderTerminalMD } from "../../tui/terminal-md";
import { runApprovalFlow } from "../agent/approval";

function createAskTools(executor: ToolExecutor) {
  return {
    read_file: tool({
      description:
        " Read a text file from the workspace. use a path related to the project root.",
      inputSchema: z.object({
        path: z.string().describe("Relative path to the file"),
      }),
      execute: async ({ path }) => {
        try {
          const content = executor.readFile(path);
          return `content of ${path}:\n${content}`;
        } catch (error) {
          return error instanceof Error;
        }
      },
    }),
    list_files: tool({
      description:
        " List all files and folders in a directory. Use this tool to explore the codebase and find the files you need to work with.",
      inputSchema: z.object({
        path: z.string().describe("Relative path to the directory"),
        recursive: z.boolean().optional().default(false),
      }),
      execute: async ({ path, recursive }) => {
        try {
          return executor.listFiles(path, recursive);
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    }) /* search file */,
    search_file: tool({
      description:
        " Search for files matching name or extension patterns within the codebase. ",
      inputSchema: z.object({
        root: z.string().describe(" directory to search, relative to path"),
        pattern: z
          .string()
          .describe("Glob-like pattern using * and ** (forward slashes)"),
        content_contains: z
          .string()
          .optional()
          .describe(" Optional text search pattern.  "),
      }),
      execute: async ({ root, pattern, content_contains }) => {
        try {
          return executor.searchFiles(root, pattern, content_contains);
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    }),

    /* analyze codebase */
    analyze_codebase: tool({
      description:
        " Analyzes the codebase and returns a summary of the project structure, file counts, size, extensions, dependencies, and key files. Read-only. ",
      inputSchema: z.object({
        path: z.string().default("."),
      }),
      execute: async ({ path }) => {
        try {
          return executor.analyzeCodebase(path);
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    }) /* list skills */,
    list_skills: tool({
      description:
        " List absolute paths to SKILL.md files under configured skill directories. ",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return executor.listSkills();
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    }),

    /* read skills */
    read_skill: tool({
      description:
        " Read a SKILL.md file. Path must be absolute and underscale roots or use a path written by list_skills. ",
      inputSchema: z.object({
        path: z.string().describe("Path to the skill file"),
      }),
      execute: async ({ path }) => {
        try {
          return executor.readSkill(path);
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    }),
  };
};


export async function runAskMode() {
    console.log(chalk.bold(chalk.cyan("\n Ask Mode \n")));

    const question = await text({message: "what do u wanna ask ??"});
    if(isCancel(question)){
        return "";
    }

    /* manipulate some properties --- this will have only the access to create md files */
    const config = defaultAgentConfig();
    config.tools.allowFileCreation = true;
    config.tools.allowFileModification = false;
    config.tools.allowFolderCreation = false;
    config.tools.allowShellExecution = false;


    /* tracking the task progress */
    const actionTracker = new ActionTracker();
    const executor = new ToolExecutor(config, actionTracker);

    // todo: web-search tool(web-scraping)

    const tools = {...createAskTools(executor)};

    const agent =  new ToolLoopAgent({
        model: getAgentModel(),
        stopWhen: stepCountIs(20),
        tools 
    });


    const result = await agent.generate({prompt: question.trim()});
    const answer = result.text?.trim() || 'no answer';

    console.log("\n" + chalk.bold(chalk.green("Answer:")));
    console.log(renderTerminalMD(answer));


    const wantsSave = await confirm({
        message: "wanna save this answer to a .md file in current dir?",
        initialValue: false
    });
    if(isCancel(wantsSave) || !wantsSave) return "";

    const filename = await text({
        message: "filename for the answer",
        initialValue: "ask.md",
        validate: (value) => {
            const v = value?.trim();
            if(!v) return " filename is required ";
            if(v.includes('..') || v.includes('/') || v.includes('\\')) return "path traversal attempt"
            if(!v.toLowerCase().endsWith('.md')) return "file must end with .md extension ";
        },
    });

    if(isCancel(filename) || !filename) return "";

    executor.createFile(filename, asMD(question, answer));
    const ok = await runApprovalFlow(actionTracker);
    if(!ok) return executor.clearStaging();

    executor.applyApprovedFromTracker();
    executor.clearStaging();
    console.log(chalk.green("✅ Answer saved to ", filename));

    
};


// as MD function
function asMD(question: string, answer: string): string{
    return `# Ask Mode \n\n## Question\n\n ${question.trim()}\n\n## Answer\n\n${answer.trim()}\n\n`;
}
