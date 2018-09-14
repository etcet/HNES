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
      $(this).css('display', 'none');

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
    $('.rbutton').on('click', function(e) {
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
    $('.cbutton').on('click', function(e) {
      InlineReply.hideButtonAndBox($(this).prev());
    });
  },

  postCommentTo: function(link, domain, text, button) {
    InlineReply.disableButtonAndBox(button);
    $.ajax({
      accepts: "text/html",
      url: link
    }).done(function(html) {
      fnid = $(html).find('input[name="parent"]').attr('value');
      whence = $(html).find('input[name="goto"]').attr('value');
      hmac = $(html).find('input[name="hmac"]').attr('value');
      InlineReply.sendComment(domain, fnid, whence, hmac, text);
    }).fail(function(xhr, status, error) {
      InlineReply.enableButtonAndBox(button);
    });
  },

  sendComment: function(domain, fnidarg, whencearg, hmacarg, textarg) {
    $.post(
      domain + "/comment",
      {'parent': fnidarg,
       'goto': whencearg,
       'hmac': hmacarg,
       'text': textarg }
    ).always(function(a) {
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
    reply_link.css('display', 'inline')
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
    });
  },

  highlightNewComments: function(last_id) {
    var comments = document.querySelectorAll('.hnes-comment');

    for (var i = 0; i < comments.length; i++) {
      var id = comments[i].getAttribute('id');
      var comment = HN.hnComments.nodeMap[id];

      if (id > last_id) {
        comment.el.classList.remove('hnes-new-parent')
        comment.el.classList.add('hnes-new')
        comment = comment.parent;
        while (comment && comment.level > 0) {
          if (!comment.el.classList.contains('hnes-new')) {
            comment.el.classList.add('hnes-new-parent');
          }
          comment = comment.parent;
        }
      }
    }
  },

  getInfo: function() {
    var comment_info_as = document.querySelectorAll('.subtext a');
    var comment_info_el = comment_info_as[comment_info_as.length - 1];

    // if there is no 'discuss' or 'n comment(s)' link it's some other kind of page (e.g. profile)
    if (!comment_info_el || comment_info_el.length == 0) {
      return {"id": window.location.pathname + window.location.search,
              "num": 0,
              "last_comment_id": CommentTracker.getLastCommentId()
              }
    }

    var page_id = comment_info_el.href.match(/id=(\d+)/);
    if (page_id.length) {
      page_id = Number(page_id[1]);
    }
    else {
      page_id = window.location.search.match(/id=(\d+)/);
      console.error('NO PAGEID', page_id);
    }

    var comment_info_text = comment_info_el.textContent;
    var comment_num = comment_info_text.split(" ")[0];
    if (comment_num) {
      comment_num = Number(comment_num);
    }

    var last_id = CommentTracker.getLastCommentId();

    return {"id": page_id, "num": comment_num, "last_comment_id": last_id}
  },

  getLastCommentId: function() {
    var ids = new Array();
    var comments = document.querySelectorAll('.hnes-comment');

    for (var i = 0; i < comments.length; i++) {
      var id = comments[i].getAttribute('id');
      ids.push(Number(id));
    }

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
        var id=$(this).attr('href').match(/id=(\d+)/);
        if(id){
            id = Number(id[1]);
        }
        else{
            //For some reason, the link we are processing is not to an HN comment section
            //I have observed this happening on dead links, which seem to grab the URL from the "web" link
            return;
        }
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

class HNComments {
  constructor(storyId) {
    var injector = document.createElement('div');
    injector.innerHTML = `
      <template id="hnes-comment-tmpl">
          <div id="" class="hnes-comment" data-hnes-level="">
              <header>
                  <a class="collapser" title="Toggle collapse"></a>
                  <!--<span class="voter"><a href="#" class="upvote"></a><a href="#" class="downvote"></a></span>-->
                  <span class="upvoter"><a href="#" class="upvote" title="Upvote">↑</a></span>
                  <span class="downvoter"><a href="#" class="downvote" title="Downvote">↓</a></span>
                  <span class="unvoter"><a href="#" class="unvote" title"Unvote">🗙</a></span>
                  <span class="score"></span>
                  <span class="author">
                    <a href="" title="User profile"></a>
                    <span class="hnes-user-score-cont noscore" title="User score">(<span class="hnes-user-score"></span>)</span>
                    <span class="hnes-tag-cont">
                      <img class="hnes-tag" title="Tag user">
                      <span class="hnes-tagText" title="User tag"></span>
                      <input type="text" class="hnes-tagEdit" placeholder="">
                    </span>
                  </span>
                  <!--<span class="age"></span>-->
                  <a class="age permalink"></a>
                  <span class="reply-count"></span>
                  <span class="on-story nostory">on <a href=""></a></span>
              </header>
              <section class="body">
                  <div class="text">
                  </div>
                  <footer>
                      <a class="reply">reply</a>
                      <!--<a class="permalink">permalink</a>-->
                      <a class="parent">parent</a>
                  </footer>
              </section>
              <section class="replies"></div>
          </div>
      </template>
      `
    this.commentTemplate = injector.firstElementChild;
    this.storyId = storyId;
  }

  getNodeMap() {
    return this.nodeMap;
  }

  extractCommentParts(commentEl) {
    const parts = [];
    if (!commentEl) return parts;

    const container = commentEl.firstElementChild;
    if (!container) return parts;

    const p = document.createElement('p');

    let n = container.firstChild;
    while (n && !(n.nodeName == 'P' || n.nodeName == 'SPAN' || n.nodeName == 'DIV')) {
      p.appendChild(n.cloneNode(true));
      n = n.nextSibling;
    }
    parts.push(p);

    while (n && n.nodeName != 'DIV') {
      parts.push(n.cloneNode(true));
      n = n.nextSibling;
    }
    return parts;
  }

  markupToNodeList(commentTree) {
    if (!commentTree) return;

    var commentTables = commentTree.querySelectorAll('tr.athing table');
    // pages like /bestcomments don't have sub-tables
    if (!commentTables.length) {
      commentTables = commentTree.querySelectorAll('tr.athing')
    }
    if (!commentTables) return;

    const nodeList = new Array(commentTables.length + 1);

    let nodeIndex = 1,
        deleted = 0;

    nodeList[0] = { id: 'root', level: 0, children: [] };

    // record the OP so we can color their name orange
    const original_poster_el = document.querySelector('.subtext .hnuser'),
          original_poster = original_poster_el ? original_poster_el.textContent : '';
    if (original_poster_el) {
      original_poster_el.classList.add('original_poster');
    }

    for (let i = 0; i < commentTables.length; i++) {
      const
        t = commentTables[i],
        id = t.parentElement.parentElement.id || t.id,
        upVoteEl = document.getElementById('up_' + id),
        upVoteUrl = upVoteEl ? upVoteEl.href : '',
        downVoteEl = document.getElementById('down_' + id),
        downVoteUrl = downVoteEl ? downVoteEl.href : '',
        unVoteEl = document.getElementById('un_' + id),
        unVoteUrl = unVoteEl ? unVoteEl.href : '',
        isUpVoted = upVoteEl && upVoteEl.classList.contains('nosee'),
        isDownVoted = downVoteEl && downVoteEl.classList.contains('nosee'),
        replyEl = t.querySelector('.reply a'),
        replyUrl = replyEl ? replyEl.href : '',
        ageEl = t.querySelector('.age a'),
        age = ageEl ? ageEl.textContent : '',
        permalinkUrl = ageEl ? ageEl.href : '',
        userEl = t.querySelector('a.hnuser'),
        username = userEl ? userEl.textContent : '',
        userUrl = userEl ? userEl.href : '',
        commentEl = t.querySelector('div.comment'),
        isDeleted  = !(commentEl && commentEl.firstElementChild),
        textParts = isDeleted ? [] : this.extractCommentParts(commentEl),
        imgEl = t.querySelector('img'),
        level = (imgEl && (Math.floor(imgEl.getAttribute('width') / 40))) + 1,
        parentLinkEl = t.querySelector('.par a'),
        parentLinkUrl = parentLinkEl ? parentLinkEl.href : '',
        storyLinkEl = t.querySelector('.storyon a'),
        storyLinkUrl = storyLinkEl ? storyLinkEl.href : '',
        storyLinkText = storyLinkEl ? storyLinkEl.textContent : '',
        userFontEl = userEl ? userEl.querySelector('font') : '',
        userColor = userFontEl ? userFontEl.getAttribute('color') : '',
        isNoob = userColor == "#3c963c",
        isOP = username == original_poster,
        commentSpanEl = commentEl.querySelector('span'),
        commentColor = commentSpanEl ? commentSpanEl.classList[0] : 'c00',
        isDead = t.querySelector('span.comhead').textContent.includes(' [dead] '),
        scoreEl = t.querySelector('span.score'),
        score = scoreEl ? scoreEl.textContent : '';

      nodeList[nodeIndex++] = {
        id,
        level,
        upVoteUrl,
        downVoteUrl,
        unVoteUrl,
        isUpVoted,
        isDownVoted,
        replyUrl,
        age,
        username,
        userUrl,
        isDeleted,
        textParts,
        permalinkUrl,
        children: [],
        isCollapsed: false,
        isDirty: false,
        parentLinkUrl,
        storyLinkUrl,
        storyLinkText,
        isNoob,
        isOP,
        commentColor,
        isDead,
        score,
      }
    };
    return nodeList;
  }

  nodeListToTree(nodeList) {
    const s = [], m = { root: nodeList[0] };
    for (let i = 0, j = 1, data = nodeList; j < data.length && data[j]; i++, j++) {
      const p = data[i], c = data[j];
      if (c.level > p.level) s.push(p.id);
      for (let x = 0; x < p.level - c.level; x++) s.pop();
      c.parent = m[s[s.length - 1]] || data[0];
      m[c.parent.id].children.push(c);
      m[c.id] = c;
    }
    return m;
  }

  renderComment(c, into) {
    const
      kids = c.children,
      oddOrEven = c.level % 2 ? 'odd' : 'even',
      clone = document.importNode(this.commentTemplate.content, true),
      commentEl = clone.firstElementChild,
      upvoterEl = commentEl.querySelector('.upvoter'),
      downvoterEl = commentEl.querySelector('.downvoter'),
      unvoterEl = commentEl.querySelector('.unvoter'),
      parentEl = commentEl.querySelector('.parent'),
      authorEl = commentEl.querySelector('.author a'),
      userscoreEl = commentEl.querySelector('.hnes-user-score'),
      tagImageEl = commentEl.querySelector('.hnes-tag'),
      tagTextEl = commentEl.querySelector('.hnes-tagText');

    c.el = commentEl;

    tagImageEl.src = chrome.extension.getURL('/images/tag.svg');

    commentEl.id = c.id;
    commentEl.classList.add(`level-${oddOrEven}`);
    commentEl.querySelector('.age').textContent = c.age;
    if (c.descCount > 0) {
      commentEl.querySelector('.reply-count').textContent = `(${c.descCount} repl${c.descCount == 1 ? 'y' : 'ies'})`;
    }
    if (c.replyUrl) {
      commentEl.querySelector('.reply').href = c.replyUrl;
    } else {
      commentEl.querySelector('.reply').classList.add('noreply');
    }
    commentEl.querySelector('.permalink').href = c.permalinkUrl;
    authorEl.textContent = c.username;
    authorEl.href = c.userUrl;

    if (c.isCollapsed) commentEl.classList.add('collapsed');

    if (c.level == 1) {
      parentEl.parentNode.removeChild(parentEl);
    }
    else {
      if (c.parentLinkUrl) {
        parentEl.href = c.parentLinkUrl;
        commentEl.querySelector('.reply-count').classList.add('noreply');
      } else {
        parentEl.href = `#${c.parent.id}`;
      }
    }

    if (c.isNoob) {
      authorEl.classList.add('new_user');
    } else if (c.isOP) {
      authorEl.classList.add('original_poster');
    }

    commentEl.querySelector('a.upvote').href = c.upVoteUrl;
    commentEl.querySelector('a.downvote').href = c.downVoteUrl;
    commentEl.querySelector('a.unvote').href = c.unVoteUrl;

    // hide upvotes or downvotes if there's no url in original (i.e. not logged in or not enough karma to downvote)
    if (!c.upVoteUrl) { upvoterEl.classList.add('voted') }
    if (!c.downVoteUrl) { downvoterEl.classList.add('voted') }

    if (c.isUpVoted || c.isDownVoted) {
      upvoterEl.classList.add('voted')
      downvoterEl.classList.add('voted')
    }
    if (c.unVoteUrl) {
      unvoterEl.classList.add('voted')
    }

    if (c.storyLinkUrl) {
      commentEl.querySelector('.on-story').classList.remove('nostory');
      commentEl.querySelector('.on-story a').href = c.storyLinkUrl;
      commentEl.querySelector('.on-story a').textContent = c.storyLinkText;
    }

    if (c.commentColor) {
      commentEl.classList.add(c.commentColor);
    }

    if (c.isDead) {
      authorEl.classList.add('dead');
    }
    
    if (c.score) {
      commentEl.querySelector('.score').textContent = c.score + " by";
      commentEl.querySelector('.score').classList.add('visible');
    }

    for (let parts = c.textParts, textContainer = commentEl.querySelector('.text'), i = 0; i < parts.length; i++) {
      textContainer.appendChild(parts[i]);
    }

    commentEl.querySelector('.collapser').addEventListener('click', e => {
      e.preventDefault();
      this.collapse(c);
    }, true);

    // ajax upvotes and increments user-specific upvote data
    commentEl.querySelector('a.upvote').addEventListener('click', e => {
      e.preventDefault();
      var httpRequest = new XMLHttpRequest();
      httpRequest.onload = function(e) {
        // after upvoting, retrieve new unvote link from response
        var regex_str = "vote\\?id=" + commentEl.id + "&amp;how=un.*?'";
        var regex = new RegExp(regex_str)
        var unVoteUrl = httpRequest.responseText.match(regex)[0].slice(0, -1);
        var parser = new DOMParser;
        var dom = parser.parseFromString(
            '<!doctype html><body>' + unVoteUrl,
            'text/html');
        var decodedString = dom.body.textContent;
        c.unVoteUrl = decodedString;
        commentEl.querySelector('a.unvote').href = c.unVoteUrl;

        HN.upvoteUserData(authorEl.textContent, 1);
        upvoterEl.classList.add('voted');
        downvoterEl.classList.add('voted');
        unvoterEl.classList.add('voted');
      };
      httpRequest.open('GET', c.upVoteUrl, true);
      httpRequest.send();
    }, true);

    // ajax unvote
    commentEl.querySelector('a.unvote').addEventListener('click', e => {
      e.preventDefault();
      var httpRequest = new XMLHttpRequest();
      httpRequest.onload = function(e) {
        HN.upvoteUserData(authorEl.textContent, -1);
        // only show up/down vote if we receive urls (for logged out users or low karma)
        if (c.upVoteUrl) upvoterEl.classList.remove('voted');
        if (c.downVoteUrl) downvoterEl.classList.remove('voted');
        unvoterEl.classList.remove('voted');
      };
      var unvote_link = c.unVoteUrl;
      httpRequest.open('GET', unvote_link, true);
      httpRequest.send();
    }, true);
    
    this.renderComments(kids, commentEl.querySelector('.replies'))
    into.appendChild(clone);
  }

  renderComments(comments, into) {
    for (let i = 0; i < comments.length; i++) {
      this.renderComment(comments[i], into);
    }
  }

  collapse(c) {
    c.isCollapsed = !c.isCollapsed;
    c.isDirty = true;
    c.el.classList.toggle('collapsed', c.isCollapsed);
    this.storeMeta();
  }

  getMeta() {
    const toStore = {};
    preorder(this.nodeMap.root, n => {
      if (n.isDirty) toStore[n.id] = { 'isCollapsed': n.isCollapsed };
    });
    return toStore;
  }

  storeMeta(items) {
    chrome.storage.local.set(this.getMeta());
  }

  loadMeta(nodeMap, callback) {
    const keys = [];
    preorder(nodeMap.root, n => {
      keys.push(n.id);
    });
    chrome.storage.local.get(keys, items => {
      callback(items);
    })
  }

  prepare(nodeMap, callback) {
    this.loadMeta(nodeMap, meta => {
      const visit = (n) => {
        let acc = 0;
        for (let i = 0; i < n.children.length; i++) {
          acc += visit(n.children[i], acc);
        }
        const res = acc + n.children.length;
        n.descCount = res;
        n.isCollapsed = (meta[n.id] && meta[n.id].isCollapsed);
        return res;
      };
      visit(nodeMap.root);
      callback(nodeMap);
    });
  }

  apply() {
    var commentTree = document.querySelector('#hnmain table.comment-tree');
    var itemList = document.querySelector('#hnmain table.itemlist');
    var threadList = document.querySelector('#hnmain table.comments-table');
    var threadList;
    if (!commentTree && !itemList && !threadList) {
      console.warn('unrecognized markup detected, no commentTree, itemList, or threadList');
      return;
    } else if (itemList) {
      commentTree = itemList;
    } else if (threadList) {
      commentTree = threadList;
    }

    const nodeMap = this.nodeListToTree(this.markupToNodeList(commentTree));

    this.prepare(nodeMap, nodeMap => {
      this.nodeMap = nodeMap;
      const commentsContainer = document.createElement('div');
      commentsContainer.id = 'hnes-comments';

      this.renderComments(this.nodeMap.root.children, commentsContainer);
      commentTree.parentNode.replaceChild(commentsContainer, commentTree);
      if (itemList) {
        commentsContainer.classList.add('nolevels')
      } else {
        // highlight new comments on threaded pages
        CommentTracker.init();
      }
      // load and show user tags and point totals
      HN.addInfoToUsers();
      var loading_comments = document.getElementById('loading_comments');
      if (loading_comments) {
        loading_comments.classList.add('hidden');
      }
    });
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

        var postPagesRE = /^(?:\/|\/news|\/newest|\/best|\/active|\/classic|\/submitted|\/saved|\/jobs|\/noobstories|\/ask|\/news2|\/over|\/show|\/shownew|\/hidden|\/upvoted)$/;
        if (postPagesRE.test(pathname)) {
          HN.doPostsList();

          function remove_first_tr() {
            $("body #content td table tbody tr").filter(":first").remove();
          }
          if (pathname == '/jobs') {
            $("body").attr("id", "jobs-body");
          }
          if (pathname == '/show' || pathname == '/jobs') {
            remove_first_tr();
            var blurbRow = $("body #content td table tbody tr:not(.athing):first"),
                blurb = blurbRow.find("td:last").html();
            blurbRow.remove();
            $("body #content table").before($("<p>").addClass("blurb").html(blurb));
          }
        }
        else if (pathname == '/edit') {
          $("body").attr("id", "edit-body");
          $("tr:nth-child(3) td td:first-child").remove();
        }
        else if (pathname == '/item' ||
                 pathname == "/more" ||
                 pathname == "/bestcomments" ||
                 pathname == "/noobcomments" ||
                 pathname == "/newcomments") {

          var morelink = document.querySelector('.morelink');
          if (morelink) {
            var morelink_href = morelink.href;
            $('#content').after(morelink);
          }

          let storyIdResults = /id=(\w+)/.exec(window.location.search)
          let storyId = false;
          if (storyIdResults) {
            storyId = /id=(\w+)/.exec(window.location.search)[1] ;
          }
          HN.hnComments = new HNComments(storyId);
          HN.doCommentsList(pathname, track_comments);
        }
        else if (pathname == '/favorites' ||
                 pathname == '/upvoted') {
          $("td[colspan='2']").hide();
          $(".votelinks").hide();
          $(".ind").hide();
          //HN.doCommentsList(pathname, track_comments);
        }
        else if (pathname == '/threads') {
          $("body").attr("id", "threads-body");

          //create new table and try to emulate /item
          var trs = $('body > center > table > tbody > tr');
          var comments = trs.slice(2, -1);
          var newtable = $("<table/>").append($('<tbody/>').append(comments));
          $(trs[1]).find('td').append(newtable);

          var morelink = document.querySelector('.morelink');
          if (morelink) {
            var morelink_href = morelink.href;
            newtable.parent().append(morelink);
          }

          HN.hnComments = new HNComments(0);
          HN.doCommentsList(pathname, track_comments);
        }
/*        else if (pathname == '/newcomments' ||
                 pathname == '/bestcomments' ||
                 pathname == '/noobcomments' ) {
          HN.addClassToCommenters();
          HN.addInfoToUsers($('body'));
        }*/
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

    getLocalStorage: function(key, callback) {
      chrome.runtime.sendMessage({
        method: "getLocalStorage",
        key: key
      }, callback);
    },

    setLocalStorage: function(key, value) {
      chrome.runtime.sendMessage(
        { method: "setLocalStorage",
          key: key,
          value: value },
        function(response) {
        });
    },

    getUserData: function(usernames, callback) {
      chrome.runtime.sendMessage({
        method: "getUserData",
        usernames: usernames
      }, callback);
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

    /*addClassToCommenters: function() {
      //add class to comment author
      var commenters = $(".comhead a[href*=user]");
      commenters.addClass('commenter');
    },*/

    doCommentsList: function(pathname, track_comments) {
//      InlineReply.init();
      //HN.addClassToCommenters();

      //add classes to comment page header (OP post) and the table containing all the comments
      var comments;

      let itemIdResults = /id=(\w+)/.exec(window.location.search)
      var itemId = false;
      if (itemIdResults) {
        itemId = /id=(\w+)/.exec(window.location.search)[1] ;
      }
      below_header = $('#content table');

      $("<p id='loading_comments'>Loading comments</p>").insertBefore(below_header[1])

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
        $(".item-header td").removeAttr('colspan');

        //fixes issue #121 (indent on individual comment pages)
        $(".item-header td[class='ind']").remove()

        // move reply button to new line.
        $(".item-header input[type='submit']").css("display", "block");

        var more = $('.morelink');
        //recursively load more pages on closed thread
        if (more) {
          HN.loadMoreLink(more);
        }
      }
      else {// if (pathname == "/threads") {
        $("body").attr("id", "threads-body");
        comments = $(below_header[0]);
        comments.addClass('comment-tree');
        HN.doAfterCommentsLoad();
      }

      //do not want to track comments on 'more' pages
      //TODO: infinite scroll and tracking on 'more' pages
      //if (track_comments) {
      //  CommentTracker.init();
      //}
    },

    doUserProfile: function() {
      $('#content > td').attr('id', 'user-profile');

      var options = $('tr > td[valign="top"]');
      var user = options[0];
      var created = $(options[1]);
      var karma = $(options[2]);
      var about = $(options[3]);

      if (options.length === 4) {
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
        else {
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
        var karma_for_flag = 21;
        var karma_for_polls = 201;
        var karma_for_downvotes = 501;
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
        HN.doAfterCommentsLoad();
        return;
      }

      var loading_comments = document.getElementById('loading_comments')
      if (loading_comments) {
        loading_comments.textContent += '.';
      }

      var moreurl = elem.attr('href');
      var load_div = $('<div/>');
      load_div.load(moreurl + " > center > table > tbody > tr:nth-child(3) > td > table > tbody > tr", function(response) {
        $(".comments-table > tbody").append(load_div.children());
        $(".morelink").remove();
        morelink = $('.title a[rel="nofollow"]:contains(More)');
        if (morelink) {
          HN.loadMoreLink(morelink);
        }
      });
    },

    doAfterCommentsLoad: function() {
      HN.hnComments.apply();
      var loading_comments = document.getElementById("loading_comments");
      if (loading_comments) {
        loading_comments.textContent = "Rendering comments...";
      }
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

    addInfoToUsers: function() {
      var author_els = document.querySelectorAll('.author a');
      var usernames = Array.from(author_els).map( x => x.textContent );

      HN.getUserData(usernames, response => {
        if (!response) return;
        var userData = response.data;
        for (var i = 0; i < author_els.length; i++) {
          var author_el = author_els[i],
              name = usernames[i],
              userInfo = userData[name];

          if (userInfo) {
            if (typeof userInfo === "number") {
              //Convert the legacy format.
              //  Upvotes used to be saved in localStorage as (for example) etcet: '1', but are now etcet: '{"votes": 1}'.
              //  This change in format was made so that tag information can be saved in the same location;
              //  i.e. it will soon be saved as etcet: '{"votes": 1, "tag": "Creator of HNES"}'.
              //
              //  The conversion only needs to be done here, since this executes on page load,
              //  which means that whatever username you see will have undergone the conversion to the new format.
              userInfo = {'votes': userInfo};
              HN.setLocalStorage(name, JSON.stringify(userInfo));
              console.log('Converted legacy format for user', name);
            }
            else {
              var info;
              try {
                info = JSON.parse(userInfo);
              }
              catch (e) {
                info = {}
              }
              // display user tag and score
              if (info.tag) HN.displayUserTag(author_el, info.tag || '');
              if (info.votes) HN.displayUserScore(author_el, info.votes);
            }
          }
        };
      });


      $(document).on('click', '.hnes-tag, .hnes-tagText', function(e) {
      // Using .on() so that the event applies to all elements generated in the future
        HN.editUserTag(e);
      });

      $(document).on('keyup', '.hnes-tagEdit', function(e) {
        var code = e.keyCode || e.which,
            parent = $(e.target).parent(),
            gp = parent.parent();

        if (code === 13) { // Enter
          var author = gp.find('a').text(),
              tagEdit = parent.find('.hnes-tagEdit');
          HN.setUserTag(author, tagEdit.val());
          parent.removeClass('edit');
        }
        if (code === 27) { // Escape
          var tagText = parent.find('.hnes-tagText'),
              tagEdit = parent.find('.hnes-tagEdit');
          tagEdit.val(tagText.text());
          parent.removeClass('edit');
        }
      });
    },

    upvoteUserData: function(author, value) { // Adds value to the user's upvote count, saves and displays it.
      var commenter = $('.author:contains('+author+')');
      HN.getLocalStorage(author, function(response) {
        var userInfo = {},
        new_upvote_total = value;

        if (response.data) {
          userInfo = JSON.parse(response.data);
        }

        if (userInfo.votes) { // If we already have up/downvoted this user before.
          new_upvote_total += userInfo.votes;
        }
        userInfo.votes = new_upvote_total;
        if (new_upvote_total === 0) {
          delete userInfo.votes;
        }
        HN.setLocalStorage(author, JSON.stringify(userInfo));
        HN.showNewUserScore(author, new_upvote_total); // Set the upvote count
      });
    },

    showNewUserScore: function(author, value) {
      var author_els = $('.author:contains('+author+')');
      for (var i = 0; i < author_els.length; i++) {
        var author_el = author_els[i];
        var score_el = author_el.querySelector('.hnes-user-score');
        if (value !== 0) {
          score_el.textContent = value;
          score_el.parentElement.classList.remove('noscore');
        } else {
          score_el.parentElement.classList.add('noscore');
        }
      }
    },

    displayUserScore: function(el, upvotes) {
      userscoreEl = el.parentElement.querySelector('.hnes-user-score');
      userscoreEl.textContent = upvotes;
      userscoreEl.parentElement.classList.remove('noscore');
    },

    displayUserTag: function(el, tag) {
      if (tag) {
        el.parentElement.querySelector('.hnes-tagText').textContent = tag;
        el.parentElement.querySelector('.hnes-tagEdit').value = tag;
      }
    },

    editUserTag: function(e) {
      var parent = $(e.target).parent(),
          tagEdit = parent.find('.hnes-tagEdit'),
          tagText = parent.find('.hnes-tagText');
      parent.addClass('edit');
      tagEdit.focus();
    },

    setUserTag: function(author, tag) {
      HN.getLocalStorage(author, function(response) {
        var userInfo = {};

        if (response.data)
          userInfo = JSON.parse(response.data);

        if (tag !== '')
          userInfo.tag = tag;
        else
          delete userInfo.tag;

        HN.setLocalStorage(author, JSON.stringify(userInfo));
      });

      var commenter = $('.author:contains('+author+')');
      for (i = 0; i < commenter.length; i++) {
        var tagText = $(commenter[i]).parent().find('.hnes-tagText'),
            tagEdit = $(commenter[i]).parent().find('.hnes-tagEdit');

        // Change it all to the new value:
        tagText.text(tag);
        tagEdit.val(tag);
      }
    },

    removeNumbers: function() {
      $('td[align="right"]').remove();
    },

    formatScore: function() {
      $('.subtext').each(function(){
        var $this = $(this);

        var score = $this.find('span:first');
        var as = $this.find('a');
        var by = $this.find('a:eq(0)');
        var at = $this.find('a:eq(1)');
        var comments;

        if (score.length == 0)
          score = $("<span/>").text('0');
        else
          score.text(parseInt(score.text()));
        score.addClass("score").attr('title', 'Points');

        if ($(as[as.length - 1]).text() != 'web') {
          comments = $(as[as.length - 1]);
        }
        else {
          comments = $('<a>-</a>');
        }

        comments_link = $(at).attr('href');

        if (comments.text() == "discuss" || /ago$/.test(comments.text())) {
          comments = $("<a/>").html('0')
                              .attr('href', comments.attr('href'));
        }
        else if (comments.text() == "comments") {
          comments = $("<a/>").html('?')
                              .attr('href', comments.attr('href'));
        }
        else if (comments.text() == "") {
          score.text('');
        }
        else {
          comments.text(parseInt(comments.text()) || '-');
        }

        comments.attr('href', comments_link);
        comments.addClass("comments")
        comments.attr('title', 'Comments');

        var by_el;
        if (by.length == 0)
          by_el = $("<span/>");
        else
          by_el = $('<span/>').addClass('submitter')
                              .text('by ')
                              .append(by.attr('title', 'View profile'));

        var score_el = $('<td/>').append(score);
        var comments_el = $('<td/>').append(comments);
        var $prev = $this.parent().prev();
        $prev.prepend(score_el);
        $prev.prepend(comments_el);
        $prev.find('.title').append(by_el);
        $this.parent().next().remove();
        $this.parent().remove();

        $('<span />').addClass('hnes-actions').append(
            $this.find('a[href^=flag]'),
            $this.find('a[href^=vouch]'),
            $this.find('a[href^="https://hn.algolia.com/?query="]'),
            $this.find('a[href^=hide]'),
            $this.find('a[href^="https://www.google.com/search?q="]')
        ).insertAfter(by_el);

        $('<span />').addClass('hnes-age').text(at.text()).insertAfter(by_el);
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
                         ['upvoted', '/upvoted', "Stories you've voted for"],
                         ['favorites', '/favorites', "Stories you've favorited"]
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
        if (window.location.pathname != '/upvoted' || window.location.pathname != '/favorites') {
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
            h = 72, // Open Help
            l = 76, // New tab
            c = 67, // Comments in new tab
            b = 66, // Open comments and link in new tab
            shiftKey = 16; // allow modifier
        $(document).keydown(function(e){
          //Keyboard shortcuts disabled when search focused
          if (!HN.searchInputFocused && !e.ctrlKey) {
            if (e.which == j) {
              HN.next_story();
            } else if (e.which == k) {
              HN.previous_story();
            } else if (e.which == l) {
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
    chrome.runtime.sendMessage({method: "getLocalStorage", key: Number($(this).attr('id'))}, function(response) {
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
