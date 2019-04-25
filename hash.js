const KB = 1024 * 1024
const MB = 1024 * KB
const GB = 1024 * MB
const WASM_PAGE_SIZE = 64 * 1024

const mem = 128 * 1024 // KiB

const totalMemory = (2*GB - 64*KB) / 1024 / WASM_PAGE_SIZE
const initialMemory = Math.min(Math.max(Math.ceil(mem * 1024 / WASM_PAGE_SIZE), 256) + 256, totalMemory)

const wasmMemory = new WebAssembly.Memory({
    initial: initialMemory,
    maximum: totalMemory
})

global.Module = {
    wasmJSMethod: "native-wasm",
    wasmMemory: wasmMemory,
    buffer: wasmMemory.buffer,
    TOTAL_MEMORY: initialMemory * WASM_PAGE_SIZE
}

import {argon2} from "argon2-browser"

argon2.hash({pass: "password", salt: "somesalt", distPath: "/argon2.min.js#"})
.catch(()=>{})

function bytesToString(arrayBuffer){
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
}

async function hash(pass, salt){
    var {hash} = await argon2.hash({
        pass, 
        salt,
        time: 1, 
        mem, 
        parallelism: 1,
        type: argon2.ArgonType.Argon2d
    })
    return bytesToString(hash)
}

export {hash}