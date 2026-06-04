import { isCancel, select } from "@clack/prompts";
import type { ActionTracker } from "./action-tracker";
import type { ActionLog } from "./types";
import chalk from "chalk";
import { composeBeforeAfter, formatPatch } from "./diff-view";
import { renderTerminalMD } from "../../tui/terminal-md";


interface ReviewGroup{
    label: string,
    actionIds: string[],
    patch: string | null
};


function groupPending(pending: ActionLog[]): ReviewGroup[] {

  const byPath = new Map<string, ActionLog[]>();
  const shells: ActionLog[] = [];

  for (const a of pending) {
    if (a.type === 'tool_execute') {
      shells.push(a);
      continue;
    }
    const key = a.path;
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key)!.push(a);
  }

  const groups: ReviewGroup[] = [];
  const pathEntries = [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (const [p, acts] of pathEntries) {
    const sorted = acts.sort((x, y) => x.timestamp.getTime() - y.timestamp.getTime());
    const ids = sorted.map((x) => x.id);

    if (sorted.every((x) => x.type === 'folder_create')) {
      groups.push({ label: `Create folder: ${p}`, actionIds: ids, patch: null });
      continue;
    }

    const { before, after } = composeBeforeAfter(sorted);
    const patch = formatPatch(p, before, after);
    const kinds = [...new Set(sorted.map((x) => x.type))].join(', ');
    groups.push({ label: `${p} (${kinds})`, actionIds: ids, patch });
  };


  for (const s of shells) {
    groups.push({
      label: `Shell: ${s.details.command ?? '(no command)'}`,
      actionIds: [s.id],
      patch: null,
    });
  }

  return groups;
}



export async function runApprovalFlow(tracker: ActionTracker): Promise<boolean> {
  const pending = tracker.getPendingMutations();

  if(pending.length === 0){
    console.log(chalk.green('✅ No pending changes to apply'))
    return false;
  };

  const choice = await select({
    message: "Review the changes and pick an option",
    options: [
        { value: 'all', label: "✅ Approve all changes"},
        { value: 'select', label: "📝 Selectively approve/reject files"},
        { value: 'cancel', label: "🛑 Cancel and clear all"}
    ]
  })

  if(isCancel(choice) || choice === 'cancel'){
    // tracker.clear();
    for(const p of pending){
        tracker.updateStatus(p.id, 'rejected', false);
    };
    return false;
  };

  if(choice === "all"){
    for(const p of pending){
        tracker.updateStatus(p.id, 'approved', true);
    };
    return true;
  };

  for(const g of groupPending(pending)){
    while(true){
        const opt = await select({
            message: chalk.bold(g.label),
            options: [
                { value: 'approved', label: "✅ Approve", hint: "accept changes" },
                { value: 'rejected', label: "❌ Reject", hint: "discard changes" },
                { value: 'diff', label: "📖 Show diff only" },
            ]
        });

        if(isCancel(opt)){
            for(const p of pending) tracker.updateStatus(p.id, 'rejected', false);
            return false;
        };

        if(opt === 'diff'){
            if(g.patch){
                console.log('\n' + renderTerminalMD('```diff\n' + g.patch + '\n```') + '\n');
            };
            continue;
        };



        for(const id of g.actionIds){
            tracker.updateStatus(id, opt === 'approved' ? 'approved' : 'rejected', opt === 'approved');            
        };

        if(opt === "approved") break;
    }
  }
  return tracker.getActions().some((x) => x.status === 'approved');
  
}
