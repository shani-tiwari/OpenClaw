import { extractJsonMiddleware, generateText, Output, stepCountIs, tool, wrapLanguageModel } from "ai";
import chalk from "chalk";
import z from "zod";
import { getAgentModel } from "../../ai";
import { ActionTracker } from "../agent/action-tracker";
import { ToolExecutor } from "../agent/tool-executor";
import { defaultAgentConfig } from "../agent/types";
import type {Plan, PlanStep} from "./types";



/* schema - how our output shoulf formed */
const PlanSchema = z.object({
    researchSummary: z.string().optional(),
    steps: z.array(
        z.object({
            // id: z.string(),
            title: z.string(),
            description: z.string(),
            hints: z.array(z.string()).optional(),
            complexity: z.enum(['low', 'mid', 'high']).optional()
        })
    )
    .min(1)
    .max(15),
});


/* Read Only Tools */
function readOnlyTools(executor: ToolExecutor){
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


const PLAN_INSTRUCTIONS = (codebase: string, hasWeb: boolean) => [
    ' You are a plan mode plan You do not modify files.',
    ' Use read only tools for codebase skills research',
    `Codebase/workspace: ${codebase}`,
    `${hasWeb ? 'Web tools are available Web search web crawl fats urn Use only when needed' : 'Web tools are unavailable No firecrawl_api_key' } `,
    'Output must match the provided Jason Schema ',
    'keep it short one to 10 steps',
].join('\n');


/* Main Function */
export async function generatePlan(goal: string){
    const config = defaultAgentConfig();
    const actionTracker = new ActionTracker();
    const executor = new ToolExecutor(config, actionTracker);

    const tools = {...readOnlyTools(executor)};
    const hasWeb = false;
    const model = wrapLanguageModel({
        model: getAgentModel(),
        middleware: extractJsonMiddleware()
    });

    console.log(chalk.yellow('🔍 Generating Plan... \n'));

    const result = await generateText({
        model,
        tools,
        stopWhen: stepCountIs(20),
        system: PLAN_INSTRUCTIONS(config.codebasePath, hasWeb),
        prompt: `user goal \n${goal}`,
        output: Output.object({schema: PlanSchema}),
    });

    const validate = PlanSchema.parse(result);

    const steps: PlanStep[] = validate.steps.map((step, i) => ({
        id          : `step-${i+1}`,
        title       : step.title,
        description : step.description,
        hints       : step.hints,
        complexity  : step.complexity,
    }));



    
}

