import chalk from "chalk";
import { confirm, isCancel, text } from "@clack/prompts";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai";
import { ActionTracker } from "../agent/action-tracker";
import { ToolExecutor } from "../agent/tool-executor";
import { createAgentTools } from "../agent/agent-tools";
import { defaultAgentConfig } from "../agent/types";
import { runApprovalFlow } from "../agent/approval";
import { renderTerminalMD } from "../../tui/terminal-md";
import { generatePlan } from "./planner";


export async function runPlanMode(): Promise<void>{
    console.log(chalk.bold(chalk.green('\n Plan Mode \n')));

    const goal = await text({ message:"What is your main goal?"});
    if(isCancel(goal) || !goal) return;

    const plan = await generatePlan(goal);


    
    
}