window.addEventListener("message", (event) => {
    const message = event.data;

    if (message.type === "initialize") {

        const [major, minor, patch] = message.appVersion.split('.').map(Number);
        console.log('{{appVersion}}', '{{appVersion}}');
        setVersionPart('major-version', major);
        setVersionPart('minor-version', minor);
        setVersionPart('patch-version', patch);
    }
});


function setVersionPart(id, value) {
    const input = document.getElementById(id);
    input.value = value;
}

function updateVersionPart(id, increment) {
    const input = document.getElementById(id);
    let value = parseInt(input.value, 10) || 0;
    value = increment ? value + 1 : Math.max(0, value - 1);
    input.value = value;
}

document
    .getElementById('major-increment')
    .addEventListener('click', () =>
        updateVersionPart('major-version', true)
    );
document
    .getElementById('major-decrement')
    .addEventListener('click', () =>
        updateVersionPart('major-version', false)
    );
document
    .getElementById('minor-increment')
    .addEventListener('click', () =>
        updateVersionPart('minor-version', true)
    );
document
    .getElementById('minor-decrement')
    .addEventListener('click', () =>
        updateVersionPart('minor-version', false)
    );
document
    .getElementById('patch-increment')
    .addEventListener('click', () =>
        updateVersionPart('patch-version', true)
    );
document
    .getElementById('patch-decrement')
    .addEventListener('click', () =>
        updateVersionPart('patch-version', false)
    );

const vscode = acquireVsCodeApi();

async function serializeFiles() {
    const files = {};
    const sizeRequirements = {
        'favicon': [32, 32],
        'icon': [1024, 1024],
        'splash-icon': [1280, 720],
        'adaptive-icon': [1080, 1080],
    };

    await Promise.all(
        Object.keys(sizeRequirements).map((key) => {
            return new Promise((resolve, reject) => {
                const fileInput = document.getElementById(key);
                const file = fileInput.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        files[key] = {
                            name: file.name,
                            content: reader.result.split(',')[1], // Base64 content
                        };
                        resolve();
                    };
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(file);
                } else {
                    resolve(); // No file selected, resolve anyway
                }
            });
        })
    );

    return files;
}

async function validateAndSubmit(event) {
    event.preventDefault();

    const appVersion = [
        document.getElementById('major-version').value,
        document.getElementById('minor-version').value,
        document.getElementById('patch-version').value,
    ].join('.');

    document.getElementById('loading').style.display = 'block';
    document.getElementById('error-message').style.display = 'none';

    try {
        const serializedFiles = await serializeFiles();
        vscode.postMessage({
            type: 'update-assets',
            data: { files: serializedFiles, appVersion },
        });
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById(
            'error-message'
        ).textContent = `Error: ${error.message}`;
        document.getElementById('error-message').style.display = 'block';
    }
}

document
    .getElementById('assetForm')
    .addEventListener('submit', validateAndSubmit);

window.addEventListener('message', (event) => {
    const message = event.data;

    if (message.type === 'updated-previews') {
        const previews = message.previews;

        // Update the preview images dynamically
        Object.keys(previews).forEach((key) => {
            const imgElement = document.getElementById(`${key}-preview`);
            if (imgElement) {
                console.log(`Updating ${key}-preview with new src`);
                imgElement.src = `${previews[key]}?${new Date().getTime()}`; // Cache-busting
            } else {
                console.error(`Image element for ${key}-preview not found`);
            }
        });
    }

    if (message.type === 'error') {
        document.getElementById(
            'error-message'
        ).textContent = `Error: ${message.message}`;
        document.getElementById('error-message').style.display = 'block';
    }
});

window.onload = () => {
    vscode.postMessage({ type: "ready" });
};