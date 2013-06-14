var express = require('express');
var cons = require('consolidate');
var app = express();
var mongo = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var fs = require('fs');

//Middle-Ware
app.use(express.logger());
app.use("/js", express.static(__dirname + '/js'));
app.use("/css", express.static(__dirname + '/css'));
app.use("/views", express.static(__dirname + '/views'));
//this is bad... I need to set this up properly...
app.use("/bootstrap", express.static(__dirname + '/bootstrap'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret: '234523543g4gefderg'}));
app.use(app.router);
app.use(function(err, req, res, next) {
	console.error(err.stack);
	res.send(500, 'something broke!');
});

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
 * Front end routes(get): article/:title, all, date/<year>/<month>, tag/<tag>, search/<term>
 */
app.get('/article/:title', function(req, res) {
	dbh.collection('articles').findOne({title: req.params.title}, {}, function(err, article) {
		if(!article)
			return res.send(500, "ARTICLE DOESNT EXIST");
		send_templated_response('full_article', article.title, article, res);
	});
});

app.get('/all', function(req, res) {
	send_filtered_response({}, "All Articles", req, res);
});

app.get('/tag/:tag', function(req, res) {
	console.log("tag: " + req.params.tag);
	var filter = {tags: req.params.tag};
	var pagetitle = "Articles with the tag '" + req.params.tag + "'";
	send_filtered_response(filter, pagetitle, req, res);
});

app.get('/date/:year/:month', function(req, res) {
	var filter;
	if(!req.params.month)
		filter = {created: {
			$gt: new Date("01/01/"+req.params.year),
			$lt: new Date("01/01/"+(req.params.year+1))
		}};
	else
		filter = {created: {
			$gt: new Date("01/"+req.params.month+"/"+req.params.year),
			$lt: new Date("01/"+(req.params.month+1)+"/"+req.params.year)
		}};

	var pagetitle = "Articles from " + req.params.year;
	if(req.params.month)
		title = req.params.month + "/" + title;

	send_filtered_response(filter, pagetitle, req, res);
});

app.get('/search/:term', function(req, res) {
	var filter = { $or: [
		{ title: new RegExp(".*"+req.params.term+".*", "i") },
		{ body: new RegExp(".*"+req.params.term+".*", "i") },
		{ tags: new RegExp(".*"+req.params.term+".*", "i") },
	]};
	var pagetitle = "Articles that contain '" + req.params.term + "'";

	send_filtered_response(filter, pagetitle, req, res);
});
/***
 ***/

/**
 * front end admin routes(get): admin/create, admin/edit
 */
app.get('/admin/create', function(req, res) {
	verify_loggedin(req, res);
	send_templated_response('edit_article', "Create New Article", {operation: 'create'}, res);
});

app.get('/admin/edit/:title', function(req, res) {
	verify_loggedin(req, res);
	dbh.collection('articles').findOne({title: req.params.title}, {},
		function(err, article) {
			article.operation = 'edit';
			article.tags = article.tags.join(",");
			send_templated_response('edit_article', "Edit: " + req.params.title, article, res);
		}
	);
});
/***
 ***/

/**
 * Back end data routes(post): data/replace, data/delete, data/comment
 */
app.post('/data/replace', function(req, res) {
	var collection = dbh.collection("articles");
	req.body.tags = req.body.tags.split(",");
	var _id = new ObjectID();
	if(req.body._id && req.body._id != '') {
		_id = new ObjectID(req.body._id);
		req.body.modified = new Date();
	} else
		req.body.created = new Date();

	delete req.body._id; //we don't want to add or edit the _id field... let mongo do that.

	collection.update({_id: _id}, {$set: req.body}, {w: 0, upsert: true});

	res.redirect(302, "/article/"+req.body.title); 
});

app.post('/data/delete', function(req, res) {
	console.log("data request: /data/delete");
	console.log(req.body);

	var collection = dbh.collection("articles");
	collection.remove({_id: new ObjectID(req.body._id)}, {w:0});

	res.redirect(302, "/");
});

app.post('/data/comment', function(req, res) {
	console.log("data request: /data/comment");
	console.log(req.body);

	var collection = dbh.collection("articles");
	collection.update(
		{_id: new ObjectID(req.body._id)},
		{$push: {comments: {author: req.body.author, body: req.body.body}}},
		{w:0}
	);
	res.redirect(302, req.body.redirect);
});
/***
 ***/

/**
 * Security Routes
 */
app.get('/admin/login', function(req, res) {
	send_templated_response("login", "Login to use the admin pages", {}, res);
});

app.post('/security/login', function(req, res) {
	if(check_credentials(req.body.name, req.body.pass))
	{
		req.session.loggedin = true;
		res.redirect(302, '/');
	} else {
		res.redirect(302, '/admin/login');
	}
});
/***
 ***/

var port = process.env.PORT || 3000;
app.listen(port, function() {
	console.log("Listening on port " + port);
});

//Convinience function... I don't know if this is the way it should be done.
function send_filtered_response(filter, pagetitle, req, res)
{
	dbh.collection('articles').find(filter).toArray(function(err, articles) {
		console.log(articles);
		//get all the tags
		var tags = [];
		for(var i=0; i != articles.length; ++i)
			tags.push.apply(tags, articles[i].tags); //this won't work if an article ever doesn't have a tag.
		//
		var params = {articles: articles, tags: unique_sort(tags), partials: { summed_article: 'summed_article' }};
		if(req.session.loggedin) params.loggedin = true;
		send_templated_response('filtered_articles', pagetitle, params, res);
	});
}

function send_templated_response(viewfile, title, params, res)
{
	params.pagetitle = title;
	if(!params.partials)
		params.partials = {};
	params.partials.page = viewfile;
	cons.mustache('views/layout.html', params, function(err, html) {
		if(err) throw err;
		res.send(html);
	});
}

function check_credentials(user, pass)
{
	var creds = JSON.parse(fs.readFileSync("credentials", 'utf8'));
	return (user == creds.user && pass == creds.pass);
}

function verify_loggedin(req, res)
{
	if(!req.session.loggedin)
		return res.send("You must be logged in to view admin items...");
}

function unique_sort(arr)
{
	arr.sort();
	for(var i=0; i<=arr.length - 1; ++i)
		if(arr[i] == arr[i+1])
			arr.splice(--i+2, 1); //i decrement, but otherwise remove the ite,... meh...

	return arr;
}
