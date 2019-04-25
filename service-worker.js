import localforage from "localforage"

const saltLength = 128/8
const encoder = new TextEncoder()

const root = location.pathname.replace("service-worker.js", "")

function bytesToString(arrayBuffer){
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
}

function SHA256(message) {
    return crypto.subtle.digest('SHA-256', encoder.encode(message))
}

self.addEventListener('install', function(event) {
    //
})
  
self.addEventListener('activate', function(event) {
    self.clients.claim()
})

self.addEventListener('fetch', function(event) {
    event.respondWith(fetchListener(event))
})

var regData
var loginData

function fetchMapData(mapId){
    return Promise.all([
        fetch(`./data/${mapId}.svg`).then(res=>res.text()),
        fetch(`./data/${mapId}.json`).then(res=>res.json()).then(({data})=>data)
    ])
}

function succesResponse(data){
    return new Response(JSON.stringify(Object.assign({status: true}, data)))
}

function errorResponse(errorMessage){
    return new Response(JSON.stringify({status: false, errorMessage}))
}

async function fetchListener(event){
    const url = new URL(event.request.url)
    var [api, method, type] = url.pathname.slice(root.length).split("/")
    if(api == "api"){
        try{
            if(method == "delete"){
                localforage.clear()
                return succesResponse()
            }
            var body = await event.request.json()
            if(type == "username"){
                var data = await localforage.getItem(body.username)
                if(method == "login"){
                    if(data){
                        var {username, mapId, clientSalt, serverSalt, hash} = data
                        var [svg, data] = await fetchMapData(mapId)
                        loginData = {serverSalt, hash}
                        return succesResponse({username, clientSalt, mapData:{svg, data}})
                    }
                    else{
                        return errorResponse("Username not found")
                    }
                }
                else if(method == "signup"){
                    if(data){
                        return errorResponse("Username already exist")
                    }
                    else{
                        var username = body.username
                        var clientSalt = bytesToString(crypto.getRandomValues(new Uint8Array(saltLength)))
                        var files = await (await fetch("./data/files.json")).json()
                        var mapId =  files[Math.floor(crypto.getRandomValues(new Uint8Array(1))[0]/255 * files.length)]
                        var [svg, data] = await fetchMapData(mapId)
                        regData = {username, clientSalt, mapId}
                        return succesResponse({username, clientSalt, mapData:{svg, data}})
                    }
                }
            }
            else if(type == "password"){
                if(method == "login" ){
                    var hash = bytesToString(await SHA256(body.password + loginData.serverSalt))
                    if(hash == loginData.hash){
                        return succesResponse()
                    }
                    else{
                        return errorResponse("Wrong password")
                    }
                }
                else if(method == "signup"){
                    var serverSalt = bytesToString(crypto.getRandomValues(new Uint8Array(saltLength)))
                    var hash = bytesToString(await SHA256(body.password + serverSalt))
                    regData = Object.assign(regData, {hash, serverSalt})
                    await localforage.setItem(regData.username, regData)
                    return succesResponse()
                }
            }
            else{
                return fetch(event.request)
            }
        }
        catch{
            return errorResponse("Server error")
        }
    }
    else{
        return fetch(event.request)
    }
}