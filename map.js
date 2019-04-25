import Snap from "snapsvg-cjs"
import {point, lineString, distance, nearestPointOnLine, getCoords, lineSlice} from "@turf/turf"

var trunc = n=>Number(n.toFixed(5))

function ends(array){
    var ret = [array[0],array[array.length-1]]
    ret.first = ret[0]
    ret.last = ret[1]
    return ret
}

var snap
const parser = new DOMParser()
var selectedJunctions

function createPathElements(snap){
    var path = snap.g().attr({id: "path"})
    snap.add(path)

    var edges = snap.g().attr({id: "edges"})
    var searchEdge = snap.g().attr({id: "search-edge"})
    var junctions = snap.g().attr({id: "junctions"})
    path.add(edges).add(searchEdge).add(junctions)

    var searchPath = snap.path().attr({id: "search-path", d: ""}).toDefs()
    var searchUseShadow = searchPath.use().attr({class: "blue-edge-shadow"})
    var searchUse = searchPath.use().attr({class: "blue-edge"})
    searchEdge.add(searchUseShadow).add(searchUse)

    return {edges, junctions, searchPath}
}

function getPathElements(snap){
    var edges = snap.select("#edges")
    var junctions = snap.select("#junctions")
    var searchPath = snap.select("#search-path")
    return {edges, junctions, searchPath}  
}

class EventTargetWithGlobalEventHandler extends EventTarget{
    constructor(){
        super()
    }
    get onevent(){
        return this.globalHandler
    }
    set onevent(func){
        this.removeEventListener("event", this.globalHandler)
        this.globalHandler = func
        this.addEventListener("event", this.globalHandler)
    }
}
var selectedPath = new EventTargetWithGlobalEventHandler()
function newPath(path){
    var event = new Event("event")
    event.pathSecret = path.reduce((path, junction)=>{
        var [,number] = junction.split('-')
        if(path == ""){
            return number
        }
        else{
            return `${path}-${number}`
        }
    },"")
    selectedPath.dispatchEvent(event)
}

function deletePath(){
    selectedJunctions = []
    var {edges, junctions, searchPath} = getPathElements(snap)
    edges.clear()
    junctions.clear()
    searchPath.attr({d: ""})
    newPath(selectedJunctions)
}

async function loadMap(mapContainer, mapData){
    var svg = parser.parseFromString(mapData.svg, "image/svg+xml").documentElement
    mapContainer.insertBefore(svg, mapContainer.firstChild)

    var junctionsElements = document.querySelectorAll("circle.junction")
    var data = new Map(mapData.data.map(element=>[element.properties.id, element]))

    selectedJunctions = []

    snap = Snap("#map-container > svg")
    var {edges, junctions, searchPath} = createPathElements(snap)

    function useEdge(id){
        edges.append(snap.use(id).attr({class: "blue-edge-shadow"}))
        edges.append(snap.use(id).attr({class: "blue-edge"}))
    }

    function createGeoJsonPoint(point, r){
        var [x, y] = getCoords(point)
        return snap.circle(trunc(x),trunc(y),r)
    }

    function useJunction(point){
        junctions.append(createGeoJsonPoint(point, 0.01).attr({class: "blue-junction"}))
    }

    function linestringPath(linestring) {
        var coors = linestring.geometry.coordinates
        var pathString = coors.reduce((acc, coor, index)=>{
            var pos = trunc(coor[0]) + ',' + trunc(coor[1])
            if(index==0){
                acc = 'M'+pos
            }
            else{
                acc += 'L'+pos
            }
            return acc
        },'')
        return pathString
    }

    function mousemove(event) {
        if(event.type == "touchmove"){
            event.preventDefault()
        }

        var [clientX, clientY] = [event.clientX || event.touches[0].clientX, event.clientY || event.touches[0].clientY]
        var {width, height, left, top} = svg.getBoundingClientRect()
        var [offsetX, offsetY] = [clientX - left, clientY - top]
        var cursor = point([offsetX/width, offsetY/height])

        var lastJunction = data.get(ends(selectedJunctions).last)
        var edges = lastJunction.properties.edges.map(id=>data.get(id)) 

        var distances = edges.map(edge=>{
            var point = nearestPointOnLine(edge, cursor, {units: 'degrees'})
            return {edge: edge, point, distance: distance(cursor, point,  {units: 'degrees'})}
        })
        distances = [...distances].sort( ({distance:a},{distance:b}) => a-b )
        var nearest = distances[0]
        var [lastX, lastY] = ends(nearest.edge.geometry.coordinates).last
        var [x, y] = getCoords(lastJunction)
        nearest.coordinates = [...nearest.edge.geometry.coordinates]
        if(lastX==x && lastY==y){
            nearest.coordinates = [...nearest.coordinates].reverse()
        }
        var slice = lineSlice(lastJunction, nearest.point, lineString(nearest.coordinates))
        var [X, Y] = ends(nearest.coordinates).last
        var [pointX, pointY] = nearest.point.geometry.coordinates

        if(X==pointX && Y==pointY){
            var otherJunctionId
            if(nearest.edge.properties.first != lastJunction.properties.id){
                otherJunctionId = nearest.edge.properties.first
            }
            else{
                otherJunctionId = nearest.edge.properties.last
            }
            selectedJunctions = selectedJunctions.concat([otherJunctionId])
            newPath(selectedJunctions)
            

            searchPath.attr({d: ""})
            useEdge(nearest.edge.properties.id)
            useJunction(data.get(otherJunctionId))
        }
        else{
            searchPath.attr({d: linestringPath(slice)})
        }
    }

    junctionsElements.forEach(junctionElement=>{
        function click(event){ 
            if(!(event.type == "touchstart" && event.touches.length == 2)){  
                const id = event.target.id
                if(selectedJunctions.length == 0){
                    selectedJunctions = [id]
                    newPath(selectedJunctions)
                    svg.addEventListener("mousemove", mousemove)
                    svg.addEventListener("touchmove", mousemove)
                    useJunction(data.get(id))
                }
                else if(ends(selectedJunctions).last == id){
                    svg.addEventListener("mousemove", mousemove)
                    svg.addEventListener("touchmove", mousemove)
                }
            }
        }
        junctionElement.addEventListener("mousedown", click)
        junctionElement.addEventListener("touchstart", click)
    })
    
    function lost(){
        svg.removeEventListener("mousemove", mousemove)
        svg.removeEventListener("touchmove", mousemove)
        searchPath.attr({d: ""})
    }
    svg.addEventListener("mouseup", lost)
    svg.addEventListener("touchend", lost)
    svg.addEventListener("mouseleave", lost)
    svg.addEventListener("touchcancel", lost)
}

export {loadMap, selectedPath, deletePath}