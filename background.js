chrome.extension.onRequest.addListener(
  function(request, sender, sendResponse) {
  	if(request.type.toLowerCase() == 'opentag') chrome.tabs.create({url : 'http://renren.com'})
  }
);