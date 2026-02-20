// js/core/history.js

export class StateHistory {
    constructor(limit = 20) {
        this.stack = [];
        this.index = -1;
        this.limit = limit;
    }

    push(state) {
        // If we are in the middle of the history, truncate the "future"
        if (this.index < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.index + 1);
        }

        // Don't push if it's the same as current
        if (this.stack.length > 0 && JSON.stringify(this.stack[this.index]) === JSON.stringify(state)) {
            return;
        }

        this.stack.push(JSON.parse(JSON.stringify(state)));
        if (this.stack.length > this.limit) {
            this.stack.shift();
        } else {
            this.index++;
        }
    }

    undo() {
        if (this.index > 0) {
            this.index--;
            return JSON.parse(JSON.stringify(this.stack[this.index]));
        }
        return null;
    }

    redo() {
        if (this.index < this.stack.length - 1) {
            this.index++;
            return JSON.parse(JSON.stringify(this.stack[this.index]));
        }
        return null;
    }

    canUndo() {
        return this.index > 0;
    }

    canRedo() {
        return this.index < this.stack.length - 1;
    }
}
