import type {ActionLog, ActionStatus} from './types';  // from our types file 
import { isMutationType } from './types';

export class ActionTracker{

    private actions: ActionLog[] = [];

    /** creates a new action log */
    log(
        entry: Omit<ActionLog, 'id' | 'timestamp' > & {
            id? : string;
            timestamp? : Date;
        }
    ): ActionLog{
        const action: ActionLog = {
            id           : entry.id ?? `action_${this.actions.length}`,
            timestamp    : entry.timestamp ?? new Date(),
            type         : entry.type,
            path         : entry.path,
            details      : { ...entry.details },
            status       : entry.status,
            userApproved : entry.userApproved,
        };
        this.actions.push(action);
        return action;        
    }

    /** returns an immutable snapshot */
    getActions(): readonly ActionLog[]{
        return this.actions;
    };

    /** returns only pending mutations */
    getPendingMutations(): ActionLog[]{
        return this.actions.filter(
            (action) => isMutationType(action.type) && action.status === 'pending'
        );
    };
    
    /** marks an action as executed (or updated status) */
    updateStatus(id:string, status:ActionStatus, approved?:boolean): boolean {
        const action = this.actions.find((a) => a.id === id);
        if (!action){
            return false; // action not found
        }

        action.status = status;
        
        // if its a mutation and user approved => set to 'approved', otherwise leave as is (rejected or pending)
        if (isMutationType(action.type) && approved === true) {
            action.userApproved = true;
            action.status = 'approved';
        }
    
        return true;
    }
}