var InlineReply = {

	init: function() {
		$('a[href^="reply?"]').click(function(e) {
			e.preventDefault();
			$(this).hide();
			link = 'http://news.ycombinator.com/' + $(this).attr('href');
			$(this).after(
				'<div class="replyform" style="width:300px;height:100px;position:relative;"> \
				<textarea rows="4" cols="60" style="height:60px;" /> \
				<input type ="submit" value="Reply" class="rbutton" \
				 style="position:absolute;bottom:0px;left:0px;" /> \
				</div>'
			);
			$(this).parent().find('.rbutton').attr('data', link);
		});

		$('.rbutton').live('click', function(e) {
			e.preventDefault();
			link = $(this).attr('data');
			text = $(this).prev().val();
			InlineReply.postCommentTo(link, text, $(this));
		});
	},

	postCommentTo: function(link, text, button) {
		InlineReply.disableButtonAndBox(button);
		$.ajax({
			accepts: "text/html",
			url : link
		}).success(function(html) {
			input = $(html).find('input');
			fnid = input.attr('value');
			InlineReply.sendComment(fnid, text);
		}).error(function(xhr, status, error) {
			InlineReply.enableButtonAndBox(button);
		});
	},

	sendComment: function(fnidarg, textarg) {
		$.post(
			"http://news.ycombinator.com/r", 
			{fnid : fnidarg, text: textarg }
		).complete(function(a) {
			window.location.reload(true);
		});	
	},

	disableButtonAndBox: function(button) {
		button.attr('disabled','disabled');
		button.prev().attr('disabled', 'disabled');
	},

	enableButtonAndBox: function(button) {
		button.removeAttr('disabled');
		button.prev().removeAttr('disabled');
	}
}

InlineReply.init();
