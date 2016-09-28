var express = require('express')
   ,load = require("google-panorama-equirectangular")
   ,fs = require("fs")
   ,Canvas = require("canvas")
   ,c1 = { free : true, canvas : new Canvas()}
   ,c2 = { free : true, canvas : new Canvas()}
   ,queue = []
   ,bodyParser = require('body-parser')
   ,app = express()

app.use(express.static(__dirname + '/public'));
app.use( bodyParser.json() );
var incoming = 0, processed = 1;

//accept id post
app.post('/', function(request, response){
  if(!request.body.graph){
    var id = request.body.id;
    console.log("Request for saving: "+id);
    incoming++;
    if(c1.free){
      save(id, c1);
    }else if(c2.free){
      save(id, c2);
    }else{
      queue.push(id);
    }
  }else{
    //has finished making requests
    console.log("Requests finished, saving xml map");
    var graph = request.body.graph;
    saveGraph(graph, request.body.location);
  }
  response.send('POST received');  //close connection
});

app.listen(8080, function () {
  console.log('Server listening on port 8080');
});

//save images
function save(panoID, c){
  c.free = false;
  var canvas = c.canvas;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

  load(panoID, { zoom: 4, canvas : canvas, crossOrigin: "anonymous" })
  .on('complete', function(canvas){
    var out = fs.createWriteStream(__dirname + '/'+ panoID +'.jpg')
      ,stream = canvas.jpegStream({bufsize: 1024, quality: 100, progressive: false });

    stream.on('data', function(chunk){
      out.write(chunk);
    });
    stream.on('end', function(){
      processed++;
      var points = " ";
      for(var i=0; i<40 ; i++){
        if(i<processed/incoming*40)
          points+='#';
        else points+='.';
      }
      console.log('saved'+points+' '+ Math.round(processed/incoming*100).toString() + '% ('+processed+'/'+incoming+')');
      //call next id
      var e = queue.shift();
      if(e)
        save(e, c);
      c.free = true;
    });
  })
}
function saveGraph(obj){
  fs.writeFile(__dirname + '/map.xml', obj, function(err) {
    if(err) {
        return console.log(err);
    }
});
}
