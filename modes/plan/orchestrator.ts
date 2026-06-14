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
import { printPlan, selectSteps } from "./selection";
import type { PlanStep } from "./types";
import { createWebTools } from "./web-tools";
import { withCliLoader } from "../../loader";


export async function runPlanMode(): Promise<void>{
    console.log(chalk.bold(chalk.green('\n Plan Mode \n')));

    const goal = await text({ message:"What is your main goal?"});
    if(isCancel(goal) || !goal) return;

    const plan = await withCliLoader(
        "Generating plan...",
        () => generatePlan(goal),
        { successMessage: "Plan ready" },
    );
    printPlan(plan);

    const steps = await selectSteps(plan);
    if(steps.length === 0) return;

    const proceed = await confirm({
        message: `Execute ${steps.length} steps?`,
        initialValue: true,
    });


    const config = defaultAgentConfig();
    const actionTracker = new ActionTracker();
    const executor = new ToolExecutor(config, actionTracker);

    const model = getAgentModel();


    const tools = {...createAgentTools(executor), ...createWebTools(actionTracker)};
    

    for(const step of steps){
        console.log(chalk.blue(`\n ${step.title}\n`));

        const agent = new ToolLoopAgent({
            model: getAgentModel(),
            stopWhen: stepCountIs(30),
            tools
        });

        const result = await withCliLoader(
            `Executing step: ${step.title}...`,
            () => agent.generate({ prompt: stepPrompt(plan.goal, step) }),
            { successMessage: `Step complete: ${step.title}` },
        );
        if(result.text){
            return console.log(renderTerminalMD(result.text));
        };

        const ok = await runApprovalFlow(actionTracker);
        if(!ok) return executor.clearStaging();

        const {errors} = executor.applyApprovedFromTracker();
        if(errors.length){
            console.log(chalk.red(`Failed to apply changes`))
            for(const e of errors) console.log(chalk.red(`- ${e}`)) ;
        }else{
            console.log(chalk.green(' ✅ changes applied successfully '));
        };
        executor.clearStaging();
    };

    
};



function stepPrompt(goal: string ,step: PlanStep): string{
    return [`Goal: ${goal}, Step: ${step.title}\n, ${step.description}`].join('\n');
}