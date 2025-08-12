// @ts-check
const vscode = acquireVsCodeApi();

declare const window: any;
declare const document: any;
declare function acquireVsCodeApi(): {
    postMessage: (message: any) => void;
    setState: (state: any) => void;
    getState: () => any;
};

/** @typedef {{folder:string; fileName:string}} Dest */
let state = { destinations: /** @type{Record<string, Dest>} */({}) };

window.addEventListener('message', (event: any) => {
    const msg = event.data;
    if (msg.type === 'initialize') {
        state.destinations = msg.destinations || {};
        // set version inputs + image previews from msg.previews...
    }
    if (msg.type === 'updated-previews') {
        // refresh <img> srcs with provided base64 previews
    }
    if (msg.type === 'refresh') {
        vscode.postMessage({ type: 'ready' });
    }
    if (msg.type === 'error') {
        // show error banner
    }
});

document.getElementById('refresh-btn')?.addEventListener('click', () => {
    vscode.postMessage({ type: 'refresh' });
});

// When user edits destination folder / file name:
function onDestinationChange(key: any, folder: any, fileName: any) {
    vscode.postMessage({ type: 'set-destination', key, folder, fileName });
}

window.onload = () => vscode.postMessage({ type: 'ready' });


