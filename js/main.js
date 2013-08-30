$(function() {
	if(Markdown) {
		var converter = new Markdown.Converter();
		var editor = new Markdown.Editor(converter);
		editor.run();
	}

	//for the textbox search
	$("#search").submit(function() {
		window.location = "/search/"+$(this).find(">[type=text]").val();
		return false;
	});
});
