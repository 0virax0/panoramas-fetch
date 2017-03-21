var sv;
var map;
var markers = [], poly;
var initLat, initLng;
var graph = {};
var started = 0, finished = 0;

var partialSum = 0;
var positions = 0;

var getDistance = function(p1, p2) {
  var rad = function(x) { return x * Math.PI / 180; };
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
  //subscribe to update-stream
  updates();
  //use barycenter as 1st position
    initLat = markers[0].getPosition().lat() + markers[1].getPosition().lat() + markers[2].getPosition().lat() + markers[3].getPosition().lat();
    initLat /= 4;
    initLng = markers[0].getPosition().lng() + markers[1].getPosition().lng() + markers[2].getPosition().lng() + markers[3].getPosition().lng();
    initLng /= 4;
    sv = new google.maps.StreetViewService();

//get panorama in 50m radious
    sv.getPanorama({location: {lat: initLat, lng: initLng}, radius:50}, function(data) {
        if(data==null) console.log("non existing location");
        //start walking by the node beside me
        var link = data.links[0].pano;
        graph[link] = {id:link, lat:0, lng:0, links:[]};

        sv.getPanoramaById(link,function (data1){
          started++;
          processSVdata(data1, {prevPos: {lat: initLat, lng: initLng}, prevId: link});
        });
    });
}

function initMap() {
  // Set up the map
   map = new google.maps.Map(document.getElementById('map'), {
      center: {lat: 45.551985, lng: 11.554968},
      zoom: 16,
      streetViewControl: false
    });
    //move map controls
    var Download = document.getElementById("Download");
    map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(Download);
    var Clear = document.getElementById("Clear");
    map.controls[google.maps.ControlPosition.BOTTOM_RIGHT].push(Clear);
    var input = document.getElementById("search-bar");
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
    //search box
    var searchBox = new google.maps.places.SearchBox(input);
    //new place listener
    searchBox.addListener('places_changed', function() {
      var places = searchBox.getPlaces();
      var bounds = new google.maps.LatLngBounds();
      bounds.extend(places[0].geometry.location);
      map.fitBounds(bounds);
    });
    //addMarkers on click
    google.maps.event.addListener(map, "click", function(event){
      if(markers.length >= 4) return;
      var pinColor =  "0066cc";
      var pinImage = new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|" + pinColor, new google.maps.Size(21, 34), new google.maps.Point(0,0), new google.maps.Point(10, 34));
      var marker = new google.maps.Marker({
        position : event.latLng,
        map : map,
        icon : pinImage,
      });
      markers.push(marker);
      //draw the polygon
      if(markers.length >= 4){
        reorder();  //reorder markers
        poly = new google.maps.Polygon({
          paths : [markers[0].getPosition(), markers[1].getPosition(), markers[2].getPosition(), markers[3].getPosition()],
          strokeColor : "FF0000",
          strokeOpacity : 0.8,
          strokeWeight : 2,
          fillColor: '#FF0000',
          fillOpacity: 0.35
        });
        poly.setMap(map);
      }
    });
}
function clearMarkers(){
  for(var i=0; i<markers.length; i++ ){
    markers[i].setMap(null);
  }
  markers = [];
  poly.setMap(null);
  poly = null;
}
function reorder(){
  var swap = function(n1, n2){
    var tmp = markers[n1];
    markers[n1] = markers[n2];
    markers[n2] = tmp;
  }
  //reorder by x
  var run = true;
  while(run){
    run = false;
      for(var i=0; i<3; i++)
      if(markers[i].getPosition().lat() > markers[i+1].getPosition().lat()){
        run = true;
        swap(i, i+1);
      }
  }
  //reorder by y
  if(markers[0].getPosition().lng() > markers[1].getPosition().lng())
    swap(0, 1);
  if(markers[2].getPosition().lng() < markers[3].getPosition().lng())
    swap(2, 3);

}

function processSVdata(data, args){
  var la=data.location.latLng.lat();
  var ln=data.location.latLng.lng();
  console.log(la+" "+ln);
  var bounds = function(){
//find out where i lie
     var arr = [];
     for(var i=0; i<4; i++){
       var succ = (i==3) ? 0 : i+1;
       var x1 = markers[i].getPosition().lat();
       var x2 = markers[succ].getPosition().lat();
       if((la < x1 && la > x2)||(la > x1 && la < x2))
         arr.push({x1: markers[i].getPosition().lat(), y1: markers[i].getPosition().lng(),
           x2: markers[succ].getPosition().lat(), y2: markers[succ].getPosition().lng() });
     }
     if(arr.length<2) return false;
     var y1 = (arr[0].y2 - arr[0].y1) / (arr[0].x2 - arr[0].x1) * (la - arr[0].x1) + arr[0].y1;
     var y2 = (arr[1].y2 - arr[1].y1) / (arr[1].x2 - arr[1].x1) * (la - arr[1].x1) + arr[1].y1;

     return ((ln < y1 && ln > y2)||(ln > y1 && ln < y2)) ? true : false;
  }
    if(bounds()){ //if in bounds
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
      console.log("finished finding positions :" + finished);
      console.log("medium : "+(partialSum/positions));
      reqGraph();
    }

}

function save(id){
  xhr = new XMLHttpRequest();
  var url = "http://127.0.0.1:8080/";
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json");

  var data = JSON.stringify({"id" : id});
  xhr.send(data);
}
function reqGraph(){
  var xhr = new XMLHttpRequest();
  var url = "http://127.0.0.1:8080/";
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
function updates(){
  var source = new EventSource('http://127.0.0.1:8080/update-stream');
  source.addEventListener('message', function(e){
    var bar = document.getElementById('progress-bar').style.width = e.data + '%';
    if(e.data == 100) document.getElementById('progress-bar').style['background-color'] = '#CCECFF';
    console.log("event received: "+e.data);
  },false);
}
