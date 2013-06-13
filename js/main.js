$(function() {
	$("#search").submit(function() {
		window.location = "/search/"+$(this).find(">[type=text]").val();
		return false;
	});
});
