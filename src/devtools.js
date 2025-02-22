import DHEBridge from './dhe-bridge.js';
import xs from 'xstream';

var _window;

// Dependency injecting Math so we can force .random() to return
// a particular value if we want.
// Not using default arguments here (instead planning to use currying) because
// Chrome apparently cares about the arity of the function it's given. :p
const setupPanel = _.curry((chrome, console, Math, panel) => {
  panel.onShown.addListener(function tmp(panelWindow) {
     panel.onShown.removeListener(tmp); // Run once only
    _window = panelWindow;

    var port = chrome.extension.connect({
      name: "DappHub" + Math.random().toString().slice(2)
    });

    var tabid = chrome.devtools.inspectedWindow.tabId;
    port.postMessage({type: "CONNECT", tabid})

    // const sender = {send}
    //
    // sender.send("something")

    const onout = port.postMessage.bind(port)
    const dappMsg$ = xs.create({
      start: listener => {
        port.onMessage.addListener(function (data) {
          let msgs;
          if(data.type == "RES" && Array.isArray(data.req)) {
            msgs = data.req.map( (e, i) => ({
              type: "RES",
              req: e,
              res: data.res[i]}))
          } else if(data.type == "REQ" && Array.isArray(data.req)) {
            msgs = data.req.map( (e, i) => ({
              type: "RES",
              req: e
            }))
          } else {
            msgs = [data]
          }

          msgs.forEach(r => {
            listener.next(r)
          })
        });
      },
      stop: () => {}
    })

    dappMsg$
    .debug("msg")

    _window.run(_window.main, {
      DOM: _window.makeDOMDriver('#app'),
      Sniffer: DHEBridge({
        onout, // forward some msgs to dapp
        in$: xs.merge(dappMsg$) // msgs received from dapp
      }),
      HTTP: _window.makeHTTPDriver()
    });

  });
});

function webpackMain(chrome, console, Math) {
  chrome.devtools.panels.create("DappHub","chrome.png", "panel.html",
    setupPanel(chrome, console, Math))
}

module.exports = {
  setupPanel,
  webpackMain
}
