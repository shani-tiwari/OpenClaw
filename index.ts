#!/usr/bin/env bun
// shebang --- add layering to run file, not directly using bun command



import { Command } from 'commander'
import { runWakeUp } from './tui/wakeup';

const program = new Command()

program
  .name("OpenClaw")
  .description("A CLI tool for OpenCLay ")
  .version("0.0.1");

program.command("wakeup")
  .description("Wake up the openclaw environment")
  .action(async() => {
    await runWakeUp();
  });

program.parseAsync(process.argv);