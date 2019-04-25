import "./semantic/semantic.js"
import "./semantic/components/accordion.js"
import {hash} from "/hash.js"
import {loadMap, selectedPath, deletePath} from "./map.js"

var swNotSupportedMessage = document.querySelector("#sw-not-supported")
if('serviceWorker' in navigator){
    window.addEventListener('load', async ()=>{
        var registration = await navigator.serviceWorker.register("./service-worker.js", {scope: "./"})
    })
}
else{
    swNotSupportedMessage.classList.remove("hidden")
}

var delLink = document.querySelector("#del-link")
delLink.onclick = async ()=>{
    await fetch("./api/delete")
    $(delLink).popup({content: "It's gone!"}).popup("show")
    setTimeout(()=>$(delLink).popup("destroy"), 2000)
}

var login = document.querySelector("#login")
var username = login.querySelector("#username")
var loginError = login.querySelector("#login-error")
var loginButton = login.querySelector("#login-button")
var signupButton = login.querySelector("#signup-button")
var loginDimmer = login.querySelector(".dimmer")

var map = document.querySelector("#map")
var select = map.querySelector("#select")
$(select).accordion()
var confirm = map.querySelector("#confirm")
$(confirm).accordion()
var accordions = [select, confirm]
var mapContainer = map.querySelector("#map-container")
var mapError = map.querySelector("#map-error")
var restartButton = map.querySelector("#restart-button")
var nextButton = map.querySelector("#next-button")
var mapDimmer = map.querySelector(".dimmer")

var success = document.querySelector("#success")
var loggedInText = success.querySelector("#logged-in")
var signedUpText = success.querySelector("#signed-up")
var succesTexts = [loggedInText, signedUpText]
var backButton = success.querySelector("#back-button")

var pages = [login, map, success]

function setErrorMessage(element, message){
    element.innerHTML = ""
    element.classList.add("hidden")
    if (message){
        element.classList.remove("hidden")
        element.innerHTML = message
    }
}

function displaySelected(selected, all){
    all.forEach(elem=>elem.classList.add("hidden"))
    if(selected){
        selected.classList.remove("hidden")
    }
}

function pageMap(){
    displaySelected(map, pages)
    setErrorMessage(mapError)
    restartButton.onclick = deletePath
}

function pageMapSignup(mapData, clientSalt){

    pageMap()
    displaySelected(select, accordions)
    loadMap(mapContainer, mapData)

    var path
    
    nextButton.onclick = ()=>{
        pageMapConfirm(path, clientSalt)
    }

    selectedPath.onevent = event=>{
        path = event.pathSecret
        if(path == ""){
            nextButton.classList.add("disabled")
        }
        else{
            nextButton.classList.remove("disabled")
        }
    }
}

function pageMapConfirm(path, clientSalt){

    pageMap()
    displaySelected(confirm, accordions)
    
    var pathConfirm

    nextButton.onclick = async ()=>{
        if(path == pathConfirm){
            mapDimmer.classList.add("active")

            var password = await hash(path, clientSalt)
            await fetch("./api/signup/password", {method: "POST", body: JSON.stringify({password})}).then(res=>res.json())
            
            mapDimmer.classList.remove("active")
            pageSuccess("signup")
        }
        else{
            nextButton.classList.add("disabled")
            setErrorMessage(mapError, "Not matching")
        }
    }

    selectedPath.onevent = event=>{
        nextButton.classList.remove("disabled")
        setErrorMessage(mapError)
        pathConfirm = event.pathSecret
    }

    deletePath()
}

function pageMapLogin(mapData, clientSalt){

    pageMap()
    displaySelected(undefined, accordions)
    loadMap(mapContainer, mapData)

    var path
    nextButton.onclick = async ()=>{
        mapDimmer.classList.add("active")

        var password = await hash(path, clientSalt)
        var {status, errorMessage} = await fetch("./api/login/password", {method: "POST", body: JSON.stringify({password})}).then(res=>res.json())

        mapDimmer.classList.remove("active")
        if(status == false){
            nextButton.classList.add("disabled")
            setErrorMessage(mapError, errorMessage)
        }
        else{
            pageSuccess("login")
        }
    }

    selectedPath.onevent = event=>{
        setErrorMessage(mapError)
        path = event.pathSecret
        if(path == ""){
            nextButton.classList.add("disabled")
        }
        else{
            nextButton.classList.remove("disabled")
        }
    }
}

function pageSuccess(method){
    displaySelected(success, pages)
    if(method == "login"){
        displaySelected(loggedInText, succesTexts)
    }
    else if(method == "signup"){
        displaySelected(signedUpText, succesTexts)
    }
}

function pageLogin(){
    username.value = ""
    mapContainer.firstChild.remove()
    nextButton.classList.add("disabled")
    displaySelected(login, pages)
}


function loginPageHandlers(method){
    return async () =>{
        if(username.value == ""){
            setErrorMessage(loginError, "Enter an username")
        }
        else{
            setErrorMessage(loginError)
            loginDimmer.classList.add("active")
    
            var {status, errorMessage, mapData, clientSalt} = await fetch(`./api/${method}/username`, {method: "POST", body: JSON.stringify({username: username.value})}).then(res=>res.json())
            
            loginDimmer.classList.remove("active")
            if(status == false){
                setErrorMessage(loginError, errorMessage)
            }
            else{
                if(method == "login"){
                    pageMapLogin(mapData, clientSalt)
                }
                else if(method == "signup"){
                    pageMapSignup(mapData, clientSalt)
                }
                
            }
        }
    }
}

loginButton.onclick = loginPageHandlers("login")

signupButton.onclick = loginPageHandlers("signup")

backButton.onclick = ()=>{
    pageLogin()
}