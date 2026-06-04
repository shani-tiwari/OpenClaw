import chalk from "chalk";
import {select, isCancel} from "@clack/prompts";
import { runAgentMode } from "./agent/orchestrator";



export async function runCLiMode() {
    console.log(chalk.green('OpenCLAW CLI mode started'));

    const mode = await select({
        message: 'Select a CLI sub-mode',
        options: [
            { value: 'agent', label: 'Agent mode' },
            { value: 'ask'  , label: 'Ask mode'   },
            { value: 'plan' , label: 'Plan mode'  },
            { value: 'exit' , label: 'Exit'       },
        ],
    });

    /* if user cancels the mode selection */
    if(isCancel(mode || mode === 'exit')){
        console.log(chalk.red('Cancelled'));
        process.exit(0);
    };

    /* start mode */
    if(mode === 'agent'){
        console.log(chalk.green('OpenCLAW Git mode started'));
        await runAgentMode();
    }else if(mode === 'plan'){
        console.log(chalk.green('OpenCLAW plan mode started'));
    }else if(mode === 'ask'){
        console.log(chalk.green('OpenCLAW ask mode started'));
    }

}