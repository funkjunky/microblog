var express = require('express');
var cons = require('consolidate');
var app = express();
var mongo = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

//Middle-Ware
app.use(express.logger());
app.use(express.bodyParser());

//Laziness
//TODO: put this somewhere else...
var dbh;
mongo.connect("mongodb://localhost:27017/microblog", function(err, db) {
	if(!err) {
		console.log("Connected to Mongo");
		dbh = db; //this is probably terrible
	} else {
		console.log("MONGO CONNECTION FAILED");
		console.log(err);
	}
});

app.get('/', function(req, res) {
	res.redirect(302, '/all');
});

/**
 * Front end routes(get): all, date/<year>/<month>, tag/<tag>, search/<term>
 */
app.get('/all', function(req, res) {
	dbh.collection('articles').find().toArray(function(err, articles) {
		console.log(articles);
		var params = {filter: "All", articles: articles};
		console.log(params);
		cons.mustache('views/filtered_articles.html', params, function(err, html) {
			if(err) throw err;
			res.send(html);
		});	
	});
});
/***
 ***/

/**
 * front end admin routes(get): admin/create, admin/edit
 */
app.get('/admin/create', function(req, res) {
	cons.mustache('views/edit_article.html', {operation: 'create'}, function(err, html) {
		if(err) throw err;
		res.send(html);
	});
});

app.get('/admin/edit/:title', function(req, res) {
	console.log(req.params.title);
	dbh.collection('articles').findOne({title: req.params.title}, {},
		function(err, article) {
			console.log(article);
			cons.mustache('views/edit_article.html',
				{
					operation: 'edit',
					_id: article._id,
					created: article.created,
					title: article.title,
					body: article.body,
					tags: article.tags.join(",")
				},
				function(err, html) {
					if(err) throw err;
					res.send(html);
				}
			);
		}
	);
});
/***
 ***/

/**
 * Back end data routes(post): data/create, data/edit, data/delete
 */
app.post('/data/create', function(req, res) {
	console.log("data request: /data/create");
	console.log(req.body);

	var collection = dbh.collection("articles");
	var doc = {
		title: req.body.title,
		body: req.body.body,
		created: Math.floor(Date.now() / 1000),
		modified: Math.floor(Date.now() / 1000),
		tags: req.body.tags.split(",")
	};
	collection.insert(doc, {w: 0});

	res.redirect(302, "/admin/create"); 
});

app.post('/data/edit', function(req, res) {
	console.log("data request: /data/edit");
	console.log(req.body);

	var collection = dbh.collection("articles");
	var doc = {
		title: req.body.title,
		body: req.body.body,
		modified: Math.floor(Date.now() / 1000),
		created: req.body.created,
		tags: req.body.tags.split(",")
	};
	console.log(req.body._id);
	collection.update({_id: new ObjectID(req.body._id)}, doc, {}, function(err, res) {
		console.log(err);
		console.log(res);
	});

	res.send("done.");
	//res.redirect(302, "/admin/edit/"+req.body.title); 
});
/***
 ***/

app.get

var port = 3000;
app.listen(port);
console.log("Listening on port " + port);
