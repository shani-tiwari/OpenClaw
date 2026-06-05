import chalk from "chalk";
import { Telegraf } from "telegraf";
import { WELCOME } from "./constants";
import { registerHandler } from "./handlers";

export async function runTelegramMode(){
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const ownerId = process.env.TELEGRAM_OWNER_ID;

    if(!token || !ownerId){
        console.log(chalk.red("Missing Telegram Token or Owner ID"))
        process.exit(0)
    }

    const bot = new Telegraf(token);
    

    await bot.telegram.sendMessage(ownerId, WELCOME, {parse_mode: 'Markdown' });
    console.log(chalk.green("[✓] Telegram Connected"));

    registerHandler(bot);
    bot.launch();
    console.log(chalk.green(`[✓] Telegram Bot Online`));

    await new Promise<void>((resolve) =>{
        const stop = () => {
            bot.stop('SIGINT');
            console.log(chalk.cyan("[-] Telegram Stopped"));
            resolve();
        };
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
    })

}