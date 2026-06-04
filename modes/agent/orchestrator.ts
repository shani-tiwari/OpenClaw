import { select, isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { createAgentTools } from "./agent-tools";

export async function runAgentMode() {
    console.log(chalk.green('OpenCLAW Agent mode started'));

    /* getting the goal from user */
    const goal = await text({
        message: "what would u like the agent to do ?",
        placeholder: "Concrete task for this codebase...",
    });
    
    if(isCancel(goal) || !goal.trim()){
        console.log(chalk.red('Cancelled'));
        process.exit(0);
    };

    const config = defaultAgentConfig();
    const tracker = new ActionTracker();
    const executor = new ToolExecutor(config, tracker);
    const tools = createAgentTools(executor);
}