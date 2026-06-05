import {select, isCancel} from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import { runCLiMode } from "../modes/cli";
import { runTelegramMode } from "../modes/telegram";



const FONT = 'ANSI Shadow';
const SHADOW = chalk.hex('#e8dcf8');
/* i wanted my face to be different from shadow */
const FACE = chalk.hex('#5b4d9e').bold;


export async function runWakeUp() {
    let ascii:string;
    try {
        ascii = figlet.textSync('OpenClaw',{font: FONT});
    }
    catch(error) {
        ascii = figlet.textSync('OpenClaw',{font: "standard"});
    }  ;
    printBanner(ascii);

    /* selection of modes */
    const mode = await select({
        message: 'Select a mode',
        options: [
            {value: 'cli',label: 'CLI mode'},
            {value: 'telegram',label: 'Telegram mode'},
            {value: 'exit',label: 'Exit'},
        ],
    });

    /* if user cancels the mode selection */
    if(isCancel(mode || mode === 'exit')){
        console.log(chalk.red('Cancelled'));
        process.exit(0);
    };

    /* start mode */
    if(mode === 'cli'){
        await runCLiMode();
    }else if(mode === 'telegram'){
        console.log(chalk.green('OpenCLAW Telegram mode started'));
        await runTelegramMode();
    }
};




function printBanner(ascii: string){
    const bannerLines = ascii.replace(/\s+$/, '').split('\n');
    const maxLen = Math.max(...bannerLines.map(l => l.length), 0);
    const rowWidth = maxLen + 2;

    for (const line of bannerLines){
        console.log(SHADOW((" " + line).padEnd(rowWidth)));
    };

    process.stdout.write(`\x1b[${bannerLines.length}A`);

    for(const lines of bannerLines){
        console.log(FACE(lines.padEnd(rowWidth)));
    };
    console.log();
};