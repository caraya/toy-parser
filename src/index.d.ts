export interface Options {
    [key: string]: any;
}

export class Node {
    constructor(name: string, type: string);
    
    name: string;
    type: string;
    attrs: Record<string, string>;
    children: Node[];
    parent: Node | null;
    text: string;

    appendChild(node: Node): void;
    removeChild(node: Node): void;
    
    toHtml(options?: { indent?: number }): string;
    toText(): string;
    toMarkdown(): string;
    
    query(selector: string): Node | null;
    queryAll(selector: string): Node[];

    // DOM Compatibility Layer
    readonly nodeType: number;
    readonly nodeName: string;
    readonly tagName: string;
    readonly textContent: string;
    readonly childNodes: Node[];
    readonly parentNode: Node | null;
    readonly firstChild: Node | null;
    readonly lastChild: Node | null;
    readonly nextSibling: Node | null;
    readonly previousSibling: Node | null;

    getAttribute(name: string): string | null;
    hasAttribute(name: string): boolean;
    querySelector(selector: string): Node | null;
    querySelectorAll(selector: string): Node[];
}

export class JustHTML {
    constructor(html?: string | null, options?: Options);
    
    options: Options;
    root: Node;
    
    write(chunk: string): void;
    end(): void;
}

export default JustHTML;
