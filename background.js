// Add event listeners
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('REQUEST', request.method, request)
  if (request.method == "getAllLocalStorage") {
    sendResponse({data: localStorage});
  }
  else if (request.method == "getLocalStorage") {
    sendResponse({data: localStorage[request.key]});
  }
  else if (request.method == "setLocalStorage") {
    localStorage[request.key] = request.value;
    sendResponse({});
  }
  else if (request.method == "getUserData") {
    var data = getUserData(request.usernames);
    sendResponse({ data: data });
  }
  else {
    sendResponse({});
  }
});

function getUserData(usernames) {
  var results = {};
  for (var i = 0; i < usernames.length; i++) {
    var key = usernames[i],
        value = localStorage[key];
    results[key] = value;
  }
  return results;
}

//expire old entries
(function() {
  for (i=0; i<localStorage.length; i++) {
    var info = JSON.parse(localStorage[localStorage.key(i)]);
    var now = new Date().getTime();
    if (now > info.expire)
      localStorage.removeItem(localStorage.key(i));
  }
});
