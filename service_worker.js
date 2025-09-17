// Add event listeners
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('REQUEST', request.method, request)
  if (request.method == "getAllLocalStorage") {
    sendResponse({data: chrome.storage.local});
  }
  else if (request.method == "getLocalStorage") {
    sendResponse({data: chrome.storage.local[request.key]});
  }
  else if (request.method == "setLocalStorage") {
    chrome.storage.local[request.key] = request.value;
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
        value = chrome.storage.local[key];
    results[key] = value;
  }
  return results;
}

//expire old entries
(function() {
  for (i=0; i<chrome.storage.local.length; i++) {
    var info = JSON.parse(chrome.storage.local[chrome.storage.local.key(i)]);
    var now = new Date().getTime();
    if (now > info.expire)
      chrome.storage.local.removeItem(chrome.storage.local.key(i));
  }
});
