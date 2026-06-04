import { select, isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { createAgentTools } from "./agent-tools";
import { stepCountIs, tool, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai";

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

    // to make AI use operations on loop
    const agentTools = new ToolLoopAgent({
        model: getAgentModel(),
        stopWhen: stepCountIs(40),
        instructions: [
            ` workspace root: ${config.codebasePath}`,
            " All mutatiosn are staged until approval"
        ].join("\n"),
        tools,
    });

    const result = await agentTools.generate({
        prompt: goal.trim(),
        onStepFinish: ({toolCalls})=>{
            if(toolCalls?.length > 0){
                chalk.blue(`tool call: ${toolCalls}`);
            };
            for(const tc of toolCalls){
                const preview = JSON.stringify(tc.input).slice(0, 160);     
                console.log(
                    chalk.green('☑️'), 
                    chalk.bold(String(tc.toolName)), 
                    chalk.dim(preview + (preview.length >= 160 ? '...' : ''))
                );
            };
        }
    });
    if(result.text?.trim()){
        console.log(chalk.green('complete emoji'), 
        chalk.bold('done'),
        chalk.dim(result.text.trim())
        );
    };
    console.log("\n " + chalk.green("Operation completed") + `\n ${result.text?.trim()}`)

}