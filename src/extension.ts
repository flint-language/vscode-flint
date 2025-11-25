import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    Executable,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log("🔥 Flint extension activated");
    vscode.window.showInformationMessage("Flint extension activated");
    const flintPath = await getFlintCommandPath();
    if (!flintPath) {
        vscode.window.showErrorMessage(
            `Could not resolve Flint executable.

Please ensure it is available on the PATH used by VS Code, or set an explicit "flint.path" setting to a valid Flint executable.`
        );
        return;
    }

    const ws = vscode.workspace.workspaceFolders?.[0];
    const cwd = ws ? ws.uri.fsPath : process.cwd();

    const run: Executable = {
        command: flintPath,
        args: ["lsp"],
        options: {
            cwd,
        },
    };

    const serverOptions: ServerOptions = {
        run,
        debug: run,
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: "file", language: "flint" }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher("**/*.flint"),
        },
    };

    client = new LanguageClient(
        "flint-lsp",
        "Flint Language Server",
        serverOptions,
        clientOptions,
    );

    client.start();
    context.subscriptions.push(client);

    vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("flint.path")) {
            vscode.window.showInformationMessage(
                "Flint settings changed. Reload VS Code to restart LSP."
            );
        }
    });
}

async function getFlintCommandPath(): Promise<string | undefined> {
    const config = vscode.workspace.getConfiguration("flint");
    const exePath = config.get<string>("path");
    const command = exePath && exePath.trim().length > 0 ? exePath : "flint";
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || path.isAbsolute(command)) {
        return command;
    }

    for (const folder of workspaceFolders) {
        const resolved = path.resolve(folder.uri.fsPath, command);
        if (await fileExists(resolved)) {
            return resolved;
        }
    }
    return undefined;
}

function fileExists(p: string): Promise<boolean> {
    return new Promise(resolve => {
        fs.stat(p, (err, stat) => {
            resolve(!err && stat.isFile());
        });
    });
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}