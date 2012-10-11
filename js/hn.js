/*
* Hacker News Enhancement Suite (HNES)
* Chris James / etcet.net / chris@etcet.net
*
* Thanks to both Wayne Larson and jarques for their code
*
* HN+ for Chrome v1.5 - https://github.com/jarquesp/Hacker-News--
*   by @jarques
*
* hckrnews.com extension - http://hckrnews.com/about.html
*   by Wayne Larson (wvl)
*
* Thanks to Samuel Stern for the inline replying
*
* Under MIT license, see LICENSE
*/

var InlineReply = {
  init: function() {
    $('a[href^="reply?"]').click(function(e) {
      e.preventDefault();

      //make sure there's no stray underlining between Reply and Cancel
      $(this).addClass('underlined');
      $(this).parent('u').replaceWith($(this));

      /*remove the 'reply' link without actually hide()ing it because it
        doesn't work that way with collapsible comments*/
      $(this).addClass('no-font-size');

      domain = window.location.origin;
      link = domain + '/' + $(this).attr('href');

      if ($(this).next().hasClass('replyform')) {
        $(this).next().show();
      }
      else {
        //add buttons and box
        $(this).after(
          '<div class="reply_form"> \
          <textarea rows="4" cols="60"/> \
          <input type="submit" value="Reply" class="rbutton"/> \
          <input type="submit" value="Cancel" class="cbutton"/> \
          </div>'
        );
        $(this).parent().find('.rbutton').attr('data', link);
      }
    });

    $('.rbutton').live('click', function(e) {
      e.preventDefault();
      link = $(this).attr('data');
      text = $(this).prev().val();
      InlineReply.postCommentTo(link, domain, text, $(this));
    });
    
    $('.cbutton').live('click', function(e) {
      InlineReply.hideButtonAndBox($(this).prev());
    });
  },

  postCommentTo: function(link, domain, text, button) {
    InlineReply.disableButtonAndBox(button);
    $.ajax({
      accepts: "text/html",
      url: link
    }).success(function(html) {
      input = $(html).find('input');
      fnid = input.attr('value');
      InlineReply.sendComment(domain, fnid, text);
    }).error(function(xhr, status, error) {
      InlineReply.enableButtonAndBox(button);
    });
  },

  sendComment: function(domain, fnidarg, textarg) {
    $.post(
      domain + "/r", 
      {fnid : fnidarg, text: textarg }
    ).complete(function(a) {
      window.location.reload(true);
    }); 
  },

  disableButtonAndBox: function(button) {
    button.attr('disabled', 'disabled');
    button.next().attr('disabled', 'disabled');
    button.prev().attr('disabled', 'disabled');
  },

  enableButtonAndBox: function(button) {
    button.removeAttr('disabled');
    button.next().removeAttr('disabled');
    button.prev().removeAttr('disabled');
  },
  
  hideButtonAndBox: function(button) {
    button.parent().prev().removeClass('no-font-size');
    button.parent().hide();
  }
}


var CommentTracker = {
  init: function() {
    var page_info = CommentTracker.getInfo();
    HN.getLocalStorage(page_info.id, function(response) {
      var data = response.data;
      var prev_last_id = CommentTracker.process(data, page_info);
      CommentTracker.highlightNewComments(prev_last_id);
      console.log("commentracker: ", page_info, prev_last_id);
    });
  },

  highlightNewComments: function(last_id) {
    $('.comment-table').each(function() {
      if ($(this).attr('id') > last_id) {
       $(this).find('td:eq(0)').css('border-right', '2px solid #f60'); 
      }
    });
  },

  getInfo: function() {
    var comment_info_el;
    var no_comments = $('.subtext a:contains(discuss)');
    if (no_comments.length)
      comment_info_el = no_comments;
    else
      comment_info_el = $('.subtext a:contains(comment)');

    //if there is no 'discuss' or 'n comment(s)' link it's some other kind of page (e.g. profile)
    if (comment_info_el.length == 0)
      return {"id": window.location.pathname + window.location.search,
              "num": 0,
              "last_comment_id": CommentTracker.getLastCommentId()
              }

    var page_id = comment_info_el.attr('href').match(/id=(\d+)/);
    if (page_id.length) 
      page_id = Number(page_id[1]);
    else {
      page_id = window.location.search.match(/id=(\d+)/);
      console.error('NO PAGEID', page_id);
    }

    var comment_num = comment_info_el.text().match(/(\d+) comment/);
    if (comment_num)
      comment_num = Number(comment_num[1]);

    var last_id = CommentTracker.getLastCommentId();
    return {"id": page_id, "num": comment_num, "last_comment_id": last_id}
  },

  getLastCommentId: function() {
    var ids = new Array();
    var comments = $('.comment-table');

    //don't include 'More' link if it's there
    if ($('#more').length)
      comments = comments.slice(0, -1);

    comments.each(function() {
      var id = $(this).attr('id');
      ids.push(Number(id));
    });

    return ids.sort(function(a,b){return b-a})[0];
  },

  process: function(data, request) {
    var new_info = {
      id: request.id,
      expire: new Date().getTime() + 432000000
    }
    var info = data ? JSON.parse(data) : new_info;

    if (request.num) { info.num = request.num; }

    var last_comment_id = info.last_comment_id;
    if (request.last_comment_id)
      info.last_comment_id = request.last_comment_id;

    // store info
    HN.setLocalStorage(request.id, JSON.stringify(info));

    return last_comment_id;
  },

  checkIndexPage: function() {
    $('.comments').each(function() {
      var href = $(this).attr('href');
      if (href) {
        var id = Number($(this).attr('href').match(/id=(\d+)/)[1]);
        var el = $(this);
        HN.getLocalStorage(id, function(response) {
          if (response.data) {
            var data = JSON.parse(response.data);
            var num = Number(el.text());

            var diff = num - data.num;
            if (diff > 0) {
              var newcomm = $('<span/>').addClass('newcomments')
                                        .attr('title', 'New Comments')
                                        .text(diff + ' / ');
              var totalcomm = $('<span/>').text(el.text())
                                          .addClass('totalcomments')
                                          .attr('title', 'Total Comments');
              el.empty();
              el.append(newcomm)
                .append(totalcomm);
            }
          }
        });
      }
    });
  }
}


var RedditComments = {
  init: function(comments) {
    var collapse_button = $('<span/>').addClass('collapse')
                                      .text('[−]')
                                      .attr('title', 'Collapse comment');
    var link_to_parent = $('<span/>').text(' | ')
                                     .append($('<a/>')
                                     .attr('href', '#')
                                     .text('parent')
                                     .attr('title', 'Go to parent')
                                     .addClass('parent-link'));

    comments.find('table').each(function() {
      var $this = $(this);
      $this.addClass("comment-table");

      //get and store indentation
      var level = Math.floor($this.find('img')[0].width / 40);
      $this.attr('level', level);

      //create default collapsing markup
      var comhead = $("span.comhead", this);
      comhead.prepend(
        collapse_button.clone().click(RedditComments.collapse)
      );
      comhead.parent().removeAttr('style');

      //add link to parent if the comment has any indentation
      if (level > 0) 
        comhead.append(
          link_to_parent.clone().click(RedditComments.goToParent)
        );
     
      //add id attr to comment
      var id = $("a[href*=item]", comhead);
      if (!id.length) return true;
      id = id[0].href;
      id = id.substr(id.indexOf("=") + 1);
      $this.attr("id", id);

      //move reply link outside of comment span if it's in there
      //very weird formatting in hn's part
      var reply_link_in_comment = $this.find('.comment font[size="1"]');
      if (reply_link_in_comment) {
        var comment_span = reply_link_in_comment.parent().parent();
        comment_span.after(reply_link_in_comment.parent());
      }

      //remove extra spacing after 'dead' comments due to missing 'reply'
      var comment_is_dead = $this.find('.dead');
      if (comment_is_dead) {
        comment_is_dead.parent().next().remove();
      }
    });
  },

  goToParent: function(e) {
    var link_to_parent = $(this).find('a');
    if (link_to_parent.attr('href').length > 1)
      return;

    var el = $(this).closest("table");
    var level = el.attr('level');
    var prev_level = level;
    var comment_row = el.parent().parent();
    while (level <= prev_level) {
      var prev_row = comment_row.prev();
      prev_level = prev_row.find('.comment-table').attr('level');
      comment_row = prev_row;
    }
    var parent_id = Number(comment_row.find('table').attr('id'));
    link_to_parent.attr('href', '#' + parent_id);
  },

  stripPx: function(str) {
    return Number(str.substring(0, str.length - 2));
  },

  collapse: function(e) {
    var $e = $(e.target);
    var el = $e.closest("table");
    var comment_row = el.parent().parent();
    var indent = Number(el.attr('level'));
    //var indent = RedditComments.stripPx(comment_row.find('td:eq(1) img').css('width'));

    var has_children = false;
    var has_visible_children = false;
    var next_row = comment_row.next();
    var next_indent = Number(next_row.find('.comment-table').attr('level'));
    //var next_indent = RedditComments.stripPx(next_row.find('td:eq(1) img').css('width'));
    if (indent < next_indent) {
      has_children = true;
      has_visible_children = next_row.is(":visible");
    }

    var num_children = 0;
    if (has_children) {
      do {
        var next_row = comment_row.next();
        var next_indent = Number(next_row.find('.comment-table').attr('level'));
        //var next_indent = RedditComments.stripPx(next_row.find('td:eq(1) img').css('width'));

        if (indent < next_indent) {
          if (has_visible_children) {
            next_row.attr('visible', next_row.is(":visible"));
            next_row.hide();
          }
          else {
            if (next_indent - indent == 1 || 
                next_row.attr('visible') == "true") {
              next_row.show();
            }
          }
          num_children += 1;
        }

        comment_row = next_row;

      } while (indent < next_indent);
    }

    var def = el.find('.default');
    if (has_visible_children || !el.hasClass('collapsed')) {
      var child_str = (num_children > 0 ? " (" + num_children + " child" + (num_children == 1? "" : "ren") + ")" : "");
      $e.text("[+]" + child_str)
        .attr('title', 'Restore comment')
        .css('margin-left', def.prev().width() + 2 + 'px');
      def.find('div').siblings().hide();
      def.prev().hide();
      el.addClass('collapsed');
    }
    else {
      $e.text("[−]")
        .attr('title', 'Collapse comment')
        .css('margin-left', '');
      def.find('div').siblings().show();
      def.prev().show();
      el.removeClass('collapsed');
    }
  }
}


var HN = {
    init: function() {

        HN.initElements();
        HN.removeNumbers();

        if (/*window.location.pathname != '/submit' &&*/
            window.location.pathname != '/changepw') { 
          HN.rewriteNavigation();
        }

        //if user is logged in
        var logout_elem = $('.pagetop a:contains(logout)');
        if (logout_elem.length)
          HN.rewriteUserNav(logout_elem.parent());

        var pathname = window.location.pathname;
        //More link - can be post index, threads, comments, etc
        //threads is like "etcet's comments"
        //comment listings are like "New Comments"
        var track_comments = true;
        if (pathname == "/x") {
          track_comments = false;
          var title = document.title;
          var words = title.split(" ");
          if (words[1] == "Comments") {
            //normal comments - fallthrough
          }
          else if (words[1] == "comments") {
            //paginated comments, anything other than first page of comments
            //"more comments | Hacker News"
            if (words[0] == "more") 
              pathname = "/more";
            //"user's comments | Hacker News"
            else
              pathname = "/threads";
          }
          else if (words[0] == "Edit") {
            pathname = "/edit";
          }
          else if (title == "Hacker News | Confirm") {
            pathname = "/confirm";
          }
          else {
            pathname = "/news";
            //postlist
          }
        }
        else if (pathname == "/news2") {
          pathname = "/news";
        }

        var postPagesRE = /^(?:\/|\/news|\/newest|\/best|\/active|\/classic|\/submitted|\/saved|\/jobs|\/noobstories|\/ask)$/;
        if (postPagesRE.test(pathname)) {
          HN.doPostsList();
          if (pathname == '/jobs') {
            //omg so broken - hack around it
            $("body").attr("id", "jobs-body");
          }
        }
        else if (pathname == '/edit') {
          $("body").attr("id", "edit-body");
          $("tr:nth-child(3) td td:first-child").remove();
        }
        else if (pathname == '/item' ||
                 pathname == "/more") {
          HN.doCommentsList(pathname, track_comments);
        }
        else if (pathname == '/threads') {
          $("body").attr("id", "threads-body");

          //create new table and try to emulate /item
          var trs = $('body > center > table > tbody > tr');
          var comments = trs.slice(2, -1);
          var newtable = $("<table/>").append($('<tbody/>').append(comments));
          $(trs[1]).find('td').append(newtable);

          HN.doCommentsList(pathname, track_comments);
        }
        else if (pathname == '/newcomments' ||
                 pathname == '/bestcomments' || 
                 pathname == '/noobcomments' ) {
          HN.addClassToCommenters();
          HN.addScoreToUsers($('body'));
        }
        else {
          //make sure More link is in correct place
          $('.title:contains(More)').prev().attr('colspan', '1');
        }
    },

    initElements: function() {
      var header = $('body > center > table > tbody > tr:first-child');
      header.attr('id', 'header');

      var content = $('body > center > table > tbody > tr:nth-child(3)');
      content.attr('id', 'content');

      //remove empty tr element between header and content
      $('body > center > table > tbody > tr:nth-child(2)').remove();

      $('#header table td').removeAttr('style');
      
      $('tr:last-child .title').attr('id', 'more');
      //$('.title a[rel="nofollow"]:contains(More)').parent().attr('id', 'more');
      //$('.title a[href="news2"]').parent().attr('id', 'more');

      //remove spacing
      HN.removeCommentSpacing();
      $('tr[style="height:7px"]').remove();
      $('tr[style="height:2px"]').remove();

      $('.yclinks').parent('center').css({"width" : "100%"});

      HN.setSearchInput($('input[name="q"]'));
      $("input[name='q']").val("Search on hnsearch.com");

      var icon = $('img[src="http://ycombinator.com/images/y18.gif"]');
      icon.parent().attr({"href": "http://news.ycombinator.com/"});
      icon.attr('title', 'Hacker News');
    },
    removeCommentSpacing: function() {
      //remove spacing if comment doesn't have reply
      $('font[size="1"]').each(function() {
        if ($(this).text() == '-----')
          $(this).remove();
      });
      $('tr[style="height:10px"]').remove();
      $('br').remove();
    },

    getLocalStorage: function(key, callback) {
      chrome.extension.sendRequest({
        method: "getLocalStorage",
        key: key
      }, callback);
    },

    setLocalStorage: function(key, value) {
      chrome.extension.sendRequest(
        { method: "setLocalStorage",
          key: key,
          value: value },
        function(response) {
          console.log('RESPONSE', response.data);
        });
    },

    doPostsList: function() {
      $("body").attr("id", "index-body");

      HN.init_keys();

      //HN.removeUpvotes();
      //with upvotes, the 'more' link needs to be shifted 1 more col
      HN.moveMoreLink();
      HN.formatScore();
      HN.formatURL();

      //remove '*' on self stuff on /submitted?id=user
      $('font[color="#ff6600"]').parent().parent().remove();

      //check for new comments
      CommentTracker.checkIndexPage();
      //heat map points
      HN.getAndRateStories();
    },

    addClassToCommenters: function() {
      //add class to comment author 
      var commenters = $(".comhead a[href*=user]");
      commenters.addClass('commenter');
    },

    doCommentsList: function(pathname, track_comments) {
      InlineReply.init();
      HN.addClassToCommenters();

      //add classes to comment page header (OP post) and the table containing all the comments
      var comments;
      var below_header = $('body > center > table > tbody > tr:nth-child(2) > td > table');
      if (pathname == "/item") {
        $("body").attr("id", "item-body");
        $(below_header[0]).addClass('item-header');

        comments = $(below_header[1]);
        comments.addClass('comments-table');

        var poll = $('.item-header table');
        if (poll)
          HN.graphPoll(poll);

        var more = $('#more');
        //recursively load more pages on closed thread
        if (more) 
          HN.loadMoreLink(more);

        var addcomment = $('input[value="add comment"]');
        //don't track comments on closed threads
        if (addcomment.length == 0)
          track_comments = false;
      }
      else {// if (pathname == "/threads") {
        $("body").attr("id", "threads-body");
        comments = $(below_header[0]);
        comments.addClass('comments-table');
        HN.doAfterCommentsLoad(comments);
      }


      //do not want to track comments on 'more' pages
      //TODO: infinite scroll and tracking on 'more' pages
      if (track_comments)
        CommentTracker.init();
    },

    graphPoll: function(poll) {
      var poll_max_width = 500;
      var totalscore = 0;
      var poll_scores = poll.find('.default');
      poll_scores.each(function() {
        var score = Number($(this).text().split(' ')[0]);
        totalscore += score;
      });
      poll_scores.each(function() {
        var score = Number($(this).text().split(' ')[0]);
        if (score > 0) {
          var width = Math.max(1, score / totalscore * poll_max_width);
          var graph_el = $('<tr/>').append($('<td/>'))
                                   .append($('<td/>').append($('<div/>').addClass('poll-graph')
                                                                        .width(width)));
          $(this).parent().after(graph_el)
        }
      });
    },

    loadMoreLink: function(elem) {
      if (elem.length == 0) {
        HN.doAfterCommentsLoad($('.comments-table'));
        return;
      }

      var moreurl = elem.find('a').attr('href');
      var load_div = $('<div/>');
      load_div.load(moreurl + " > center > table > tbody > tr:nth-child(3) > td > table > tbody > tr", function(response) {
        console.log('load', moreurl);
        $(".comments-table > tbody").append(load_div.children());
        $("#more").remove();
        morelink = $('.title a[rel="nofollow"]:contains(More)').parent();
        if (morelink) {
          morelink.attr('id', 'more');
          HN.loadMoreLink(morelink);
        }
      });
    },

    doAfterCommentsLoad: function(comments) {
      var original_poster = $('.subtext a:eq(0)').addClass('original_poster').text();
      $('.commenter').each(function() {
        //add title to new users
        var new_user = $(this).find('font[color="#3c963c"]');
        if (new_user.length) {
          var user = $(this).text();
          new_user.remove();
          $(this).addClass('new_user')
                 .attr('title', 'New user')
                 .text(user);
        }

        //style and title original poster
        if ($(this).text() == original_poster) {
          $(this).addClass('original_poster')
                 .attr('title', 'Original poster');
        }
      });

      HN.removeCommentSpacing();
      HN.addScoreToUsers(comments);
      RedditComments.init(comments);
    },

    addScoreToUsers: function(commentsblock) {
      var commenters = $('.commenter');
      HN.getUserScores(commenters);
      var upvote_links = commentsblock.find($('a[onclick="return vote(this)"]'));
      upvote_links.click(HN.upvoteUser);
    },

    upvoteUser: function(e) {
      var author = $(this).parent().parent().next().find('.commenter').text();

      var commenter = $('.commenter:contains('+author+')');
      HN.getLocalStorage(author, function(response) {
        if (response.data) {
          var count = Number(response.data);
          var new_count = count + 1;
          HN.setLocalStorage(author, new_count);
          commenter.next().text(new_count);
        }
        else {
          HN.setLocalStorage(author, 1);
          HN.addUserScore(commenter, 1);
        }
      });
    },

    getUserScores: function(commenters) {
      commenters.each(function() {
        var this_el = $(this);
        var name = this_el.text();
        HN.getLocalStorage(name, function(response) {
          if (response.data)
            HN.addUserScore(this_el, response.data);
        });
      });
    },

    addUserScore: function(el, upvotes) {
      el.after(
          $('<span/>').addClass(name)
                      .addClass('user-score')
                      .text(upvotes)
                      .attr('title', 'User score')
      );
    },

    removeNumbers: function() {
      $('td[align="right"]').remove();
    },

    formatScore: function() {
      $('.subtext').each(function(){
        var score = $(this).find('span:first');
        var as = $(this).find('a');
        var comments;
        //if self story pick, 2nd link is to comments (after name)
        if (as.length == 4)
          comments = $(as[1])
        //otherwise it's the last one
        else
          comments = $(as[as.length - 1]);

        var by = $(this).find('a:eq(0)');

        if (score.length == 0)
          score = $("<span/>").text('0');
        else
          score.text(score.text().substring(0, score.text().indexOf(' ')));
        score.addClass("score").attr('title', 'Points');

        if (comments.text() == "discuss")
          comments = $("<a/>").html('0')
                              .attr('href', comments.attr('href'));
        else if (comments.text() == "comments")
          comments = $("<a/>").html('?')
                              .attr('href', comments.attr('href'));
        else if (comments.text() == "")
          score.text('');
        else
          comments.text(
            comments.text().substring(0, comments.text().indexOf(' '))
          );
        comments.addClass("comments")
                .attr('title', 'Comments');

        var by_el;
        if (by.length == 0)
          by_el = $("<span/>");
        else
          by_el = $('<span/>').addClass('submitter')
                              .text('by ')
                              .append(by);

        var score_el = $('<td/>').append(score);
        var comments_el = $('<td/>').append(comments);
        $(this).parent().prev().prepend(score_el);
        $(this).parent().prev().prepend(comments_el);
        $(this).parent().prev().find('.title').append(by_el);
        $(this).parent().next().remove();
        $(this).parent().remove();
      });
    },

    highlightCommentsLink: function(e) {
      $(this).toggleClass('hover-comments-score')
      $(this).next().toggleClass('hover-comments-score');
    },
    highlightScoreLink: function(e) {
      $(this).toggleClass('hover-comments-score')
      $(this).prev().toggleClass('hover-comments-score');
    },

    formatURL: function() {
        $('.comhead').each(function() {
          var url_el = $('<span/>').text(
                         $(this).text().substring(2, $(this).text().length - 2)
                       );
          var left_paren = $('<span/>').addClass('paren')
                                       .text('(');
          var right_paren = $('<span/>').addClass('paren')
                                        .text(')');
          $(this).text('');
          $(this).append(left_paren)
                 .append(url_el)
                 .append(right_paren);
        });
    },

    moveMoreLink: function() {
      $('#more').prev().attr('colspan', '3');
    },
    removeUpvotes: function() {
      var titles = $('.title');
      if ($(titles[titles.length - 1]).attr('id') == "more")
        $('.title').slice(0, -1).siblings().remove();
      else
        $('.title').siblings().remove();
    },

    rewriteUserNav: function(pagetop) {
      var user_links = $('<span/>').addClass('nav-links');
      var as = pagetop.find('a');
      var user_profile = $(as[0]);
      var logout = $(as[1]);
      var user_name = user_profile.text();

      var user_drop = $('<span/>').append(
                        $('<a/>').text(user_name)
                                 .attr('href', '#')
                      ).attr('title', 'Toggle user links')
                      .attr('id', 'my-more-link')
                      .addClass('more-arrow');

      logout.detach();
      user_profile.detach();
      var score = pagetop.text().slice(2, -4);
      var score_elem = $('<span/>').text('|')
                                   .append(
                                     $('<span/>').text(score)
                                                 .attr('id', 'my-karma')
                                                 .attr('title', 'Your karma')
                                   );
      user_links.append(score_elem);
      pagetop.empty();
      pagetop.append(user_links.prepend(user_drop));

      var hidden_div = $('<div/>').attr('id', 'user-hidden')
                                  .addClass('nav-drop-down');
      var user_pages = [ ['profile', '/user', 'Your profile and settings'],
                         ['threads', '/threads', 'Your comments and replies'],
                         ['saved', '/saved', "Stories you've voted for"],
                         ['stories', '/submitted', "Stories you've submitted"]
                       ];
      var new_active = false;
      for (var i in user_pages) {
        var link_text = user_pages[i][0];
        var link_href = user_pages[i][1];
        var link_title = user_pages[i][2];
        var link = $('<a/>').text(link_text)
                            .attr('href', link_href + '?id=' + user_name)
                            .attr('title', link_title);

        if (window.location.pathname == link_href) 
          new_active = link.clone().addClass('nav-active-link')
                                   .addClass('new-active-link');

        hidden_div.append(link);
      }
      if (new_active) {
        if (window.location.pathname != '/saved') {
          var user_id = window.location.search.match(/id=(\w+)/)[1];
          if (user_id == user_name)
            user_id = 'Your';
          else
            user_id = user_id + "'s";
          new_active.text(user_id + " " + new_active.text());
        }
        $('#top-navigation .nav-links').append($('<span/>')
                                       .text('|')
                                       .append(new_active));
      }

      hidden_div.append(
        logout.attr('id', 'user-logout')
              .attr('title', 'Logout')
      );
      user_links.append(hidden_div);

      user_drop.click(function() {
        hidden_div.toggle();
      });
      hidden_div.click(function() {
        hidden_div.toggle();
      });
      hidden_div.hide();
    },
    rewriteNavigation: function() {
        var topsel = $('.topsel');
        var more_nav = $('<div/>').attr('id', 'morenav')
                                  .addClass('topsel');
        var navigation = $('td:nth-child(2) .pagetop');
        navigation.attr('id', 'top-navigation');

        var visible_pages = [ ['top', '/news', 'Top stories'],
                              ['new', '/newest', 'Newest stories'],
                              ['best', '/best', 'Best stories'],
                              ['submit', '/submit', 'Submit a story'],
                            ];

        var hidden_pages = [ ['classic', '/classic', 'Only count votes from accounts older than one year'],
                             ['active', '/active', 'Active stories'],
                             ['ask', '/ask', 'Ask Hacker News'],
                             ['jobs', '/jobs', 'Sponsored job postings'],
                             ['bestcomments', '/bestcomments', 'Best comments'],
                             ['newcomments', '/newcomments', 'New comments'],
                             ['noobstories', '/noobstories', 'Stories by new users'],
                             ['noobcomments', '/noobcomments', 'Comments by new users']
                           ];

        if (topsel.length == 0) {
          topsel = $('<span/>').addClass('nav-links');
          navigation.append(topsel);
        }
        else {
          topsel.removeClass('topsel').addClass('nav-links');
          topsel.empty();
        }
        for (var i in visible_pages) {
          var link_text = visible_pages[i][0];
          var link_href = visible_pages[i][1];

          var span = $('<span/>').text('|');
          var new_link = $('<a/>').attr('href', link_href)
                                  .text(link_text)
                                  .addClass(link_text)
                                  .attr('title', visible_pages[i][2]);

          if (window.location.pathname == link_href)
            new_link.addClass('nav-active-link')

          topsel.append(span.prepend(new_link));
        }
        if (window.location.pathname == '/')
          $('.top').addClass('nav-active-link');

        var more_link = $('<span/>').append($('<a/>')
                                    .text('more')
                                    .attr('href', '#'))
                                    .attr('title', 'Toggle more links')
                                    .attr('id', 'nav-more-link')
                                    .addClass('more-arrow');
        var hidden_div = $('<div/>').attr('id', 'nav-others')
                                    .addClass('nav-drop-down');

        var new_active = false;
        for (var i in hidden_pages) {
          var link_text = hidden_pages[i][0];
          var link_href = hidden_pages[i][1];

          var new_link = $('<a/>').attr('href', link_href)
                                  .attr('title', hidden_pages[i][2])
                                  .text(link_text)
                                  .addClass(link_text);

          if (window.location.pathname == link_href) 
            new_active = new_link.clone().addClass('nav-active-link')
                                         .addClass('new-active-link');

          hidden_div.append($('<span/>').append(new_link));
        }

        topsel.append(more_link).append(hidden_div);

        if (new_active)
          topsel.append($('<span/>').text('|').append(new_active));

        navigation.empty().append(topsel);
        
        more_link.click(function() {
          hidden_div.toggle();
        });
        hidden_div.click(function() {
          hidden_div.toggle();
        });
        hidden_div.offset({'left': more_link.position().left});
        hidden_div.hide();
    },
    
    toggleMoreNavLinks: function(e) {
      var others = $('#nav-others');
      others.toggle();
    },

    setSearchInput: function(el) {
      el.focus(function(){
        HN.searchInputFocused = true;
        if (el.val() == "Search on hnsearch.com") {
          el.val("");
        }
      });
      el.blur(function(){
        HN.searchInputFocused = false;
        if (el.val() == "") {
          el.val("Search on hnsearch.com");
        }
      });
    },

    searchInputFocused: false,

    init_keys: function(){
        var j = 74, // Next Item
            k = 75, // Previous Item
            o = 79, // Open Story
            p = 80, // View Comments
            h = 72; // Open Help
			l = 76; // New tab
			c = 67; // Comments in new tab
			shiftKey = 16; //allow modifier
        $(document).keydown(function(e){
          //Keyboard shortcuts disabled when search focused
          if (!HN.searchInputFocused) {
            if (e.which == j) {
              HN.next_story();
            } else if (e.which == k) {
              HN.previous_story();
            } else if (e.which == l){
				HN.open_story_new_tab();
            } else if (e.which == o) {
              HN.open_story();
            } else if (e.which == p) {
              HN.view_comments();
            } else if (e.which == c) {
              HN.view_comments_new_tab();
            } else if (e.which == h) {
              //HN.open_help();
			}
          }
        })
    },

    next_story: function(){
      if ($('.on_story').length == 0) {
        $('#content tr:first').addClass("on_story");
      } else {
        var current = $('.on_story');
        var next_lem = current.next();
        if (next_lem.length) {
          next_lem.addClass("on_story");
          $('html, body').stop();
          $('html, body').animate({
            scrollTop: next_lem.offset().top - 10
            }, 200);
          current.removeClass("on_story");
        }
      }
    },

    previous_story:function(){
      if ($('.on_story').length == 0) {
      } else {
        var current = $('.on_story');
        var next_lem = current.prev();
        if (next_lem.length) {
          next_lem.addClass("on_story");
          $('html, body').stop();
          $('html, body').animate({
            scrollTop: next_lem.offset().top - 10
            }, 200);
          current.removeClass("on_story");
        }
      }
    },

    open_story: function(){
      if ($('.on_story').length != 0) {
        var story = $('.on_story .title > a');
        window.location = story.attr("href");
      }
    },

    open_story_new_tab: function(){
      if ($('.on_story').length != 0) {
        var story = $('.on_story .title > a');
		window.open(story.attr("href"));
        //window.location = story.attr("href");
      }
    },

    view_comments: function(){
      if ($('.on_story').length != 0) {
        var comments = $('.on_story .comments');
        if (comments.length != 0)
          window.location = comments.attr("href");
      }
    },

    view_comments_new_tab: function(){
      if ($('.on_story').length != 0) {
        var comments = $('.on_story .comments');
        if (comments.length != 0)
          window.open(comments.attr("href"));
      }
    },
    getAndRateStories: function() {
      var NO_HEAT = 50;
      var MILD    = 75;
      var MEDIUM  = 99;
      $('.score').each(function(i){
        var score = $(this).html();

        score = score.replace(/[a-z]/g, '');

        if (score < NO_HEAT) {
          $(this).addClass('no-heat');
        } else if (score < MILD) {
          $(this).addClass('mild');
        } else if (score < MEDIUM) {
          $(this).addClass('medium');
        } else {
          $(this).addClass('hot');
        };
      });
    }
}


//show new comment count on hckrnews.com
if (window.location.host == "hckrnews.com") {
  $('ul.entries li').each(function() {
    chrome.extension.sendRequest({method: "getLocalStorage", key: Number($(this).attr('id'))}, function(response) {
      if (response.data != undefined) {
        var data = JSON.parse(response.data);
        var id = data.id;
        var num = data.num ? data.num : 0;
        var now = Number($('#'+id).find('.comments').text());
        var unread = Math.max(now - num, 0); 
        var prepend = unread == 0 ? "" + unread + " / " : "<span>"+unread+"</span> / ";
        $(document).ready(function() {
          $('#'+id).find('.comments').prepend(prepend);
        });
      }
    });
  });
}
else {
  HN.init();

  $(document).ready(function(){
    $('body').css('visibility', 'visible');
  });
}
