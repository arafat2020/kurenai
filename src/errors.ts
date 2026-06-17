/**
 * Represents a compile-time error in the Kurenai compiler pipeline.
 * Contains precise location and context metadata.
 */
export class CompilerError extends Error {
    constructor(
        public override message: string,
        public line: number,
        public column: number,
        public length: number
    ) {
        super(message);
        this.name = "CompilerError";
        
        // Ensure stack trace points to the constructor caller
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CompilerError);
        }
    }
}
