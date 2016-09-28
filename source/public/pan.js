var sv;
var map;
var initLat, initLng, maxLat, maxLng;
var graph = {};
var started = 0, finished = 0;

var partialSum = 0;
var positions = 0;

var rad = function(x) {
  return x * Math.PI / 180;
};
var getDistance = function(p1, p2) {
  var R = 6378137; // Earth’s mean radius in meter
  var dLat = rad(p2.lat - p1.lat);
  var dLong = rad(p2.lng - p1.lng);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(p1.lat)) * Math.cos(rad(p2.lat)) *
    Math.sin(dLong / 2) * Math.sin(dLong / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d; // returns the distance in meter
};

function initialize() {
    initLat = parseFloat(document.getElementById('initLat').value);
    initLng = parseFloat(document.getElementById('initLng').value);
    maxLat = parseFloat(document.getElementById('maxLat').value);
    maxLng = parseFloat(document.getElementById('maxLng').value);
    sv = new google.maps.StreetViewService();

    sv.getPanoramaByLocation({lat: initLat, lng: initLng}, 1, function(data) {
        if(data==null) console.log("non existing location");
        initMap({initLat: initLat, initLng: initLng, maxLat: maxLat, maxLng: maxLng});
        //start walking by the node beside me
        var link = data.links[0].pano;
        graph[link] = {id:link, lat:0, lng:0, links:[]};

        sv.getPanoramaById(link,function (data1){
          started++;
          processSVdata(data1, {prevPos: {lat: initLat, lng: initLng}, prevId: link});
        });
    });
}
function initMap(coords) {
  // Set up the map.
    map = new google.maps.Map(document.getElementById('map'), {
      center: {lat: initLat, lng: initLng},
      zoom: 16,
      streetViewControl: false
    });
  //draw polygon
    var minLat = 2*coords.initLat-coords.maxLat;
    var minLng = 2*coords.initLng-coords.maxLng;
    var polygon = new google.maps.Polygon({
      paths: [{lat:minLat ,lng: minLng},{lat: minLat,lng: maxLng},{lat: maxLat,lng: maxLng},{lat: maxLat, lng: minLng}],
      strokeColor: '#8F05C2',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#8F05C2',
      fillOpacity: 0.35
    });
    polygon.setMap(map);
}

function processSVdata(data, args){
  var la=data.location.latLng.lat();
  var ln=data.location.latLng.lng();
  console.log(la+" "+ln);
    if(la < maxLat && ln < maxLng && la > 2*initLat-maxLat && ln > 2*initLng-maxLng ){ //if in bounds
      save(args.prevId); //save it
      console.log(args.prevId);
      //visualize marker
      var marker = new google.maps.Marker({
        position: data.location.latLng,
        map: map,
        title: data.location.description
      });
      //set coordinates
      graph[args.prevId].lat = la;
      graph[args.prevId].lng = ln;
      //set links
      var links = data.links;
      for (var link of links) {
        var id = link["pano"];
          //add link
          if(!graph.hasOwnProperty(id)){
            //new panorama
              graph[id] = {id:id, lat:0, lng:0, links:[graph[args.prevId]]};
              graph[args.prevId].links.push(graph[id]);
              partialSum += getDistance({lat: la, lng: ln}, args.prevPos);
              positions++;
              started++;
              //walking
              function getP(iD){
                sv.getPanoramaById(iD, function (data){
                  processSVdata(data, {prevPos: {lat: la, lng: ln}, prevId: iD});
                });
              } getP(id);

          }else if(!graph[id].links.includes(graph[args.prevId])){
              graph[id].links.push(graph[args.prevId]);
              graph[args.prevId].links.push(graph[id]);
          }
      }
    }

    if(started == ++finished) {
      console.log("finished finding positions");
      console.log("medium : "+(partialSum/positions));
      reqGraph();
    }

}

function save(id){
  xhr = new XMLHttpRequest();
  var url = "/";
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json");

  var data = JSON.stringify({"id" : id});
  xhr.send(data);
}
function reqGraph(){
  var xhr = new XMLHttpRequest();
  var url = "/";
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json");

  var string = "";
  //serializeToString graph[id] = {lat:0, lng:0, links:[graph[args.prevId]]};
  string+='<?xml version=\"1.0\" encoding=\"iso-8859-1\"?>';
  for(id in graph){
    if(graph[id].lat!=0){    //if it is in the bounds
      var links = "";
      for(var link of graph[id].links){
        if(link.lat!=0)
          links += '      <link>'+ link.id +'</link>\n';
      }
      string += ''+
      '<node>\n'+
      '   <id>'+id+'</id>\n'+
      '   <lat>'+graph[id].lat+'</lat>\n'+
      '   <lng>'+graph[id].lng+'</lng>\n'+
      '   <links>\n'+
            links+
      '   </links>\n'+
      '</node>\n';
    }
  }

  var data = JSON.stringify({graph:string});
  xhr.send(data);
}
