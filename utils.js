import osmtogeojson from "osmtogeojson"
import {mergeViableLineStrings} from "/geojson-linestring-dissolve.js"
import {lineString, union as turfUnion, flatten, tesselate, explode, feature, getGeom, multiPolygon as turfMultiPolygon, bboxClip, bboxPolygon, booleanPointInPolygon} from "@turf/turf"

var trunc = n=>Number(n.toFixed(5))
var size = 1.5
var unit = {unit:"kilometers"}

function ends(array){
  var ret = [array[0],array[array.length-1]]
  ret.first = ret[0]
  ret.last = ret[1]
  return ret
}

var genId = ()=>{
  var array = new Uint8Array(5)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode.apply(null, array)).slice(0,-1).replace(/\//g,'_').replace(/\+/g,'-');
}

function separate(arr, f){
  return arr.reduce(([good, bad], element)=>{
    if(f(element)){
      good = good.concat([element])
    }
    else{
      bad = bad.concat([element])
    }
    return [good, bad]
  }, [[],[]])
}

function mergeLinestrings(features){
  return flatten(feature(mergeViableLineStrings(features.map(feature=>getGeom(feature))))).features
}

function multiPolygon(polygons){
  return turfMultiPolygon(polygons.map(polygon=>polygon.geometry.coordinates))
}

function osmToGeoJSON(data){
  return osmtogeojson({elements:data}).features
}

function splitLineWithPoint(line, point){
  var pointString = point.geometry.coordinates.toString()
  var lineCoords = line.geometry.coordinates
  var index = lineCoords.findIndex(coord=>coord.toString()==pointString)
  if(index>0 && index<lineCoords.length-1){
    var line1 = lineString(lineCoords.slice(0, index+1))
    var line2 = lineString(lineCoords.slice(index))
    line1 = Object.assign(line1, {properties: line.properties})
    line2 = Object.assign(line2, {properties: line.properties})
    return [line1, line2]
  }
  else{
    return [line]
  }
}

function unique(arr){
  return Array.from(new Set(arr))
}

function flatArea(polygon){
  return tesselate(polygon).features.reduce((area, triangle)=>{
    var [a,b,c] = triangle.geometry.coordinates[0]
    var [A, B, C] = [[a,b],[b,c],[c,a]].map(([[x1,y1],[x2,y2]])=>Math.sqrt((x1-x2)**2 + (y1-y2)**2))
    var s = (A + B + C) / 2
    return area + Math.sqrt(s*(s-A)*(s-B)*(s-C))
  }, 0)
}

function union(elements){
  if(elements.length!=0){
    return flatten(turfUnion(...elements)).features
  }
  else{
    return []
  }
}

function polygonInPolygon(polygon, boundingPolygon){
  return explode(polygon).features.every(point=>booleanPointInPolygon(point, boundingPolygon))
}

function smarterUnion(elements){
  var size = 16
  var cells = [...Array(size).keys()].map(x=>[...Array(size).keys()].map(y=>{
    var unit = 1/size
    var row = x*unit
    var col = y*unit
    return [row, col, row+unit, col+unit]
  }))
  var insideElemets = cells.map(row=>row.map(cell=>{
    var polygons = union(elements.filter(element=>bboxClip(element,cell).geometry.coordinates.length!=0))
    cell = bboxPolygon(cell)
    var [done, rest] = separate(polygons, polygon=>polygonInPolygon(polygon, cell)) 
    return {cell, done, rest}
  }))

  function recUnion(cells){
    function res(topLeft, topRight, downLeft, downRight){
      var cell = union([topLeft.cell, topRight.cell, downLeft.cell, downRight.cell])[0]
      var polygons = union(topLeft.rest.concat(topRight.rest, downLeft.rest, downRight.rest))
      var [done, rest] = separate(polygons, polygon=>polygonInPolygon(polygon, cell))
      done = done.concat(topLeft.done,topRight.done, downLeft.done, downRight.done)
      return {cell, done, rest}
    }
    if(cells.length==1){
      return cells[0][0]
    }
    else{
      var [top, down] = [cells.slice(0, cells.length/2), cells.slice(cells.length/2)]
      var [topLeft, topRight] = top.reduce(([left, right],row)=>[left.concat([row.slice(0, row.length/2)]), right.concat([row.slice(row.length/2)])],[[],[]])
      var [downLeft, downRight] = down.reduce(([left, right],row)=>[left.concat([row.slice(0, row.length/2)]), right.concat([row.slice(row.length/2)])],[[],[]])
      return res(recUnion(topLeft), recUnion(topRight), recUnion(downLeft), recUnion(downRight))
    }
  }

  var {done, rest} = recUnion(insideElemets)
  return done.concat(rest)
}

export {
  trunc,
  size,
  unit,
  ends,
  separate, 
  unique,
  mergeLinestrings,
  multiPolygon,
  osmToGeoJSON,
  splitLineWithPoint,
  flatArea,
  genId,
  union,
  smarterUnion
}