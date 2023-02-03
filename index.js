const port = 8080; //process.env.PORT || 8080;

const express = require('express');
const bodyParser = require('body-parser')
const app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.use(express.static(__dirname + '/public'));

app.get('/', function(request, response) {
    console.log(request.path);
  response.sendFile(__dirname+'/public/html/index.html');
  console.log(request.originalUrl);
});
app.get('/login', function(request, response) {
    console.log(request.path);
    response.sendFile(__dirname+'/public/html/index.html');
});
app.get('/signup', function(request, response) {
    console.log(request.path);
    response.sendFile(__dirname+'/public/html/signup.html');
});
app.get('/@all', function(request, response) {
    console.log(request.path);
    response.sendFile(__dirname+'/public/html/app.html');
});
app.get('/amped', function(request, response) {
    console.log(request.path);
    response.sendFile(__dirname+'/public/html/app.html');
});
app.get('/loud', function(request, response) {
    console.log(request.path);
    response.sendFile(__dirname+'/public/html/app.html');
});
app.get('/demo', function(request, response) {
    console.log(request.path);
    response.sendFile(__dirname+'/public/html/demo.html');
});

app.get('*', function(request, response) {
    console.log(request.path);
    if (request.path.indexOf("@") !== -1) {
      // pathname contains "@" symbol
      response.sendFile(__dirname+'/public/html/app.html');
    }
    else {
        response.sendFile(__dirname+'/public/html/index.html');
    }
  });

const listener = app.listen(port, function() {
  console.log('Your app is listening on port '+ port);
});