import { marked } from "marked";
import { markedTerminal } from "marked-terminal";




let ready = false;

function ensuerMarked(): void{
    if(ready) return;
    const width = Math.max(40, Math.min(process.stdout.columns || 80, 120));
    // @ts-ignore
    marked.use(markedTerminal({ width: width, reflowText: true}, {}));
    ready = true;
}

export function renderTerminalMD(source: string): string{
    ensuerMarked();
    return marked.parse(source.trimEnd(), {async: false});
}