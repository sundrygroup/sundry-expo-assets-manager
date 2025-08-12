export const nonce = () => [...Array(16)].map(() => Math.random().toString(36)[2]).join('');
