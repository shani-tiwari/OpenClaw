import { tool } from "ai";
import {z} from "zod"; 
import type { ToolExecutor } from "./tool-executor";



export function createAgentTools(executor: ToolExecutor){
    return {
        /* Reading files tool */
        read_file: tool({
            description: " Read a text file from the workspace. use a path related to the project root.",
            inputSchema: z.object({
                path: z.string().describe("Relative path to the file")
            }),
            execute: async({path})=>{
                try {
                    const content = executor.readFile(path);
                    return `content of ${path}:\n${content}`;
                } catch (error) {
                    return error instanceof Error
                }
            }
        }),

        /* creating files tool */
        create_file: tool({
            description: "Creates a new text file. Use this for writing new code or creating config files(not written until the user approves).",
            inputSchema: z.object({
                path: z.string().describe("Relative path to the file to create"),
                content: z.string().describe("The content to write in the file. Make sure it is valid format for the file type (e.g., valid JSON, HTML, etc.)"),
            }),
            execute: async({path, content}) => {
                try {
                    return executor.createFile(path, content);
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            }
        }),

        /* modify file */
        modify_file: tool({
            description: " Modify an existing file. Replace the entire content of the file with the new content provided.",
            inputSchema: z.object({
                path: z.string().describe("Relative path to the file"),
                content: z.string().describe("New content to replace file"),
            }),
            execute: async({path, content})=>{
                try {
                    const result = executor.modifyFile(path, content);
                    return result ? `${result}` : "file modified successfully";
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            }
        }),

        /* delete file */
        delete_file: tool({
            description: " Delete an existing file. Use this tool only when the file is not needed anymore.",
            inputSchema: z.object({
                path: z.string().describe("Relative path to the file")
            }),
            execute: async({path})=>{
                try {
                    const result = executor.deleteFile(path);
                    return result ? `${result}` : "file deleted successfully";
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            }
        }),

        /* creating folder */
        create_folder: tool({
            description: "Creates a new folder. Use this for organizing files and creating new directories.",
            inputSchema: z.object({
                path: z.string().describe("Relative path to the folder to create")
            }),
            execute: async({path})=>{
                try {
                    return executor.createFolder(path);
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            }
        }),

        /* list files */
        list_files: tool({
            description: " List all files and folders in a directory. Use this tool to explore the codebase and find the files you need to work with.",
            inputSchema: z.object({
                path: z.string().describe("Relative path to the directory"),
                recursive: z.boolean().optional().default(false)
            }),
            execute: async({path, recursive})=>{
                try {
                    return executor.listFiles(path, recursive);
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            }
        }),


        /* search file */
        search_file: tool({
            description: " Search for files matching name or extension patterns within the codebase. ",
            inputSchema: z.object({
                root: z.string().describe(" directory to search, relative to path"),
                pattern: z.string().describe("Glob-like pattern using * and ** (forward slashes)"),
                content_contains: z.string().optional().describe(" Optional text search pattern.  ")
            }),
            execute: async({root, pattern, content_contains})=>{
                try {
                    return executor.searchFiles(root, pattern, content_contains);
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            }
        }),

        /* analyze codebase */
        analyze_codebase: tool({
            description: " Analyzes the codebase and returns a summary of the project structure, file counts, size, extensions, dependencies, and key files. Read-only. ",
            inputSchema: z.object({
                path: z.string().default('.')
            }),
            execute: async({path})=>{
                try {
                    return executor.analyzeCodebase(path);
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            }
        }),

        /* execute shell */
        execute_shell: tool({
            description: " Queue a shell Command to run in the workspace after user approval used with care.",
            inputSchema: z.object({
                command: z.string().describe(" The shell command to execute. Must be safe, non-destructive, and respect the workspace boundary.")
            }),
            execute: async({command})=>{
                try {
                    const result = executor.queueShell(command);
                    return result ? `${result}` : "Command executed successfully";
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            }
        }),

        /* list skills */
        list_skills: tool({
            description: " List absolute paths to SKILL.md files under configured skill directories. ",
            inputSchema: z.object({}),
            execute: async()=>{
                try {
                    return executor.listSkills();
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            }
        }),


        /* read skills */
        read_skill: tool({
            description: " Read a SKILL.md file. Path must be absolute and underscale roots or use a path written by list_skills. ",
            inputSchema: z.object({
                path: z.string().describe("Path to the skill file")
            }),
            execute: async({path})=>{
                try {
                    return executor.readSkill(path);
                } catch (error) {
                    return error instanceof Error ? error.message : String(error);
                }
            }
        }),



    }
}