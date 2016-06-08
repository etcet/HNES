Hacker News Enhancement Suite
=============================

A Hacker News extension for Chrome which changes lots of things.

Features
--------
* Completely new style
* Easy access to all pages
* Enhanced comment threads
  * Collapsible comments
  * Inline commenting
  * Link to parent
  * Display all comments on paginated threads
  * Highlight the original poster
* Show and highlight new comments since you last view a thread
* Highlight links once clicked to more easily identify what you've recently visited
* Redirect back to the front page upon hitting an expired link
* Display how many times you've upvoted each user
* Graphs on polls
* Clickable links in self posts and on users profile pages
* New smooth and scalable up & down vote arrows
* Keyboard controls on index pages:
  * j - Next item
  * k - Previous item
  * o - Open story
  * l - Open story in a new tab
  * p - View comments
  * c - View comments in a new tab
  * b - Open both the comments and the story in new tabs
* Tag users

Chrome web store link
---------------------
https://chrome.google.com/webstore/detail/bappiabcodbpphnojdiaddhnilfnjmpm

TODO
----
* Options page
* Put search in a better place + ajax auto-complete
* Do something with un-threaded comment lists (e.g. best comments)
* Make profiles prettier
* Allow user to highlight friends (ala RES)
* Show dead/grayed-out comments on mouse hover (or maybe a button)
* Test / make it work when user can see downvotes

Things I can't test
-------
I don't have enough karma to test down votes, creating polls, or topbar color

Compatability
-------
I do not test this extension with any other extensions active on Hacker News so I cannot guarantee that it will play nice. If you come across an apparent bug please make sure that any other extension are disabled or please mention which ones are enabled in the bug report.

License
-------
MIT License, see LICENSE

Thanks
------
Wayne Larson for hckrnews.com and permission to use code from his extension which displays new comments.

@jarques for his HN+ extension (https://github.com/jarquesp/Hacker-News--) which was used as a starting point for this project.

Thanks to Samuel Stern (hatboysam) for the inline commenting.

Thanks to Vishnu Rajeevan (burntcookie90) for adding more keyboard shortcuts.

Thanks to Lewis Pollard (lewispollard) for highlighting a story once you've opened it and redirecting to the front page when you hit an expired link.

Thanks to Dean Harding (codeka) for replacing the up/down vote images with CSS buttons.

Thanks to Jiahua (jwang47) for his fork of Már Örlygsson's (maranomynet) linkify JQuery plugin.

Thanks for Dan Harper (danharper) and to Will Ridgers (wridgers) for some CSS fixes.

Thanks for Nuno Santos (nfvs) for styling the login page and other fixes.

Thanks to alanc10n for fixing issue 66

Thanks to sglantz for adding support for topcolor, issue 52

Thanks to ibejoeb for fixing the collapsible comments and other improvements.
