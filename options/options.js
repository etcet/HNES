//TODO use https://developer.chrome.com/extensions/storage.html
//https://github.com/roykolak/chrome-bootstrap

function save_options() {
  var select = document.getElementById("style");
  var style = select.children[select.selectedIndex].value;
  localStorage["options_style"] = style;

  var status = document.getElementById("status");
  status.innerHTML = "Options Saved.";
  setTimeout(function() {
    status.innerHTML = "";
  }, 750);
}

function restore_options() {
  var style = localStorage["options_style"];
  if (!style) {
    return;
  }
  var select = document.getElementById("style");
  for (var i=0; i < select.children.length; i++) {
    var child = select.children[i];
    if (child.value == style) {
      child.selected = "true";
      break;
    }
  }
}

document.addEventListener("DOMContentLoaded", restore_options);
document.querySelector("#save").addEventListener("click", save_options);
