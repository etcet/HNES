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
      if (HN.isLoggedIn()) {
        e.preventDefault();
      }
      else {
        return;
      }

      //make sure there's no stray underlining between Reply and Cancel
      $(this).addClass('underlined');
      $(this).parent('u').replaceWith($(this));

      /*remove the 'reply' link without actually hide()ing it because it
        doesn't work that way with collapsible comments*/
      $(this).addClass('no-font-size');

      domain = window.location.origin;
      link = domain + '/' + $(this).attr('href');

      if ($(this).next().hasClass('reply_form')) {
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

    /* Reply button */
    $('.rbutton').live('click', function(e) {
      e.preventDefault();
      link = $(this).attr('data');
      text = $(this).prev().val();
      //Hide cancel button and change reply text
      $(this).next().hide();
      $(this).attr("disabled","true");
      $(this).attr("value","Posting...");
      //Add loading spinner
      image = $('<img style="vertical-align:middle;margin-left:5px;"/>');
      image.attr('src',chrome.extension.getURL("images/spin.gif"));
      $(this).after(image);
      //Post
      InlineReply.postCommentTo(link, domain, text, $(this));
    });
    
    /* Cancel button */
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
      fnid = $(html).find('input[name="parent"]').attr('value');
      whence = $(html).find('input[name="goto"]').attr('value');
      hmac = $(html).find('input[name="hmac"]').attr('value');
      InlineReply.sendComment(domain, fnid, whence, hmac, text);
    }).error(function(xhr, status, error) {
      InlineReply.enableButtonAndBox(button);
    });
  },

  sendComment: function(domain, fnidarg, whencearg, hmacarg, textarg) {
    //console.log(domain, fnidarg, whencearg, hmacarg, textarg)
    $.post(
      domain + "/comment",
      {'parent': fnidarg,
       'goto': whencearg,
       'hmac': hmacarg,
       'text': textarg }
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
    var button_and_box = button.parent();
    var reply_link = button_and_box.prev();
    var textbox = button_and_box.find('textarea');
    if (textbox.val().length > 0) {
      reply_link.text("reply (saved)");
    }
    else {
      reply_link.text("reply");
    }
    reply_link.removeClass('no-font-size');
    button_and_box.hide();
  }
}


var CommentTracker = {
  init: function() {
    var page_info = CommentTracker.getInfo();
    HN.getLocalStorage(page_info.id, function(response) {
      var data = response.data;
      var prev_last_id = CommentTracker.process(data, page_info);
      CommentTracker.highlightNewComments(prev_last_id);
      //console.log("commentracker: ", page_info, prev_last_id);
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
    var no_comments = $('.subtext a[href^="item?"]:contains(discuss)');
    if (no_comments.length)
      comment_info_el = no_comments;
    else
      comment_info_el = $('.subtext a[href^="item?"]:contains(comment)');

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
    var self = this;
    
    var collapse_button = $('<span/>').addClass('collapse')
                                      .text('[\u2013]')
                                      .attr('title', 'Collapse comment');
    var link_to_parent = $('<span/>').text(' | ')
                                     .append($('<a/>')
                                     .attr('href', '#')
                                     .text('parent')
                                     .attr('title', 'Go to parent')
                                     .addClass('parent-link'));

    // Allocate an array for a the sequential list of nodes
    // which is used to build parent/child map below. This
    // array may be longer than the real data because dead
    // comments are ignored.
    var nodeList = new Array(comments.find('table').length),
        nodeIndex = 0;

    comments.find('table').each(function(i) {
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

      nodeList[nodeIndex++] = { id: id, level: level, children: [], table: $this, row: $this.parent().parent(), collapser: $this.find('.collapse') };

    });

    // Build the node map. This could certainly be done in the main
    // loop above, but we're not dealing with enough volume to
    // warrant that mess. Long threads are ~1000 comments.
    var s = [], m = {'root': {id: 'root', children: [] }}, data = nodeList;
    if (data.length > 0) {
      data[0].parentId = 'root';
      m.root.children.push(data[0]);
    }
    for (var i = 0, j = 1, data = nodeList; j < data.length; i++, j++) {
      var p = data[i], c = data[j];
      if (!p || !c) break;
      if (c.level > p.level) s.push(p.id);
      for (var x = 0; x < p.level - c.level; x++) s.pop();
      c.parentId = s[s.length - 1] || 'root';
      m[p.id] = data[i];
      m[c.parentId].children.push(c);
    }
    self.nodeMap = m;

    // restore prior collapses
    HN.getLocalStorage(CommentTracker.getInfo().id + '-collapsed', function(response) {
      if (!response.data) return;
      var collapsed = JSON.parse(response.data);
      for (var i = 0; i < collapsed.length; i++) {
        RedditComments._collapse(m[collapsed[i]]);
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
    var commentId = $(e.target).closest('tr.athing').find('.comment-table').attr('id'),
      node = RedditComments.nodeMap[commentId];

    if (node.collapsed) {
      RedditComments._expand(node);
    }
    else {
      RedditComments._collapse(node);
    }
    RedditComments._storeCollapsed();
  },

  _collapse: function(node) {
    node.collapsed = true;
    node.table.addClass('hnes-collapsed');
    node.collapser.text('[+] expand');
    preorder(node, function(n) { n.row.addClass('hnes-hidden'); }, true);
  },

  _expand: function(node) {
    node.collapsed = false;
    node.table.removeClass('hnes-collapsed');
    node.collapser.text('[\u2013]');
    preorder(node, function(n) { n.row.removeClass('hnes-hidden'); return n.collapsed; });
  },

  _storeCollapsed: function() {
    var itemId = CommentTracker.getInfo().id;
    var collapsed = [];
    preorder(RedditComments.nodeMap.root, function(n) {
      if (n.collapsed) collapsed.push(n.id);
    });
    HN.setLocalStorage(itemId + '-collapsed', JSON.stringify(collapsed));
  }

}

function preorder(n, visit, skip) {
  var die;
  if (!n) return;
  if (!skip) die = visit(n);
  if (die) return;
  for (var i = 0; i < n.children.length; i++) {
    preorder(n.children[i], visit);
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
        //add comment after logging in is "Hacker News | Add Comment"
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
          else if (title == "Hacker News | Add Comment") {
            pathname = "/reply";
          }
          else if (HN.isLoginPage()) {
            pathname = "/login";
          }
          else {
            pathname = "/news";
            //postlist
          }
        }

        var postPagesRE = /^(?:\/|\/news|\/newest|\/best|\/active|\/classic|\/submitted|\/saved|\/jobs|\/noobstories|\/ask|\/news2|\/over|\/show|\/shownew)$/;
        if (postPagesRE.test(pathname)) {
          HN.doPostsList();

          function remove_first_tr() {
            $("body #content td table tbody tr").filter(":first").remove();
          }
          if (pathname == '/show') {
            remove_first_tr();
          }
          if (pathname == '/jobs') {
            $("body").attr("id", "jobs-body");
          }
          if (pathname == '/show' || pathname == '/jobs') {
            var blurb = $("body #content td table tbody tr td:nth-child(3)").filter(':first').html();
            remove_first_tr();
            $("body #content table").before("<p class='blurb'>"+blurb+"</p>");
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
        else if (pathname == '/user') {
          HN.doUserProfile();
        }
        else if (pathname == '/newslogin' ||
                 pathname == '/login') {
          HN.doLogin();
        }
        else if ((pathname == '/reply') && HN.isLoginPage()) {
          HN.doLogin(); // reply when not logged in
        }
        else if ((pathname == '/submit') && HN.isLoginPage()) {
          HN.doLogin(); // submit when not logged in 
        }
        else if (pathname == '/newpoll') {
          HN.doPoll();
        }
        else {
          //make sure More link is in correct place
          $('.title:contains(More)').prev().attr('colspan', '1');
        }
        //console.log(pathname);
    },

    doPoll: function() {
      $('body').attr('id', 'poll-body');
    },

    isLoginPage: function() {
      return ($("b:contains('Login')").length > 0);
    },

    isLoggedIn: function() {
      var logout_elem = $('.pagetop a:contains(logout)');
      return (logout_elem.length > 0 ? true : false);
    },

    initElements: function() {
      var header = $('body > center > table > tbody > tr:first-child');
      if (header.find('td').attr('bgcolor') === "#000000") {
        //mourning
        header = header.next();
        header.prev().remove();
        $('body').addClass('mourning');
      }
      header.attr('id', 'header');

      var contentIndex = 2;
      if ($('body > center > table > tbody > tr').eq(1).has('.pagetop').length > 0) {
        // There's an announcement underneath header
        contentIndex++;
      }

      var content = $('body > center > table > tbody > tr').eq(contentIndex);
      content.attr('id', 'content');

      //remove empty tr element between header and content
      $('body > center > table > tbody > tr').eq(contentIndex - 1).remove();

      $('#header table td').removeAttr('style');
      
      $('tr:last-child .title').attr('id', 'more');
      //$('.title a[rel="nofollow"]:contains(More)').parent().attr('id', 'more');
      //$('.title a[href="news2"]').parent().attr('id', 'more');

      //remove spacing
      HN.removeCommentSpacing();
      $('tr[style="height:7px"]').remove();
      $('tr[style="height:2px"]').remove();

      $('.yclinks').parent('center').css({"width" : "100%"});

      var search_domain = "hn.algolia.com";
      HN.setSearchInput($('input[name="q"]'), search_domain);

      var icon = $('img[src="y18.gif"]');
      icon.parent().attr({"href": "http://news.ycombinator.com/"});
      icon.attr('title', 'Hacker News');
    },

    injectCSS: function() {
      $('head').append('<link rel="stylesheet" type="text/css" href="news.css">');
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
          //console.log('RESPONSE', response.data);
        });
    },

    doLogin: function() {
      $('body').attr('id', 'login-body');
      document.title = "Login | Hacker News";

      HN.injectCSS();

      // save and remove (to be re-added later) any rogue messages outside of any tag (e.g. "Bad login.")
      var rogue_messages = $('body').contents().filter(function(){ return this.nodeType == 3; });
      var message = rogue_messages.text().trim();
      rogue_messages.remove();

      var recover_password_link = $('body > a');
      if (recover_password_link.length > 0)
        recover_password_link.remove();

      // remove login header, submit button (will be re-added later)
      $('body > b:first').remove();
      var buttonHtml = $('form input[type="submit"]').get(0).outerHTML;
      $('form:first input[type=submit]').remove();

      var headerHtml = '<tr id="header"><td bgcolor="#ff6600"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding:2px"><tbody><tr><td><a href="http://ycombinator.com"><img src="y18.gif" width="18" height="18" style="border:1px #ffffff solid;"></a></td><td><span class="pagetop" id="top-navigation"><span class="nav-links"><span><a href="/news" class="top" title="Top stories">top</a>|</span><span><a href="/newest" class="new" title="Newest stories">new</a>|</span><span><a href="/best" class="best" title="Best stories">best</a></span></div></span></span></td></tr></tbody></table></td></tr>';
      
      // wrap content into a table
      $('body > form:first').attr('id', 'login-form');
      $('#login-form').wrap('<tr id="content"><td></td></tr>');
      $('tr#content').wrap('<table border="0" cellpadding="0" cellspacing="0" width="85%"></table>');

      // add header table row and submit button row
      $('tr#content').before(headerHtml);
      $('#login-form tr:last').after('<tr><td></td><td>' + buttonHtml + '</td></tr>');

      $('table').wrap('<center></center>');
      $('#login-form').before('<h1>Login</h1>');

      if (recover_password_link.length > 0)
        $('#login-form').before(recover_password_link);
      
      // re-add rogue messages previously removed
      if (message)
        $('tr#content > td:first > h1').before(' <p id="login-msg">' + message + '</p>');

      // register?
      if ($("b:contains('Create Account')").length > 0) {
        HN.doCreateAccount();
      }
    },

    doCreateAccount: function() {
      // first check if doLogin() has already built a login prompt,
      // then check if there is another form present (e.g. Create Account)
      if ($('body#login-body').length == 0) return;
      if ($('body > form').length == 0) return;

      // save and remove title/form
      var formTitle = $('body > b').text();
      $('body > b').remove();
      $('body > form').attr('id', 'register-form');
      var formContent = $('#register-form').get(0).outerHTML;
      $('#register-form').remove();

      // rebuild title/form inside the existing table
      $('tr#content > td:last').append(formContent);
      var buttonHtml = $('#register-form > input[type="submit"]').get(0).outerHTML;
      $('#register-form > input[type="submit"]').remove();
      $('#register-form tr:last').after('<tr><td></td><td>' + buttonHtml + '</td></tr>');
      $('#register-form').before('<h1>Create Account</h1>');
    },

    doPostsList: function() {
      $("body").attr("id", "index-body");

      HN.init_keys();

      //HN.removeUpvotes();
      //with upvotes, the 'more' link needs to be shifted 1 more col
      HN.moveMoreLink();
      HN.formatScore();
      HN.formatURL();

      //check for new comments
      CommentTracker.checkIndexPage();
      //heat map points
      HN.getAndRateStories();
      //enable highlighting of clicked links
      HN.enableLinkHighlighting();

      HN.replaceVoteButtons(true);      
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

        //linkify self-post text
        $('.item-header tr:nth-child(3)').addClass('self-post-text').linkify();

        //fix spacing issue #86
        $(".item-header td[colspan='2']").attr('colspan', '1');

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

    doUserProfile: function() {
      $('#content > td').attr('id', 'user-profile');

      var options = $('tr > td[valign="top"]');
      var user = options[0];
      var created = $(options[1]);
      var karma = $(options[2]);
      var about = $(options[3]);

      var days_ago = created.next();
      var days = days_ago.text().split(" ")[0];
      days_ago.text(days + " days (" + HN.prettyPrintDaysAgo(days) + ") ago");

      if (options.length === 5) {
        //other user pages
        $('#user-profile a[href^="submitted"]').parent().attr('id', 'others-profile-submitted');
        about.next().linkify();
      }
      else {
        //your user page
        $('#user-profile').addClass('your-profile');
        var email = $(options[4]);
        var showdead = $(options[5]);
        var noprocrast = $(options[6]);
        var maxvisit = $(options[7]);
        var minaway = $(options[8]);
        var delay;
        if($('tr > td[valign="top"]:contains("topcolor:")').length) {
          var topcolor = $(options[9]);
          topcolor.addClass('select-option');
          topcolor.next().append($('<span>Default: ff6600</span>'));
          delay = $(options[10]);		
        }
        else{
          delay = $(options[11]);				
        }

        //fix spacing
        email.addClass('select-option'); 
        showdead.addClass('select-option');
        noprocrast.addClass('select-option');
        maxvisit.addClass('select-option');
        minaway.addClass('select-option');
        delay.addClass('select-option');
        $('#user-profile a[href="changepw"]').parent().attr('id', 'your-profile-change-password');

        var current_karma = parseInt(karma.next().text());
        var karma_for_flag = 20;
        var karma_for_polls = 200;
        var karma_for_downvotes = 500;
        var can_flag_msg;
        var can_create_polls_msg;
        var can_downvote_msg;
        if (current_karma < karma_for_flag) {
          can_flag_msg = $('<p>You need ' + (karma_for_flag - current_karma) + ' more karma until you can flag posts.</p>');
        }
        else {
          can_flag_msg = $('<p>You can flag posts.</p>');
        }
        if (current_karma < karma_for_polls) {
          can_create_polls_msg = $('<p>You need ' + (karma_for_polls - current_karma) + ' more karma until you can create a poll.</p>');
        }
        else {
          can_create_polls_msg = $('<p>You can <a href="//news.ycombinator.com/newpoll">create a poll</a>.</p>');
        }
        if (current_karma < karma_for_downvotes) {
          can_downvote_msg = $('<p>You need ' + (karma_for_downvotes - current_karma) + ' more karma until you can downvote comments.</p>');
        }
        else {
          can_downvote_msg = $('<p>You can downvote comments.</p>');
        }
        karma.next().append(can_flag_msg).append(can_create_polls_msg).append(can_downvote_msg);

        var about_help = about.next().find('a[href="formatdoc"]');
        about_help.click(function(e) {
          e.preventDefault();
          var input_help = about.next().find('.input-help');
          if (input_help.length) {
            input_help.remove();
          }
          else {
            about.next().append(HN.getFormattingHelp(false));
          }
        });

        var dead_explanation = $('<p>Showdead allows you to see all the submissions and comments that have been killed by the editors.</p>');
        showdead.next().append($('<span>Default: no</span>')).append(dead_explanation);

        var noprocrast_explanation = $('<p>Noprocast is a way to prevent yourself from spending too much time on Hacker News. If you turn it on you\'ll only be allowed to visit the site for maxvisit minutes at a time, with gaps of minaway minutes in between.</p>');
        noprocrast.next().append($('<span>Default: no</span>')).append(noprocrast_explanation);

        maxvisit.next().append($('<span>Default: 20</span>'));
        minaway.next().append($('<span>Default: 180</span>'));

        var delay_explanation = $('<p>Delay allows you to delay the public posting of comments you make for delay minutes.</p>');
        delay.next().append($('<span>Default: 0</span>')).append(delay_explanation);

        //redirect to profile page after updating, instead of /x page
        $('input[value="update"]').click(function() {
          HN.setLocalStorage('update_profile', window.location.href);
        });
      }
    }, 

    getFormattingHelp: function(links_work) {
      help = '<p>Blank lines separate paragraphs.</p>' +
             '<p>Text after a blank line that is indented by two or more spaces is reproduced verbatim (this is intended for code).</p>' +
             '<p>Text surrounded by asterisks is italicized, if the character after the first asterisk isn\'t whitespace.</p>';
      if (links_work)
        help += '<p>Urls become links.</p>';

      return $('<div class="input-help">').append($(help));
    },

    prettyPrintDaysAgo: function(days) {
      //copied from http://stackoverflow.com/a/8942982
      var str = '';
      var values = {
        ' year': 365,
        ' month': 30,
        ' day': 1
      };

      for (var x in values) {
        var amount = Math.floor(days / values[x]);

        if (amount >= 1) {
          str += amount + x + (amount > 1 ? 's' : '');
          if (x != ' day') {
            str += ' ';
          }
          days -= amount * values[x];
        }
      }

      return str;
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
      HN.replaceVoteButtons(false);
    },

    replaceVoteButtons: function(isPostList) {
      $('img[src$="grayarrow.gif"]').replaceWith('<div class="up-arrow"></div>');
      $('img[src$="graydown.gif"]').replaceWith('<div class="down-arrow last-arrow"></div>');
      
      if (isPostList) {
        $('div.up-arrow').addClass('postlist-arrow');
      } else {
        // any up-arrows that don't have a down arrow next to them, add the last-arrow class
        // as well, which will give a bit extra margin before the show/hide link
        $('div.up-arrow').each(function() {
          var numbuttons = $($(this).parents('center').get(0)).find('a').size();
          if (numbuttons == 1) {
            $(this).addClass('last-arrow');
          }
        });
      }
    },

    addScoreToUsers: function(commentsblock) {
      var commenters = $('.commenter');
      HN.getUserScores(commenters);
      var vote_links = commentsblock.find($('a[onclick="return vote(this)"]'));
      var upvote_links = $(vote_links).filter('a[id^="up_"]');
      var downvote_links = $(vote_links).filter('a[id^="down_"]');
      upvote_links.click(function(e) {
        HN.upvoteUser(e, 1);
      });
      downvote_links.click(function(e) {
        HN.upvoteUser(e, -1);
      });
    },

    upvoteUser: function(e, value) {
      var author = $(e.target).parent().parent().parent().next().find('.commenter').text();

      var commenter = $('.commenter:contains('+author+')');
      HN.getLocalStorage(author, function(response) {
        if (response.data) {
          var count = Number(response.data);
          var new_count = count + value;
          HN.setLocalStorage(author, new_count);
          commenter.next().text(new_count);
        }
        else {
          HN.setLocalStorage(author, value);
          HN.addUserScore(commenter, value);
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

        comments = $(as[as.length - 1]);

        var by = $(this).find('a:eq(0)');

        if (score.length == 0)
          score = $("<span/>").text('0');
        else
          score.text(score.text().substring(0, score.text().indexOf(' ')));
        score.addClass("score").attr('title', 'Points');

        if (comments.text() == "discuss" || /ago$/.test(comments.text()))
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
                              .append(by.attr('title', 'View profile'));

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
                         $(this).text().substring(2, $(this).text().length - 1)
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
      var score_str = pagetop.text();
      var regex = /\(([^)]+)\)/;
      var matches = regex.exec(score_str);
      var score = matches[1];

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
                         ['comments', '/threads', 'Your comments and replies'],
                         ['submitted', '/submitted', "Stories you've submitted"],
                         ['saved', '/saved', "Stories you've voted for"]
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

      user_drop_toggle = function() {
        user_drop.find('a').toggleClass('active')
        hidden_div.toggle();
      }
      user_drop.click(user_drop_toggle);
      hidden_div.click(user_drop_toggle);
      hidden_div.hide();
	  HN.setTopColor();
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

        var hidden_pages = [ ['show', '/show', 'Show HN'],
                             ['shownew', '/shownew', 'New Show HN posts'],
                             ['classic', '/classic', 'Only count votes from accounts older than one year'],
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

          hidden_div.append(new_link);
        }

        topsel.append(more_link).append(hidden_div);

        if (new_active)
          topsel.append($('<span/>').text('|').append(new_active));

        navigation.empty().append(topsel);
        
        toggle_more_link = function() {
          more_link.find('a').toggleClass('active');
          hidden_div.toggle();
        }
        more_link.click(toggle_more_link);
        hidden_div.click(toggle_more_link);

        hidden_div.offset({'left': more_link.position().left});
        hidden_div.hide();
    },
    
    toggleMoreNavLinks: function(e) {
      var others = $('#nav-others');
      others.toggle();
    },

    setTopColor: function(){
      var topcolor = document.getElementById("header").children[0].getAttribute("bgcolor");
      if(topcolor.toLowerCase() != '#ff6600') {
        $('#header').css('background-color', topcolor);
        $('.nav-drop-down').css('background-color', topcolor);
        $('.nav-drop-down a:hover').css('background-color', topcolor);
      }
    },
	
    setSearchInput: function(el, domain) {
      var text = "Search on " + domain;
      $("input[name='q']").val(text);
      el.focus(function(){
        HN.searchInputFocused = true;
        if (el.val() == text) {
          el.val("");
        }
      });
      el.blur(function(){
        HN.searchInputFocused = false;
        if (el.val() == "") {
          el.val(text);
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
            b = 66; // Open comments and link in new tab
            shiftKey = 16; //allow modifier
        $(document).keydown(function(e){
          //Keyboard shortcuts disabled when search focused
          if (!HN.searchInputFocused && !e.ctrlKey) {
            if (e.which == j) {
              HN.next_story();
            } else if (e.which == k) {
              HN.previous_story();
            } else if (e.which == l){
              HN.open_story_in_new_tab();
            } else if (e.which == o) {
              HN.open_story_in_current_tab();
            } else if (e.which == p) {
              HN.open_comments_in_current_tab();
            } else if (e.which == c) {
              HN.open_comments_in_new_tab();
            } else if (e.which == h) {
              //HN.open_help();
            } else if (e.which == b) {
              HN.open_comments_in_new_tab();
              HN.open_story_in_new_tab();
            }
          }
        })
    },

    open_story_in_current_tab: function() {
      HN.open_story(false);
    },
    open_story_in_new_tab: function() {
      HN.open_story(true);
    },
    open_comments_in_current_tab: function() {
      HN.view_comments(false);
    },
    open_comments_in_new_tab: function() {
      HN.view_comments(true);
    },

    next_story: function() {
      HN.next_or_prev_story(true);
    },
    previous_story: function() {
      HN.next_or_prev_story(false);
    },

    next_or_prev_story: function(next){
      if ($('.on_story').length == 0) {
        if (next)
          $('#content tr:first').addClass("on_story");
      } else {
        var current = $('.on_story');
        var next_lem;
        if (next)
          next_lem = current.next();
        else
          next_lem = current.prev();
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

    open_story: function(new_tab){
      if ($('.on_story').length != 0) {
        var story = $('.on_story .title > a');
        if (new_tab) {
          $('.on_story .title').addClass("link-highlight");
          window.open(story.attr("href"));
        }
        else
          window.location = story.attr("href");
      }
    },

    view_comments: function(new_tab){
      if ($('.on_story').length != 0) {
        var comments = $('.on_story .comments');
        if (comments.length != 0) {
          if (new_tab)
            window.open(comments.attr("href"));
          else
            window.location = comments.attr("href");
        }
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
    },

    enableLinkHighlighting: function() {
      $('.title a:link').click(function() {
          $(this).closest('td').addClass('link-highlight');
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
    if ("Unknown or expired link." == $('body').html()) {
      HN.setLocalStorage('expired', true);
      window.location.replace("/");
      return;
    }
    else {
      HN.getLocalStorage('expired', function(response) {
        if (response.data != undefined) {
          var expired = JSON.parse(response.data);
          if (expired) {
            $('#header').after("<p id=\"alert\">You reached an <a href=\"//news.ycombinator.com/item?id=17705\" title=\"what?\">expired page</a> and have been redirected back to the front page.</p>");
            HN.setLocalStorage('expired', false);
          }
        }
      });
    }

    //redirect to profile page after updating it
    if (window.location.pathname == "/x") {
      HN.getLocalStorage('update_profile', function(response) {
        if (response.data != undefined && response.data != "false") {
          HN.setLocalStorage('update_profile', false);
          window.location.replace(response.data);
        }
      });
    }
    
    $('body').css('visibility', 'visible');
  });
}
