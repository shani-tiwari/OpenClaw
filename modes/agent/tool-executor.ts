import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { AgentConfig, ActionLog } from './types';
import { ActionTracker } from './action-tracker';
import { throwDeprecation } from 'node:process';



/* Text files - will treat as UTF-8 binaries */
const TEXT_EXT = new Set(['.md', '.js', '.jsx', '.ts', '.tsx', '.json', '.mjs', '.cjs', '.mdx', '.css', '.html', '.yml', '.yaml', '.toml', '.txt']);

function isTextFile(filePath: string): boolean{
    const ext = path.extname(filePath).toLowerCase();
    return TEXT_EXT.has(ext) || ext === '';
};


export class ToolExecutor{

    /* Staged changes - stored here */
    private overlay = new Map<string, string>();
    /* Staged deletions - stored here */
    private deleted = new Set<string>();

    /* Normalized path for os specific seprators */
    private readonly norm = (rel: string): string => {
       return path.posix.normalize(rel.split(path.sep).join('/')).replace(/^\.\//, '');
        // make sure to return it.
    };


    /* Resolve relative paths safely - inside your codebase */
    private resolveSafe(rel: string): string{
        const abs    = path.resolve(this.config.codebasePath, rel);
        const root   = path.resolve(this.config.codebasePath);
        const relChk = path.relative(root, abs);

        /* If the resolved path is outside the codebase path throw an error */
        if( relChk.startsWith('..') || path.isAbsolute(relChk)){
            throw new Error(`Path escaped wprkspace ${rel}`); 
        };

        return abs;

    };

    /* Excluded files like git, node_modules */
    private excluded (relPath: string): boolean{

        const norm = this.norm(relPath);

        const segments = norm.split('/');

        const base = segments[segments.length - 1] ?? '';

        for( const pat of this.config.excludePatterns){
            if(pat === '*.log' && base.startsWith('.log')) return true;
            if(pat === '.env*' && base.startsWith('.env')) return true;
            if(pat.includes('*')) continue;
            if(segments.includes(pat) || norm === pat || norm.startsWith(`${pat}/`)) return true; 
        };

        return false;

    };

    /* check excluded or not path */
    private assertNotExcluded(rel: string, op: string): void{
        if(this.excluded(rel)){
            throw new Error(`${op}: path is excluded by policy: ${rel}.`);
        };
    };

    
    /* for getting effective text */
    getEffectiveText(rel: string): string | undefined{
        const key = this.norm(rel);

        if(this.deleted.has(key)) return undefined;
        if(this.overlay.has(key)) return this.overlay.get(key);

        const abs = this.resolveSafe(rel);
        if(!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return undefined;

        return fs.readFileSync(abs, 'utf-8');

    };

    /* Tool executor uses child procees to run commands */
    constructor(private readonly config: AgentConfig, private readonly tracker: ActionTracker){}

    
};