chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('index.html', {
	id: "mainwin",
    bounds: {
      width: 600,
      height: 600
    },
     minWidth: 600,
      minHeight: 600,
    maxWidth: 600,
    maxHeight: 600
  });
  
});
